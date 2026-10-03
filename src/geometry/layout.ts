// シート上の配置: グリッド、部品の大きさ、ピンの座標、シートからはみ出さない位置、範囲選択

import { type Component, isFlipFlopKind } from '../circuit/component';
import type { Ports } from '../circuit/module';
import { partSpecOf } from '../parts/specs';

export const GRID = 20;

/** シート上の座標 */
export interface Point {
  x: number;
  y: number;
}

export function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

/**
 * 入出力の部品 (INPUT、CLOCK、OUTPUT と、parts/ で形を端子にした HIGH など)。
 * どれも小さな正方形で、ピンは中央に1本
 */
function isTerminal(c: Component): boolean {
  return (
    c.kind === 'INPUT' ||
    c.kind === 'CLOCK' ||
    c.kind === 'OUTPUT' ||
    partSpecOf(c.kind)?.shape === 'terminal'
  );
}

/**
 * 部品本体のサイズ。
 * 部品の位置はグリッド上にあるので、ピンの先端もグリッド上に来るよう、高さはピンの並びに合わせて決めている
 */
export function bodySize(c: Component, ports: Ports): { w: number; h: number } {
  if (isTerminal(c)) {
    return { w: 40, h: 40 };
  } else if (isFlipFlopKind(c.kind)) {
    return { w: 60, h: 80 };
  } else if (c.kind === 'CUSTOM') {
    // ピンは上から 1 マスおき (GRID * (pin + 1)) に並ぶので、多い方のピンの数 + 1 マスの高さにする。
    // 例: ピンが 3 本なら、ピンは y + 20, 40, 60 で、高さは 80
    const n = Math.max(ports.inputs.length, ports.outputs.length, 1);
    return { w: 80, h: (n + 1) * GRID };
  } else {
    // 論理ゲート (と、モジュールの展開でだけ作られる BUF)。
    // 2入力を上下端から1グリッド内側、出力を中央に置いて、すべてグリッドに乗る高さ
    return { w: 60, h: 80 };
  }
}

/** 入力ピンの先端座標 */
export function inputPinPos(c: Component, ports: Ports, pin: number): Point {
  const { h } = bodySize(c, ports);
  let y: number;
  if (isTerminal(c)) {
    // 入力ピンがあるのは OUTPUT だけ (1本)
    y = c.y + h / 2;
  } else if (isFlipFlopKind(c.kind)) {
    // 記憶素子: 上から 1 マスおき (y + 20, 40, 60)。高さ 80 に 3 本まで並ぶ
    y = c.y + GRID * (pin + 1);
  } else if (c.kind === 'CUSTOM') {
    y = c.y + GRID * (pin + 1);
  } else {
    // 論理ゲート: 1入力 (NOT、BUF) は中央、2入力は上下端から1グリッド内側
    if (ports.inputs.length === 1) {
      y = c.y + h / 2;
    } else {
      y = pin === 0 ? c.y + GRID : c.y + h - GRID;
    }
  }
  // ピンの先は、本体の左端から 1 マス左
  return { x: c.x - GRID, y };
}

/** 出力ピンの先端座標 */
export function outputPinPos(c: Component, ports: Ports, pin: number): Point {
  const { w, h } = bodySize(c, ports);
  let y: number;
  if (isTerminal(c)) {
    // 出力ピンがあるのは OUTPUT 以外 (1本)
    y = c.y + h / 2;
  } else if (isFlipFlopKind(c.kind)) {
    // Q と Q̄ は上下端から1グリッド内側 (高さ 80 なので y + 20 と y + 60)
    y = pin === 0 ? c.y + GRID : c.y + h - GRID;
  } else if (c.kind === 'CUSTOM') {
    y = c.y + GRID * (pin + 1);
  } else {
    // 論理ゲート (と BUF) は1出力
    y = c.y + h / 2;
  }
  // ピンの先は、本体の右端から 1 マス右
  return { x: c.x + w + GRID, y };
}

/** シートの幅と高さ (横 300 マス、縦 200 マス)。部品はこの中にだけ置ける */
export const SHEET_WIDTH = GRID * 300;
export const SHEET_HEIGHT = GRID * 200;

/** 部品の本体とピンが、シートからはみ出さないよう位置を補正する。補正後もグリッド上に乗るようにする */
export function clampPosition(c: Component, ports: Ports, p: Point): Point {
  const { w, h } = bodySize(c, ports);
  // 左右はピンの先端まで、上はモジュール名 (本体の上に描く) の分も含める
  const minX = GRID;
  const minY = c.kind === 'CUSTOM' ? GRID : 0;
  // 右端は「本体の幅 + 右のピンの 1 マス」がシートに収まる位置。グリッドに乗るよう切り捨てる。
  // Math.max は、シートより大きな部品でも minX / minY を下回らないようにするため
  const maxX = Math.max(minX, Math.floor((SHEET_WIDTH - w - GRID) / GRID) * GRID);
  const maxY = Math.max(minY, Math.floor((SHEET_HEIGHT - h) / GRID) * GRID);
  return {
    x: Math.min(Math.max(p.x, minX), maxX),
    y: Math.min(Math.max(p.y, minY), maxY),
  };
}

/**
 * 複数の部品と配線の点をまとめて delta だけ動かすとき、どれもはみ出さないように delta を縮める。
 * 部品と点の今の位置がはみ出していないことが前提。今の位置と移動先の両方が収まっていれば、
 * その間も収まるので、後のもののために delta を縮めても、先に調べたものははみ出さない
 */
export function clampMove(
  items: { c: Component; ports: Ports }[],
  delta: Point,
  points: readonly Point[] = [],
): Point {
  // 部品を 1 つずつ、移動先がはみ出すなら delta を縮める (はみ出す向きの成分だけが 0 に近づく)
  let d = delta;
  for (const { c, ports } of items) {
    const p = clampPosition(c, ports, { x: c.x + d.x, y: c.y + d.y });
    d = { x: p.x - c.x, y: p.y - c.y };
  }
  // 配線の点は、シートの範囲 (端を含む) に収める
  for (const p of points) {
    const x = Math.min(Math.max(p.x + d.x, 0), SHEET_WIDTH);
    const y = Math.min(Math.max(p.y + d.y, 0), SHEET_HEIGHT);
    d = { x: x - p.x, y: y - p.y };
  }
  return d;
}

/** シート上で部品が占める範囲。本体に加え、左右のピンの先端と、モジュール名の分を含める */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function componentBounds(c: Component, ports: Ports): Rect {
  const { w, h } = bodySize(c, ports);
  return {
    left: c.x - GRID,
    top: c.kind === 'CUSTOM' ? c.y - GRID : c.y,
    right: c.x + w + GRID,
    bottom: c.y + h,
  };
}

/** 点 a と点 b を対角とする範囲に、本体の全体が収まる部品の ID */
export function componentsInRect(
  items: { c: Component; ports: Ports }[],
  a: Point,
  b: Point,
): string[] {
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  return items
    .filter(({ c, ports }) => {
      const { w, h } = bodySize(c, ports);
      return c.x >= left && c.y >= top && c.x + w <= right && c.y + h <= bottom;
    })
    .map(({ c }) => c.id);
}

/** 点 a と点 b を対角とする範囲に、すべての点が収まる配線の ID */
export function wiresInRect(
  wires: readonly { id: string; points: readonly Point[] }[],
  a: Point,
  b: Point,
): string[] {
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  return wires
    .filter((w) =>
      w.points.every((p) => p.x >= left && p.x <= right && p.y >= top && p.y <= bottom),
    )
    .map((w) => w.id);
}

/**
 * 部品と配線の点をまとめて、全体の中心が点 at に来るように動かすときの移動量。
 * グリッドに合わせ、シートからはみ出さないように縮める (貼り付ける位置に使う)
 */
export function placeOffset(
  items: { c: Component; ports: Ports }[],
  points: readonly Point[],
  at: Point,
): Point {
  // 全体の範囲 (各部品の範囲と配線の点を囲む長方形) の中心 cx, cy を求め、それが at に来る移動量にする
  const rects = [
    ...items.map(({ c, ports }) => componentBounds(c, ports)),
    ...points.map((p) => ({ left: p.x, top: p.y, right: p.x, bottom: p.y })),
  ];
  const cx = (Math.min(...rects.map((r) => r.left)) + Math.max(...rects.map((r) => r.right))) / 2;
  const cy = (Math.min(...rects.map((r) => r.top)) + Math.max(...rects.map((r) => r.bottom))) / 2;
  return clampMove(items, { x: snap(at.x - cx), y: snap(at.y - cy) }, points);
}

/**
 * 配線中の点の並びを整える。同じ点が続くところと、前後とまっすぐ並んで、その間にある点 (曲がらない点) を省く。
 * 例: (0,0) → (40,0) → (80,0) は (0,0) → (80,0)。折り返す点 ((0,0) → (80,0) → (40,0) の (80,0)) は残す
 */
export function simplifyWire(points: readonly Point[]): Point[] {
  const distinct = points.filter(
    (p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y,
  );
  const out: Point[] = [];
  for (const p of distinct) {
    const a = out[out.length - 2];
    const b = out[out.length - 1];
    // a → b → p が同じ直線の上で、b が a と p の間にあれば、b は曲がらない点なので省く
    const between =
      a &&
      b &&
      ((a.x === b.x && b.x === p.x && (b.y - a.y) * (p.y - b.y) > 0) ||
        (a.y === b.y && b.y === p.y && (b.x - a.x) * (p.x - b.x) > 0));
    if (between) {
      out.pop();
    }
    out.push(p);
  }
  return out;
}

/**
 * 配線中に、最後の点 from からポインターの位置 at へ伸ばす区間の先。
 * 縦か横の 1 方向にだけ伸ばすので、動いた量の大きい方の向きにまっすぐ進んだ点にする
 */
export function wireStepTo(from: Point, at: Point): Point {
  return Math.abs(at.x - from.x) >= Math.abs(at.y - from.y)
    ? { x: at.x, y: from.y }
    : { x: from.x, y: at.y };
}
