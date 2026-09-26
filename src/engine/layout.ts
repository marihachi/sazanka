// シート上の配置: グリッド、部品の大きさ、ピンの座標、シートからはみ出さない位置、配線の通り道

import { type Component, isFlipFlopKind } from './component';
import type { Ports } from './module';

export const GRID = 20;

/** シート上の座標 */
export interface Point {
  x: number;
  y: number;
}

export function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

/** 入出力の部品 (INPUT、CLOCK、HIGH、OUTPUT)。どれも小さな正方形で、ピンは中央に1本 */
function isTerminal(c: Component): boolean {
  return (
    c.kind === 'INPUT' ||
    c.kind === 'CLOCK' ||
    c.kind === 'HIGH' ||
    c.kind === 'OUTPUT'
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
    // Q と Q̄ は上下端から1グリッド内側
    y = pin === 0 ? c.y + GRID : c.y + h - GRID;
  } else if (c.kind === 'CUSTOM') {
    y = c.y + GRID * (pin + 1);
  } else {
    // 論理ゲート (と BUF) は1出力
    y = c.y + h / 2;
  }
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
  const maxX = Math.max(
    minX,
    Math.floor((SHEET_WIDTH - w - GRID) / GRID) * GRID,
  );
  const maxY = Math.max(minY, Math.floor((SHEET_HEIGHT - h) / GRID) * GRID);
  return {
    x: Math.min(Math.max(p.x, minX), maxX),
    y: Math.min(Math.max(p.y, minY), maxY),
  };
}

/**
 * 複数の部品をまとめて delta だけ動かすとき、どれもはみ出さないように delta を縮める。
 * 部品の今の位置がはみ出していないことが前提。今の位置と移動先の両方が収まっていれば、
 * その間も収まるので、後の部品のために delta を縮めても、先に調べた部品ははみ出さない
 */
export function clampMove(
  items: { c: Component; ports: Ports }[],
  delta: Point,
): Point {
  let d = delta;
  for (const { c, ports } of items) {
    const p = clampPosition(c, ports, { x: c.x + d.x, y: c.y + d.y });
    d = { x: p.x - c.x, y: p.y - c.y };
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

/**
 * 部品をまとめて、全体の中心が点 at に来るように動かすときの移動量。
 * グリッドに合わせ、シートからはみ出さないように縮める (貼り付ける位置に使う)
 */
export function placeOffset(
  items: { c: Component; ports: Ports }[],
  at: Point,
): Point {
  const rects = items.map(({ c, ports }) => componentBounds(c, ports));
  const cx =
    (Math.min(...rects.map((r) => r.left)) +
      Math.max(...rects.map((r) => r.right))) /
    2;
  const cy =
    (Math.min(...rects.map((r) => r.top)) +
      Math.max(...rects.map((r) => r.bottom))) /
    2;
  return clampMove(items, { x: snap(at.x - cx), y: snap(at.y - cy) });
}

/**
 * 配線が通る点の並び (曲がり角を含む)。from は出力ピンの先、to は入力ピンの先、points は利用者が置いた折れる点。
 * 点と点の間は縦横の線でつなぐ。出力ピンからは横に出て、入力ピンへは横から入るよう、
 * 最後の区間だけ縦→横、ほかは横→縦の順に曲がる。折れる点がなければ、中間で1回折れる形にする
 */
export function wireRoute(
  from: Point,
  points: readonly Point[],
  to: Point,
): Point[] {
  const route: Point[] = [from];
  if (points.length === 0) {
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
 * 中間で1回折れる形の配線なら、その縦線の x 座標。
 * 折れる点がないか、出力ピンと同じ高さに1つだけある (縦線を動かした) 形が対象。縦線がない (両端が同じ高さ) ときは undefined
 */
export function wireMiddleX(
  from: Point,
  points: readonly Point[],
  to: Point,
): number | undefined {
  if (from.y === to.y) {
    return undefined;
  }
  if (points.length === 0) {
    return snap((from.x + to.x) / 2);
  }
  if (points.length === 1 && points[0].y === from.y) {
    return points[0].x;
  }
  return undefined;
}
