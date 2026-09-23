// 回路の評価: 時間を 1 tick ずつ進め、ピンの値とフリップフロップの状態を求める。
// モジュールは flatten.ts で展開してから評価する

import { flattenProject } from './flatten';
import {
  delayOf,
  type Component,
  inputCount,
  isFlipFlopKind,
  outputCount,
  type FlipFlopKind,
  CLK_PIN,
} from './component';
import type { Circuit, PinRef } from './circuit';
import type { Project } from './project';

export function pinKey(comp: string, pin: number): string {
  return `${comp}:${pin}`;
}

export interface FlipFlopState {
  q: boolean;
  /**
   * 前回観測した CLK (立ち上がり検出用)。ラッチ (RS, RSEN, DLATCH) は使わない。
   * 前回の結果がない (ページを開いた直後など) ときは OFF から始まるので、
   * その時点で CLK が ON なら、立ち上がりとみなして1回動く
   */
  clk: boolean;
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

/** フリップフロップ以外の部品の出力 (pin 0)。CUSTOM は展開済みの前提なので来ない */
function evalGate(c: Component, ins: boolean[]): boolean {
  const [a, b] = ins;
  switch (c.kind) {
    case 'INPUT':
    case 'CLOCK':
      return !!c.on;
    case 'HIGH':
      return true;
    case 'OUTPUT':
    case 'BUF':
      return a;
    case 'NOT':
      return !a;
    case 'AND':
      return a && b;
    case 'OR':
      return a || b;
    case 'NAND':
      return !(a && b);
    case 'NOR':
      return !(a || b);
    case 'XOR':
      return a !== b;
    default:
      throw new Error(`not a gate: ${c.kind}`);
  }
}

/** フリップフロップの次の状態。ins は入力ピンの値 (ピン番号の順) */
function nextState(
  kind: FlipFlopKind,
  ins: boolean[],
  s: FlipFlopState,
): FlipFlopState {
  if (kind === 'RS') {
    // RS ラッチ。クロックはなく入力にすぐ反応する。S=R=1 はリセット優先
    const [set, reset] = ins;
    return { q: reset ? false : set ? true : s.q, clk: false };
  }
  if (kind === 'RSEN') {
    // EN 付きの RS ラッチ。EN が ON の間だけ S / R が効く (RS と同じくリセット優先)。OFF の間は値を保つ
    const [set, en, reset] = ins;
    if (!en) {
      return { q: s.q, clk: false };
    }
    return { q: reset ? false : set ? true : s.q, clk: false };
  }
  if (kind === 'DLATCH') {
    // D ラッチ。EN が ON の間は Q が D に追従し、OFF の間は値を保つ
    const [d, en] = ins;
    return { q: en ? d : s.q, clk: false };
  }
  const clk = ins[CLK_PIN];
  if (!clk || s.clk) {
    return { q: s.q, clk };
  }
  // 立ち上がりエッジ
  switch (kind) {
    case 'DFF':
      return { q: ins[0], clk };
    case 'TFF':
      return { q: ins[0] ? !s.q : s.q, clk };
    case 'JKFF': {
      const [j, , k] = ins;
      return { q: j && k ? !s.q : j ? true : k ? false : s.q, clk };
    }
  }
}

/**
 * 時間を 1 tick 進める。
 *
 * 流れ:
 * 1. 遅延のある部品が、遅延の分だけ前に計算した値を出す (その間ずっと同じ値だったときだけ)
 * 2. 遅延のない部品 (INPUT、CLOCK、HIGH、OUTPUT と、モジュールのピンの BUF) を、値が落ち着くまで伝える
 * 3. 遅延のある部品が、落ち着いた値から次に出す値を計算して、待ち行列に入れる
 *
 * 2 と 3 は全部品を同じ値から見るので、部品を並べた順番で結果が変わることはない。
 */
export function stepCircuit(circuit: Circuit, prev?: SimResult): SimResult {
  const values = new Map<string, boolean>();
  const flipFlops = new Map<string, FlipFlopState>();
  const pending = new Map<string, boolean[][]>();
  for (const c of circuit.components) {
    // 出力ピンのない OUTPUT も、表示する値を置くために pin 0 を持つ
    for (let p = 0; p < Math.max(outputCount(c.kind), 1); p++) {
      const k = pinKey(c.id, p);
      values.set(k, prev?.values.get(k) ?? false);
    }
    if (isFlipFlopKind(c.kind)) {
      flipFlops.set(c.id, {
        ...(prev?.flipFlops.get(c.id) ?? { q: false, clk: false }),
      });
    }
  }

  // 入力ピン (pinKey) → 接続元の出力ピン。入力ピンにつながる配線は1本だけなので、1つに決まる
  const driver = new Map<string, PinRef>();
  for (const w of circuit.wires) {
    driver.set(pinKey(w.to.comp, w.to.pin), w.from);
  }

  /** 入力ピンの値。何もつながっていない入力ピンは OFF */
  function inputsOf(c: Component, from: Map<string, boolean>): boolean[] {
    const ins: boolean[] = [];
    for (let p = 0; p < inputCount(c.kind); p++) {
      const d = driver.get(pinKey(c.id, p));
      ins.push(d ? (from.get(pinKey(d.comp, d.pin)) ?? false) : false);
    }
    return ins;
  }

  let changed = false;
  const emit = (id: string, out: boolean[]) => {
    out.forEach((v, pin) => {
      const k = pinKey(id, pin);
      if (values.get(k) !== v) {
        changed = true;
      }
      values.set(k, v);
    });
  };

  const delayed = circuit.components.filter((c) => delayOf(c.kind) > 0);
  const immediate = circuit.components.filter((c) => delayOf(c.kind) === 0);

  // 1. 待たせていた値を出す。前回の結果がなければ、落ち着いた状態から始める。
  //    出すのは、遅延の間ずっと同じ値だったときだけ。
  //    遅延より短い入力の変化は、実物のゲートと同じく出力に現れない
  for (const c of delayed) {
    const queue = prev?.pending.get(c.id);
    if (
      queue &&
      queue.every((out) => out.every((v, pin) => v === queue[0][pin]))
    ) {
      emit(c.id, queue[0]);
    }
  }

  // 2. 遅延のない部品は、この tick のうちに伝える。BUF がつながっていても遅れないようにするため、
  //    値が変わらなくなるまで繰り返す (遅延のない部品だけの輪は作れないので、必ず止まる)
  for (let i = 0; i < immediate.length + 1; i++) {
    const now = new Map(values);
    let moved = false;
    for (const c of immediate) {
      const v = evalGate(c, inputsOf(c, now));
      if (now.get(pinKey(c.id, 0)) !== v) {
        moved = true;
      }
      emit(c.id, [v]);
    }
    if (!moved) break;
  }

  // 3. 遅延のある部品が、次に出す値を計算する
  const now = new Map(values);
  for (const c of delayed) {
    const ins = inputsOf(c, now);
    let next: boolean[];
    if (isFlipFlopKind(c.kind)) {
      // 状態はこの tick で更新する。CLK の値も一緒に記録するので、同じ立ち上がりで2回動くことはない
      const state = nextState(c.kind, ins, flipFlops.get(c.id)!);
      flipFlops.set(c.id, state);
      next = [state.q, !state.q];
    } else {
      next = [evalGate(c, ins)];
    }
    const queue = prev?.pending.get(c.id);
    if (queue) {
      pending.set(c.id, [...queue.slice(1), next]);
    } else {
      // 前回の結果がないときは、待ち行列を今の値で埋めて落ち着いた状態から始める
      pending.set(
        c.id,
        Array.from({ length: delayOf(c.kind) }, () => next),
      );
      emit(c.id, next);
    }
  }

  // 落ち着いた (何 tick か続けて値が変わらない) 状態から、どれだけ離れているかを数える。
  // 振動しているときは値が変わる tick と変わらない tick が交互に来ることもあるので、
  // 「変わり続けた回数」ではなく「落ち着いていない間の長さ」で見る
  const stableTicks = changed ? 0 : (prev?.stableTicks ?? 0) + 1;
  const activeTicks =
    stableTicks >= SETTLED_TICKS ? 0 : (prev?.activeTicks ?? 0) + 1;
  return {
    values,
    flipFlops,
    pending,
    stableTicks,
    activeTicks,
    unstable: activeTicks > OSCILLATION_TICKS,
  };
}

/**
 * プロジェクトの時間を 1 tick 進める (モジュールを展開してから評価する入口)。
 * 最上位に置かれたモジュールの出力ピンの値も values に含める。
 */
export function step(
  project: Project,
  id: string,
  prev?: SimResult,
): SimResult {
  const { circuit, modules } = flattenProject(project, id);
  const result = stepCircuit(circuit, prev);
  for (const [compId, mod] of modules) {
    mod.outputs.forEach((id, pin) =>
      result.values.set(
        pinKey(compId, pin),
        result.values.get(pinKey(id, 0)) ?? false,
      ),
    );
  }
  return result;
}
