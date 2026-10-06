// 形式 version 1 のプロジェクトを、version 2 の形に変える。保存データと共有用 JSON の両方で使い、upgrade.ts から呼ぶ。
// version 1 の配線は、出力ピンと入力ピンを部品 ID とピン番号で指し、形は通る点から自動で決めていた。
// version 2 の配線は、通る点の並びそのもの。形式は docs/format/archive/v1.md と docs/format/archive/v2.md。
//
// 今のアプリのコード (部品の型や検証、配置) には頼らない。今のコードが変わっても、この変換の結果が変わらないようにするため。
// 部品の確かめ方、ピンの数、ピンの先の位置は、version 2 の時点のもの (docs/format/archive/v2.md) をここに持つ。あとから直さない

import { isObject } from '../util';

/** 座標 (version 2 の配線の点) */
interface Point {
  x: number;
  y: number;
}

/** version 1 の配線の端。部品 ID とピン番号 (入力と出力で別々に 0 から) */
interface PinRef {
  comp: string;
  pin: number;
}

/** version 1 の部品のうち、変換で使う項目 */
interface ComponentV1 {
  id: string;
  kind: string;
  x: number;
  y: number;
  custom?: string;
}

const GRID = 20;

function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

function isPoint(p: unknown): p is Point {
  return isObject(p) && typeof p.x === 'number' && typeof p.y === 'number';
}

function isPinRef(p: unknown): p is PinRef {
  return (
    isObject(p) && typeof p.comp === 'string' && Number.isInteger(p.pin) && (p.pin as number) >= 0
  );
}

/** version 2 の時点で置けた部品の種類 */
const KINDS_V2 = new Set([
  'INPUT',
  'OUTPUT',
  'CLOCK',
  'HIGH',
  'AND',
  'OR',
  'NOT',
  'NAND',
  'NOR',
  'XOR',
  'XNOR',
  'RS',
  'RSEN',
  'DLATCH',
  'DFF',
  'TFF',
  'JKFF',
  'CUSTOM',
]);

/** ラッチ・フリップフロップ (出力は Q と Q̄ の 2 本) */
const FLIP_FLOPS_V2 = new Set(['RS', 'RSEN', 'DLATCH', 'DFF', 'TFF', 'JKFF']);

/** モジュール以外の種類の入力ピンの数 */
const INPUT_COUNTS_V2: Record<string, number> = {
  INPUT: 0,
  OUTPUT: 1,
  CLOCK: 0,
  HIGH: 0,
  AND: 2,
  OR: 2,
  NOT: 1,
  NAND: 2,
  NOR: 2,
  XOR: 2,
  XNOR: 2,
  RS: 2,
  RSEN: 3,
  DLATCH: 2,
  DFF: 2,
  TFF: 2,
  JKFF: 3,
};

/** 部品として正しい形か (version 2 の時点の検証と同じ) */
function isComponentV1(c: unknown): c is ComponentV1 {
  return (
    isObject(c) &&
    typeof c.id === 'string' &&
    typeof c.kind === 'string' &&
    KINDS_V2.has(c.kind) &&
    typeof c.x === 'number' &&
    typeof c.y === 'number' &&
    // CLOCK の周期は 2〜10000 の整数
    (c.period === undefined ||
      (Number.isInteger(c.period) && (c.period as number) >= 2 && (c.period as number) <= 10000))
  );
}

/** 部品の入力ピンと出力ピンの数。モジュールは、中の INPUT / OUTPUT の数 (見つからないモジュールは 0) */
function pinCounts(
  c: ComponentV1,
  circuits: { id: string; components: ComponentV1[] }[],
): { inputs: number; outputs: number } {
  if (c.kind === 'CUSTOM') {
    const def = circuits.find((d) => d.id === c.custom);
    const kinds = def?.components.map((k) => k.kind) ?? [];
    return {
      inputs: kinds.filter((k) => k === 'INPUT').length,
      outputs: kinds.filter((k) => k === 'OUTPUT').length,
    };
  }
  return {
    inputs: INPUT_COUNTS_V2[c.kind],
    outputs: c.kind === 'OUTPUT' ? 0 : FLIP_FLOPS_V2.has(c.kind) ? 2 : 1,
  };
}

/**
 * 入力ピンの先の位置 (version 2 の時点。docs/format/archive/v2.md の「ピンの先の位置」)。
 * ピンの先は本体の左端から 1 マス左。inputs はその部品の入力ピンの数
 */
function inputPinPosV2(c: ComponentV1, inputs: number, pin: number): Point {
  let dy: number;
  if (c.kind === 'INPUT' || c.kind === 'CLOCK' || c.kind === 'HIGH' || c.kind === 'OUTPUT') {
    // 40×40 の正方形の中央
    dy = 20;
  } else if (FLIP_FLOPS_V2.has(c.kind) || c.kind === 'CUSTOM') {
    // 上から 1 マスおき
    dy = GRID * (pin + 1);
  } else {
    // 論理ゲート (高さ 80): 1 入力は中央、2 入力は上下端から 1 マス内側
    dy = inputs === 1 ? 40 : pin === 0 ? 20 : 60;
  }
  return { x: c.x - GRID, y: c.y + dy };
}

/** 出力ピンの先の位置 (version 2 の時点)。ピンの先は本体の右端から 1 マス右 */
function outputPinPosV2(c: ComponentV1, pin: number): Point {
  if (c.kind === 'INPUT' || c.kind === 'CLOCK' || c.kind === 'HIGH' || c.kind === 'OUTPUT') {
    // 本体の幅 40
    return { x: c.x + 60, y: c.y + 20 };
  }
  if (FLIP_FLOPS_V2.has(c.kind)) {
    // 本体の幅 60。Q と Q̄ は上下端から 1 マス内側
    return { x: c.x + 80, y: c.y + (pin === 0 ? 20 : 60) };
  }
  if (c.kind === 'CUSTOM') {
    // 本体の幅 80。上から 1 マスおき
    return { x: c.x + 100, y: c.y + GRID * (pin + 1) };
  }
  // 論理ゲート: 本体の幅 60、高さ 80 の中央
  return { x: c.x + 80, y: c.y + 40 };
}

/** version 1 の配線 */
interface WireV1 {
  id: string;
  from: PinRef;
  to: PinRef;
  points?: Point[];
}

function isWireV1(w: unknown): w is WireV1 {
  return (
    isObject(w) &&
    typeof w.id === 'string' &&
    isPinRef(w.from) &&
    isPinRef(w.to) &&
    (w.points === undefined || (Array.isArray(w.points) && w.points.every(isPoint)))
  );
}

/**
 * version 1 の配線が通る点の並び (曲がり角を含む)。version 1 のアプリが描いていた形と同じにする。
 * from は出力ピンの先、to は入力ピンの先、points は利用者が置いた折れる点。
 * 出力ピンからは横に出て、入力ピンへは横から入るよう、最後の区間だけ縦→横、ほかは横→縦の順に曲がる。
 * 折れる点がなければ、中間で1回折れる形にする
 */
export function routeV1(from: Point, points: readonly Point[], to: Point): Point[] {
  // 例: 折れる点が p 1 つなら from → (p.x, from.y) → p → (p.x, to.y) → to
  const route: Point[] = [from];
  if (points.length === 0) {
    // 両端の x の真ん中 (グリッドに合わせる) で縦に折れる
    const mid = snap((from.x + to.x) / 2);
    route.push({ x: mid, y: from.y }, { x: mid, y: to.y });
  } else {
    let cur = from;
    for (const p of points) {
      route.push({ x: p.x, y: cur.y }, p);
      cur = p;
    }
    route.push({ x: cur.x, y: to.y });
  }
  route.push(to);
  return simplify(route);
}

/**
 * 同じ点が続くところと、前後とまっすぐ並んで曲がらない点を省く。
 * 両端が同じ高さのときなどに、長さ 0 の区間や、曲がらない「角」が残らないようにする
 */
function simplify(route: Point[]): Point[] {
  // 1 回目: 直前と同じ点を除く。2 回目: 前後と同じ縦線か横線の上にある点 (曲がらない点) を除く
  const distinct = route.filter(
    (p, i) => i === 0 || p.x !== route[i - 1].x || p.y !== route[i - 1].y,
  );
  return distinct.filter((p, i) => {
    if (i === 0 || i === distinct.length - 1) {
      return true;
    }
    const [a, b] = [distinct[i - 1], distinct[i + 1]];
    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
  });
}

/**
 * version 1 のプロジェクトの配線を、通る点の並びに変える。
 * 存在しない部品やピンを指す配線は、位置が決まらないので捨てる。
 * 形が正しくないデータは、配線をそのまま残す (このあとの検証 checkProject で断る)
 */
export function upgradeV1(project: unknown): unknown {
  if (!isObject(project) || !Array.isArray(project.circuits)) {
    return project;
  }
  const raws = project.circuits as unknown[];
  // モジュールのピンの数を引くのに、回路の ID と部品だけを見る
  const valid = raws.every(
    (d) =>
      isObject(d) &&
      typeof d.id === 'string' &&
      Array.isArray(d.components) &&
      d.components.every(isComponentV1),
  );
  if (!valid) {
    return project;
  }
  const circuits = raws as { id: string; components: ComponentV1[] }[];
  return {
    ...project,
    circuits: circuits.map((raw) => {
      const d = raw as { components: ComponentV1[]; wires?: unknown };
      if (!Array.isArray(d.wires)) {
        return d;
      }
      const comps = new Map(d.components.map((c) => [c.id, c]));
      const wires = d.wires.flatMap((w): unknown[] => {
        if (!isWireV1(w)) {
          return [w];
        }
        const from = comps.get(w.from.comp);
        const to = comps.get(w.to.comp);
        if (!from || !to) {
          return [];
        }
        const fromPins = pinCounts(from, circuits);
        const toPins = pinCounts(to, circuits);
        if (w.from.pin >= fromPins.outputs || w.to.pin >= toPins.inputs) {
          return [];
        }
        const points = routeV1(
          outputPinPosV2(from, w.from.pin),
          w.points ?? [],
          inputPinPosV2(to, toPins.inputs, w.to.pin),
        );
        // 両端が同じ点になる配線 (出力ピンと入力ピンが重なっている) は、点が 1 つになるので捨てる
        return points.length >= 2 ? [{ id: w.id, points }] : [];
      });
      return { ...d, wires };
    }),
  };
}
