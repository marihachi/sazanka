import { flattenProject } from './flatten';
import {
  type Project,
  type Circuit,
  type Component,
  type PinRef,
  inputCount,
  isFlipFlop,
  outputCount,
  type FlipFlopKind,
  CLK_PIN,
} from './project';

export function pinKey(comp: string, pin: number): string {
  return `${comp}:${pin}`;
}

export interface FlipFlopState {
  q: boolean;
  /**
   * 前回観測した CLK (立ち上がり検出用)。RS は使わない。
   * 前回の結果がない (ページを開いた直後など) ときは OFF から始まるので、
   * その時点で CLK が ON なら、立ち上がりとみなして1回動く
   */
  clk: boolean;
}

export interface SimResult {
  /** 出力ピンの値。キーは pinKey(comp, pin)。OUTPUT は入力値を pin 0 に持つ */
  values: Map<string, boolean>;
  /** フリップフロップの内部状態 */
  flipFlops: Map<string, FlipFlopState>;
  /** 規定回数内に安定しなかった (発振) */
  unstable: boolean;
}

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

/** フリップフロップの次状態。ins は入力ピンの値 (INPUT_PINS の順) */
function nextState(kind: FlipFlopKind, ins: boolean[], s: FlipFlopState): FlipFlopState {
  if (kind === 'RS') {
    // RS ラッチ。クロックはなく入力にすぐ反応する。S=R=1 はリセット優先
    const [set, reset] = ins;
    return { q: reset ? false : set ? true : s.q, clk: false };
  }
  const clk = ins[CLK_PIN];
  if (!clk || s.clk) return { q: s.q, clk };
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
 * 全部品を繰り返し評価し、値が変化しなくなるまで伝播させる。
 * フィードバックループやフリップフロップの状態を保つため、前回の結果を受け取れる。
 *
 * 流れ:
 * 1. 各出力ピンの値を、前回の結果 (なければ OFF) で初期化する
 * 2. 入力ピンごとに、そこへ値を送る出力ピン (配線の接続元) を引けるようにする
 * 3. 全部品を評価する。値が1つも変わらなくなったら安定したとみなして終える。
 *    maxIter 回繰り返しても変わり続ける場合は発振とみなす
 */
export function simulateCore(circuit: Circuit, prev?: SimResult, maxIter = 100): SimResult {
  // 1. 初期値。
  //    前回の値から始めるのは、ラッチのように出力が自分の入力に戻る回路で、保持している値を失わないため。
  //    OFF から始め直すと、保持していた値が失われる (落ち着かずに発振することもある)
  const values = new Map<string, boolean>();
  const flipFlops = new Map<string, FlipFlopState>();
  for (const c of circuit.components) {
    // 出力ピンのない OUTPUT も、表示する値を置くために pin 0 を持つ
    for (let p = 0; p < Math.max(outputCount(c.kind), 1); p++) {
      const k = pinKey(c.id, p);
      values.set(k, prev?.values.get(k) ?? false);
    }
    if (isFlipFlop(c.kind)) {
      // 内部状態 (Q と前回の CLK) を引き継ぎ、出力 Q / Q̄ をそれに合わせる
      const s = prev?.flipFlops.get(c.id) ?? { q: false, clk: false };
      flipFlops.set(c.id, { ...s });
      values.set(pinKey(c.id, 0), s.q);
      values.set(pinKey(c.id, 1), !s.q);
    }
  }

  // 2. 入力ピン (pinKey) → 接続元の出力ピン。入力ピンにつながる配線は1本だけなので、1つに決まる
  const driver = new Map<string, PinRef>();
  for (const w of circuit.wires) driver.set(pinKey(w.to.comp, w.to.pin), w.from);

  // 3. 値が変わらなくなるまで、全部品の評価を繰り返す
  for (let i = 0; i < maxIter; i++) {
    let changed = false;
    // 入力は、この回の評価を始める前の値 (snapshot) から読む。
    // 評価中に書き換えた値を同じ回のうちに読むと、部品を並べた順番で結果が変わってしまうため。
    // 全部品が同時に切り替わる扱いになり、値は1回の繰り返しで配線1本分ずつ伝わっていく
    const snapshot = new Map(values);
    const set = (k: string, v: boolean) => {
      if (v !== values.get(k)) {
        values.set(k, v);
        changed = true;
      }
    };
    for (const c of circuit.components) {
      // 入力ピンの値を集める。何もつながっていない入力ピンは OFF
      const ins: boolean[] = [];
      for (let p = 0; p < inputCount(c.kind); p++) {
        const d = driver.get(pinKey(c.id, p));
        ins.push(d ? (snapshot.get(pinKey(d.comp, d.pin)) ?? false) : false);
      }
      if (isFlipFlop(c.kind)) {
        // 状態はすぐに更新する。CLK の値も一緒に記録するので、同じ立ち上がりで2回動くことはない。
        // ゲート遅延がないため、CLK と D などが同じ操作で同時に変わると、
        // どちらの変化が先に届くか (経由するゲートの段数) で、取り込む値が変わることがある
        const s = nextState(c.kind, ins, flipFlops.get(c.id)!);
        flipFlops.set(c.id, s);
        set(pinKey(c.id, 0), s.q);
        set(pinKey(c.id, 1), !s.q);
      } else {
        set(pinKey(c.id, 0), evalGate(c, ins));
      }
    }
    if (!changed) return { values, flipFlops, unstable: false };
  }
  // 規定回数を超えても値が変わり続けた。途中の値のまま返す
  return { values, flipFlops, unstable: true };
}

/**
 * 回路定義 id を最上位としてシミュレーションする (モジュールを展開してから評価する入口)。
 * 最上位に置かれたモジュールの出力ピンの値も values に含める。
 */
export function simulate(project: Project, id: string, prev?: SimResult): SimResult {
  const { circuit, modules } = flattenProject(project, id);
  const result = simulateCore(circuit, prev);
  for (const [compId, mod] of modules) {
    mod.outputs.forEach((id, pin) => result.values.set(pinKey(compId, pin), result.values.get(pinKey(id, 0)) ?? false));
  }
  return result;
}
