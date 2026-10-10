// 回路の評価: 時間を 1 tick ずつ進め、ピンの値とフリップフロップの状態を求める。
// モジュールは flatten.ts で展開してから評価する。
// 部品の種類ごとの評価 (入力から出力、記憶素子の次の状態) は parts/ の仕様にある。
//
// 評価は、展開した回路を番号で引く形 (CompiledCircuit) にしてから、配列の上で行う (stepState)。
// 部品 ID で引く形 (SimResult) は、画面に渡すときと、回路を編集して番号が変わったときの引き継ぎに使う

import { type Flattened, flattenProject, type ModulePorts } from './flatten';
import {
  delayOf,
  type Part,
  inputCount,
  isDisplayKind,
  isFlipFlopKind,
  outputCount,
} from '../circuit/part';
import type { PinRef } from '../circuit/circuit';
import { partSpecOf } from '../parts/specs';
import type { FlipFlopState } from '../parts/spec';
import type { Project } from '../circuit/project';

export type { FlipFlopState } from '../parts/spec';

export function pinKey(comp: string, pin: number): string {
  return `${comp}:${pin}`;
}

/** 入力ピン to の値を、出力ピン from の値にするつながり */
export interface Link {
  from: PinRef;
  to: PinRef;
}

/**
 * 計算に使う回路。部品と、ピン同士のつながり (flatten.ts が配線のネットから作る)。
 * 1 つの入力ピンにつながるのは、多くても 1 つの出力ピン
 */
export interface Netlist {
  parts: Part[];
  links: Link[];
}

export interface SimResult {
  /** 今出ている出力ピンの値。キーは pinKey(comp, pin)。OUTPUT は入力値を pin 0 に持つ */
  values: Map<string, boolean>;
  /** フリップフロップの内部状態 */
  flipFlops: Map<string, FlipFlopState>;
  /**
   * 遅延のある部品が、これから出す出力の待ち行列。先に出すものから順に並べる (長さは delayOf(kind))。
   * 遅延のない部品は持たない
   */
  pending: Map<string, boolean[][]>;
  /** 値が変わらずに続いた tick 数。SETTLED_TICKS 以上で落ち着いたとみなす */
  stableTicks: number;
  /** 落ち着かないまま続いている tick 数。発振の判定に使う */
  activeTicks: number;
  /** 発振とみなしている (入力を変えていないのに値が変わり続けている) */
  unstable: boolean;
}

/** これだけの tick、値が変わらなければ落ち着いたとみなす。いちばん長い遅延 (XOR の 3) より長くとる */
export const SETTLED_TICKS = 4;

/** 落ち着かないまま、これだけの tick が過ぎたら発振とみなす */
export const OSCILLATION_TICKS = 50;

/** 前回の状態がないフリップフロップの状態 */
const INITIAL_FLIP_FLOP: FlipFlopState = { q: false, clk: false };

/** 入力ピンの値 (ピン番号の順) から、記憶素子以外の部品の出力 (pin 0) を求める関数 */
type GateOutput = (ins: readonly boolean[]) => boolean;

/** 入力ピンの値と今の状態から、記憶素子の次の状態を求める関数 */
type NextState = (ins: readonly boolean[], s: FlipFlopState) => FlipFlopState;

/** OUTPUT と BUF は、入力をそのまま出す */
const passThrough: GateOutput = (ins) => ins[0];

/**
 * 部品の出力を求める関数。記憶素子と、INPUT・CLOCK (stepState の sources から値を取る) は null。
 * 表示するだけの部品は評価しないので null。モジュールは展開済みの前提なので来ない
 */
function gateOutputOf(c: Part): GateOutput | null {
  switch (c.kind) {
    case 'input':
    case 'clock':
      return null;
    case 'output':
    case 'buf':
      return passThrough;
  }
  const spec = partSpecOf(c.kind);
  if (spec?.behavior === 'logic') {
    return spec.output;
  }
  if (spec?.behavior === 'flipFlop' || spec?.behavior === 'display') {
    return null;
  }
  throw new Error(`not a part to evaluate: ${c.kind}`);
}

/** 記憶素子の次の状態を求める関数。記憶素子でなければ null */
function nextStateOf(c: Part): NextState | null {
  const spec = partSpecOf(c.kind);
  return spec?.behavior === 'flipFlop' ? spec.next : null;
}

/**
 * 評価のために、回路を番号で引く形にしたもの。回路を編集するまで使い回す。
 * 部品は parts の並びの番号 (部品番号) で、出力ピンの値は SimState.values の添字 (値の番号) で指す
 */
export interface CompiledCircuit {
  parts: readonly Part[];
  /** 部品ごとの、出力ピン 0 の値の番号。出力ピン p の値は outStart[i] + p */
  outStart: Int32Array;
  /** 部品ごとの、値を持つ出力ピンの数。出力ピンのない OUTPUT も、表示する値を置くために 1 つ持つ */
  outCounts: Int32Array;
  /** 値の数 (すべての部品の outCounts の合計) */
  valueCount: number;
  /** 部品ごとの、入力ピンを動かす出力ピンの値の番号。何もつながっていない入力ピンは -1 */
  drivers: Int32Array[];
  /** 部品ごとの、入力ピンの値を入れる配列。tick ごとに作らず、書き換えて使い回す */
  ins: boolean[][];
  /** 部品ごとの、出力を求める関数 (gateOutputOf)。tick ごとに部品の種類から引かないよう、先に引いておく */
  gateOutputs: (GateOutput | null)[];
  /** 部品ごとの、記憶素子の次の状態を求める関数 (nextStateOf) */
  nextStates: (NextState | null)[];
  /** 遅延のない部品 (表示するだけの部品を除く) の部品番号 */
  immediate: Int32Array;
  /**
   * 遅延のない部品を、入力を動かす側が先に来るように並べたもの。
   * 遅延のない部品だけでできた輪があると並べられないので、null
   */
  immediateOrder: Int32Array | null;
  /** 遅延のある部品の部品番号 */
  delayed: Int32Array;
  /** 部品ごとの遅延 */
  delays: Int32Array;
  /** 遅延のある部品の、待ち行列の先頭の位置 (SimState.queue の添字)。長さは 遅延 × outCounts */
  queueStart: Int32Array;
  /** 待ち行列の長さの合計 */
  queueLength: number;
  /** 部品ごとの、フリップフロップの状態の番号 (SimState.flipFlops の添字)。フリップフロップでなければ -1 */
  flipFlopIndex: Int32Array;
  flipFlopCount: number;
  /** 最上位に置かれたモジュールのピン。部品 ID で引く結果に、モジュールの出力ピンの値を足すのに使う */
  modules: ReadonlyMap<string, ModulePorts>;
  /** 評価の途中で、周の始めの値を写しておく場所。tick ごとに作らず使い回す */
  scratch: Uint8Array;
}

/** 回路を番号で引く形にする。modules は、展開した最上位のモジュールのピン (flatten.ts) */
export function compileCircuit(
  circuit: Netlist,
  modules: ReadonlyMap<string, ModulePorts> = new Map(),
): CompiledCircuit {
  const parts = circuit.parts;
  const n = parts.length;
  const indexOf = new Map(parts.map((c, i) => [c.id, i]));
  const outStart = new Int32Array(n);
  const outCounts = new Int32Array(n);
  let valueCount = 0;
  parts.forEach((c, i) => {
    outStart[i] = valueCount;
    outCounts[i] = Math.max(outputCount(c.kind), 1);
    valueCount += outCounts[i];
  });

  const drivers = parts.map((c) => new Int32Array(inputCount(c.kind)).fill(-1));
  for (const l of circuit.links) {
    const to = indexOf.get(l.to.comp);
    const from = indexOf.get(l.from.comp);
    // 部品のない端と、範囲外のピンは無視する (起きないはずだが、値の番号がほかの部品にずれないように)
    if (
      to !== undefined &&
      from !== undefined &&
      l.to.pin < drivers[to].length &&
      l.from.pin < outCounts[from]
    ) {
      drivers[to][l.to.pin] = outStart[from] + l.from.pin;
    }
  }

  const delays = Int32Array.from(parts, (c) => delayOf(c.kind));
  const all = parts.map((_, i) => i);
  const delayed = Int32Array.from(all.filter((i) => delays[i] > 0));
  // 表示するだけの部品は、求めるものがないので計算に入れない (描画は入力ピンの値を見る)
  const immediate = Int32Array.from(
    all.filter((i) => delays[i] === 0 && !isDisplayKind(parts[i].kind)),
  );

  const queueStart = new Int32Array(n).fill(-1);
  let queueLength = 0;
  for (const i of delayed) {
    queueStart[i] = queueLength;
    queueLength += delays[i] * outCounts[i];
  }
  const flipFlopIndex = new Int32Array(n).fill(-1);
  let flipFlopCount = 0;
  parts.forEach((c, i) => {
    if (isFlipFlopKind(c.kind)) {
      flipFlopIndex[i] = flipFlopCount;
      flipFlopCount += 1;
    }
  });

  return {
    parts,
    outStart,
    outCounts,
    valueCount,
    drivers,
    ins: drivers.map((d) => Array<boolean>(d.length).fill(false)),
    gateOutputs: parts.map(gateOutputOf),
    nextStates: parts.map(nextStateOf),
    immediate,
    immediateOrder: orderByDrivers(immediate, drivers, outStart, outCounts, valueCount),
    delayed,
    delays,
    queueStart,
    queueLength,
    flipFlopIndex,
    flipFlopCount,
    modules,
    scratch: new Uint8Array(valueCount),
  };
}

/**
 * 部品 targets を、入力ピンを動かす側の部品が先に来るように並べる (targets の中のつながりだけを見る)。
 * targets の中で輪になっていて並べられないときは null
 */
function orderByDrivers(
  targets: Int32Array,
  drivers: readonly Int32Array[],
  outStart: Int32Array,
  outCounts: Int32Array,
  valueCount: number,
): Int32Array | null {
  // 値の番号 → その値を出す部品の番号 (targets の部品だけ。ほかは -1)
  const ownerOf = new Int32Array(valueCount).fill(-1);
  for (const i of targets) {
    for (let p = 0; p < outCounts[i]; p++) {
      ownerOf[outStart[i] + p] = i;
    }
  }
  // 部品ごとの、まだ並べていない、入力を動かす targets の部品の数 (同じ部品から 2 本来れば 2 と数える)
  const waiting = new Map<number, number>();
  // 部品 → その出力を入力に受ける targets の部品
  const users = new Map<number, number[]>();
  for (const i of targets) {
    waiting.set(i, 0);
  }
  for (const i of targets) {
    for (const slot of drivers[i]) {
      const from = slot >= 0 ? ownerOf[slot] : -1;
      if (from >= 0) {
        waiting.set(i, (waiting.get(i) ?? 0) + 1);
        users.set(from, [...(users.get(from) ?? []), i]);
      }
    }
  }
  const order: number[] = [...targets].filter((i) => waiting.get(i) === 0);
  for (let n = 0; n < order.length; n++) {
    for (const user of users.get(order[n]) ?? []) {
      const rest = (waiting.get(user) ?? 0) - 1;
      waiting.set(user, rest);
      if (rest === 0) {
        order.push(user);
      }
    }
  }
  return order.length === targets.length ? Int32Array.from(order) : null;
}

/** 展開した回路を番号で引く形にする。部品 ID で引く結果には、最上位のモジュールの出力ピンの値も含める */
export function compileFlattened({ circuit, modules }: Flattened): CompiledCircuit {
  return compileCircuit(circuit, modules);
}

/** 評価の状態 (番号で引く形)。中身は SimResult と同じ */
export interface SimState {
  /** 出力ピンの値 (0 か 1)。添字は値の番号 */
  values: Uint8Array;
  /**
   * 遅延のある部品が、これから出す出力の待ち行列。部品ごとに queueStart の位置から、
   * 先に出すものから順に、1 tick 分 (outCounts 個) ずつ並べる
   */
  queue: Uint8Array;
  /** 部品ごとに、待ち行列を持っているか (1 なら持つ)。持っていない部品は、落ち着いた状態から始める */
  queued: Uint8Array;
  /** フリップフロップの内部状態。添字は flipFlopIndex */
  flipFlops: FlipFlopState[];
  /** 値が変わらずに続いた tick 数。SETTLED_TICKS 以上で落ち着いたとみなす */
  stableTicks: number;
  /** 落ち着かないまま続いている tick 数。発振の判定に使う */
  activeTicks: number;
  /** 発振とみなしている */
  unstable: boolean;
}

/** INPUT と CLOCK の ON/OFF (部品番号の順、1 なら ON)。部品の on から作る */
export function sourcesOf(cc: CompiledCircuit): Uint8Array {
  return Uint8Array.from(cc.parts, (c) =>
    (c.kind === 'input' || c.kind === 'clock') && c.on ? 1 : 0,
  );
}

/** 部品 i の入力ピンの値を cc.ins[i] に読み込んで返す。何もつながっていない入力ピンは OFF */
function readInputs(cc: CompiledCircuit, i: number, from: Uint8Array): readonly boolean[] {
  const ins = cc.ins[i];
  const d = cc.drivers[i];
  for (let p = 0; p < d.length; p++) {
    ins[p] = d[p] >= 0 && from[d[p]] === 1;
  }
  return ins;
}

/**
 * 遅延のない部品だけの輪 (INPUT を OUTPUT へ直接つないだモジュールの出力を、自分の入力へつないだときの
 * BUF の輪など) があって、遅延のない部品を順に並べられないときの伝え方 (stepState の 2)。
 * どの部品も周の始めの値を見て計算する周を、値が変わらなくなるまで繰り返す。
 * 輪の中では落ち着かないこともあるので、回数は部品の数 + 1 までにする。
 * values を書き換え、値を変えたら onChange を呼ぶ
 */
function propagateLoops(
  cc: CompiledCircuit,
  sources: Uint8Array,
  values: Uint8Array,
  onChange: () => void,
) {
  const { immediate, outStart } = cc;
  const now = cc.scratch;
  for (let round = 0; round < immediate.length + 1; round++) {
    // 1 周の間、どの部品も周の始めの値 (now) を見る。部品を並べた順番で結果が変わらないようにするため
    now.set(values);
    let moved = false;
    for (let n = 0; n < immediate.length; n++) {
      const i = immediate[n];
      const gate = cc.gateOutputs[i];
      // 出力を求める関数のない遅延のない部品は、INPUT と CLOCK (sources から値を取る)
      const v = (gate ? gate(readInputs(cc, i, now)) : sources[i] === 1) ? 1 : 0;
      const slot = outStart[i];
      if (now[slot] !== v) {
        moved = true;
      }
      if (values[slot] !== v) {
        values[slot] = v;
        onChange();
      }
    }
    if (!moved) {
      break;
    }
  }
}

/**
 * 時間を 1 tick 進める (番号で引く形)。prev は書き換えず、新しい状態を返す。
 * sources は INPUT と CLOCK の ON/OFF (sourcesOf)。
 *
 * 流れ:
 * 1. 遅延のある部品が、遅延の分だけ前に計算した値を出す (その間ずっと同じ値だったときだけ)
 * 2. 遅延のない部品 (INPUT、CLOCK、HIGH、OUTPUT と、モジュールのピンの BUF) を、値が落ち着くまで伝える
 * 3. 遅延のある部品が、落ち着いた値から次に出す値を計算して、待ち行列に入れる
 *
 * 2 と 3 は全部品を同じ値から見るので、部品を並べた順番で結果が変わることはない。
 */
export function stepState(cc: CompiledCircuit, sources: Uint8Array, prev: SimState): SimState {
  const values = prev.values.slice();
  const queue = new Uint8Array(cc.queueLength);
  const queued = prev.queued.slice();
  const flipFlops = prev.flipFlops.slice();
  const now = cc.scratch;
  const { delayed, outStart, outCounts, queueStart, delays } = cc;

  // この tick で、出力ピンの値が 1 つでも変わったか。下の stableTicks を数えるのに使う。
  // 値を書くところは、毎 tick 部品の数だけ通るので、関数にせずその場で比べて書く
  let changed = false;

  // 1. 待たせていた値を出す。前回の待ち行列がなければ、3 で落ち着いた状態から始める。
  //    出すのは、遅延の間ずっと同じ値だったときだけ。
  //    遅延より短い入力の変化は、実物のゲートと同じく出力に現れない
  for (let n = 0; n < delayed.length; n++) {
    const i = delayed[n];
    if (!prev.queued[i]) {
      continue;
    }
    const k = outCounts[i];
    const head = queueStart[i];
    const end = head + delays[i] * k;
    // 待ち行列の値 (遅延の tick 数だけある) がすべて先頭と同じなら、遅延の間ずっと同じ値だったので出す。
    // q 番目の値は、ピン (q - head) % k の値なので、先頭の同じピンと比べる
    let same = true;
    for (let q = head + k; q < end && same; q++) {
      same = prev.queue[q] === prev.queue[head + ((q - head) % k)];
    }
    if (same) {
      for (let p = 0; p < k; p++) {
        const slot = outStart[i] + p;
        if (values[slot] !== prev.queue[head + p]) {
          values[slot] = prev.queue[head + p];
          changed = true;
        }
      }
    }
  }

  // 2. 遅延のない部品は、この tick のうちに伝える。BUF がつながっていても遅れないようにするため。
  //    入力を動かす側から順に (immediateOrder) 1 周すれば、どの部品も、入力が決まってから計算される。
  //    結果は、値が変わらなくなるまで繰り返したとき (propagateLoops) と同じで、1 周で済む。
  //    遅延のない部品だけの輪があって並べられないときは、propagateLoops で繰り返す
  const order = cc.immediateOrder;
  if (order) {
    for (let n = 0; n < order.length; n++) {
      // 型を書かないと、TypeScript が i の型を決められない (TS7022)
      const i: number = order[n];
      const gate = cc.gateOutputs[i];
      // 出力を求める関数のない遅延のない部品は、INPUT と CLOCK (sources から値を取る)
      const v = (gate ? gate(readInputs(cc, i, values)) : sources[i] === 1) ? 1 : 0;
      const slot = outStart[i];
      if (values[slot] !== v) {
        values[slot] = v;
        changed = true;
      }
    }
  } else {
    propagateLoops(cc, sources, values, () => {
      changed = true;
    });
  }

  // 3. 遅延のある部品が、次に出す値を計算する
  now.set(values);
  for (let n = 0; n < delayed.length; n++) {
    const i = delayed[n];
    const ins = readInputs(cc, i, now);
    const k = outCounts[i];
    const head = queueStart[i];
    // 待ち行列の末尾 (いちばんあとに出す値) の位置
    const last = head + (delays[i] - 1) * k;
    const next = cc.nextStates[i];
    const gate = cc.gateOutputs[i];
    if (next) {
      // 状態はこの tick で更新する。CLK の値も一緒に記録するので、同じ立ち上がりで2回動くことはない
      const f = cc.flipFlopIndex[i];
      const state = next(ins, flipFlops[f]);
      flipFlops[f] = state;
      queue[last] = state.q ? 1 : 0;
      queue[last + 1] = state.q ? 0 : 1;
    } else if (gate) {
      queue[last] = gate(ins) ? 1 : 0;
    } else {
      throw new Error(`not a part to evaluate: ${cc.parts[i].kind}`);
    }
    if (prev.queued[i]) {
      // 先頭 (この tick で出す番だった値) を捨て、残りを前へ詰める
      for (let q = head; q < last; q++) {
        queue[q] = prev.queue[q + k];
      }
    } else {
      // 前回の待ち行列がないときは、待ち行列を今の値で埋めて落ち着いた状態から始める
      for (let q = head; q < last; q++) {
        queue[q] = queue[last + ((q - head) % k)];
      }
      for (let p = 0; p < k; p++) {
        const slot = outStart[i] + p;
        if (values[slot] !== queue[last + p]) {
          values[slot] = queue[last + p];
          changed = true;
        }
      }
      queued[i] = 1;
    }
  }

  // 落ち着いた (何 tick か続けて値が変わらない) 状態から、どれだけ離れているかを数える。
  // 振動しているときは値が変わる tick と変わらない tick が交互に来ることもあるので、
  // 「変わり続けた回数」ではなく「落ち着いていない間の長さ」で見る
  // stableTicks: 値が変わらずに続いた tick 数。この tick で値が変わったら 0 に戻る。
  // activeTicks: 落ち着いていない tick 数。stableTicks が SETTLED_TICKS に届いたら (落ち着いたら) 0 に戻り、
  // それまでは、途中で値が変わらない tick があっても増え続ける
  const stableTicks = changed ? 0 : prev.stableTicks + 1;
  const activeTicks = stableTicks >= SETTLED_TICKS ? 0 : prev.activeTicks + 1;
  return {
    values,
    queue,
    queued,
    flipFlops,
    stableTicks,
    activeTicks,
    unstable: activeTicks > OSCILLATION_TICKS,
  };
}

/**
 * 部品 ID で引く形の結果から、番号で引く形の状態を作る。prev がなければ、何もない状態から始める。
 * 回路を編集すると部品番号が変わるので、編集の前の状態は、部品 ID で引く形を通して引き継ぐ
 */
export function toState(cc: CompiledCircuit, prev?: SimResult): SimState {
  const values = new Uint8Array(cc.valueCount);
  const queue = new Uint8Array(cc.queueLength);
  const queued = new Uint8Array(cc.parts.length);
  const flipFlops = Array<FlipFlopState>(cc.flipFlopCount).fill(INITIAL_FLIP_FLOP);
  cc.parts.forEach((c, i) => {
    const k = cc.outCounts[i];
    for (let p = 0; p < k; p++) {
      values[cc.outStart[i] + p] = prev?.values.get(pinKey(c.id, p)) ? 1 : 0;
    }
    const f = cc.flipFlopIndex[i];
    if (f >= 0) {
      flipFlops[f] = prev?.flipFlops.get(c.id) ?? INITIAL_FLIP_FLOP;
    }
    const pending = prev?.pending.get(c.id);
    // 長さの合わない待ち行列 (同じ ID の部品が、別の種類の部品になったとき) は引き継がず、
    // 待ち行列がないものとして、落ち着いた状態から始める
    if (
      cc.delays[i] > 0 &&
      pending?.length === cc.delays[i] &&
      pending.every((out) => out.length === k)
    ) {
      pending.forEach((out, t) => {
        out.forEach((v, p) => {
          queue[cc.queueStart[i] + t * k + p] = v ? 1 : 0;
        });
      });
      queued[i] = 1;
    }
  });
  return {
    values,
    queue,
    queued,
    flipFlops,
    stableTicks: prev?.stableTicks ?? 0,
    activeTicks: prev?.activeTicks ?? 0,
    unstable: prev?.unstable ?? false,
  };
}

/**
 * 番号で引く形の状態を、部品 ID で引く形の結果にする。
 * 最上位に置かれたモジュールの出力ピンの値も values に含める
 */
export function toResult(cc: CompiledCircuit, state: SimState): SimResult {
  const values = new Map<string, boolean>();
  const flipFlops = new Map<string, FlipFlopState>();
  const pending = new Map<string, boolean[][]>();
  cc.parts.forEach((c, i) => {
    const k = cc.outCounts[i];
    for (let p = 0; p < k; p++) {
      values.set(pinKey(c.id, p), state.values[cc.outStart[i] + p] === 1);
    }
    const f = cc.flipFlopIndex[i];
    if (f >= 0) {
      flipFlops.set(c.id, state.flipFlops[f]);
    }
    if (state.queued[i]) {
      const head = cc.queueStart[i];
      pending.set(
        c.id,
        Array.from({ length: cc.delays[i] }, (_, t) =>
          Array.from({ length: k }, (_, p) => state.queue[head + t * k + p] === 1),
        ),
      );
    }
  });
  for (const [compId, mod] of cc.modules) {
    mod.outputs.forEach((id, pin) => {
      values.set(pinKey(compId, pin), values.get(pinKey(id, 0)) ?? false);
    });
  }
  return {
    values,
    flipFlops,
    pending,
    stableTicks: state.stableTicks,
    activeTicks: state.activeTicks,
    unstable: state.unstable,
  };
}

/**
 * 時間を 1 tick 進める (部品 ID で引く形)。INPUT と CLOCK の ON/OFF は部品の on を使う。
 * 呼ぶたびに回路を番号で引く形にし直すので、続けて進めるときは compileCircuit と stepState を使う
 */
export function stepCircuit(circuit: Netlist, prev?: SimResult): SimResult {
  const cc = compileCircuit(circuit);
  return toResult(cc, stepState(cc, sourcesOf(cc), toState(cc, prev)));
}

/**
 * プロジェクトの時間を 1 tick 進める (モジュールを展開してから評価する入口)。
 * 最上位に置かれたモジュールの出力ピンの値も values に含める。
 */
export function step(project: Project, id: string, prev?: SimResult): SimResult {
  const cc = compileFlattened(flattenProject(project, id));
  return toResult(cc, stepState(cc, sourcesOf(cc), toState(cc, prev)));
}
