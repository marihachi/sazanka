// シート上の配置: グリッド、部品の大きさとピンの座標 (種類ごとの配置をマスから px に直す)、シートからはみ出さない位置、範囲選択。
// 部品の種類ごとの配置 (大きさ、輪郭、ピンの置き方) は parts/layouts.ts

import type { Component } from '../circuit/component';
import type { Ports } from '../circuit/module';
import type { PartLayout, PinPlacement, PinSide } from '../parts/layout';
import { layoutOf } from '../parts/layouts';

export const GRID = 20;

/** シート上の座標 */
export interface Point {
  x: number;
  y: number;
}

export function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

/** 部品本体のサイズ。部品の種類の配置 (parts/layouts.ts) のマスを px に直す */
export function bodySize(c: Component, ports: Ports): { w: number; h: number } {
  const { w, h } = layoutOf(c.kind, ports);
  return { w: w * GRID, h: h * GRID };
}

/** シート上のピン。線は根元 (本体の辺の上) から先端まで引き、配線は先端につなぐ */
export interface SheetPin {
  side: PinSide;
  base: Point;
  tip: Point;
}

/**
 * ピンの根元と先端の座標。先端は辺から 1 マス外。
 * 位置 (at) は本体の上端か左端からのマスなので、部品がグリッド上にあれば、ピンの先もグリッドに乗る。
 * 例: 幅 3 マスの部品が (100, 100) にあり、右の辺の 2 マスめのピンなら、先端は (100 + 4 × 20, 100 + 2 × 20) = (180, 140)
 */
export function sheetPin(c: Component, layout: PartLayout, p: PinPlacement): SheetPin {
  const right = c.x + layout.w * GRID;
  const bottom = c.y + layout.h * GRID;
  const along = p.at * GRID;
  switch (p.side) {
    case 'left':
      return {
        side: p.side,
        base: { x: c.x, y: c.y + along },
        tip: { x: c.x - GRID, y: c.y + along },
      };
    case 'right':
      return {
        side: p.side,
        base: { x: right, y: c.y + along },
        tip: { x: right + GRID, y: c.y + along },
      };
    case 'top':
      return {
        side: p.side,
        base: { x: c.x + along, y: c.y },
        tip: { x: c.x + along, y: c.y - GRID },
      };
    case 'bottom':
      return {
        side: p.side,
        base: { x: c.x + along, y: bottom },
        tip: { x: c.x + along, y: bottom + GRID },
      };
  }
}

/** 部品のすべてのピン。並び順はピン番号 */
export function sheetPinsOf(
  c: Component,
  ports: Ports,
): { inputs: SheetPin[]; outputs: SheetPin[] } {
  const layout = layoutOf(c.kind, ports);
  return {
    inputs: layout.inputs.map((p) => sheetPin(c, layout, p)),
    outputs: layout.outputs.map((p) => sheetPin(c, layout, p)),
  };
}

/** 入力ピンの先端座標 */
export function inputPinPos(c: Component, ports: Ports, pin: number): Point {
  const layout = layoutOf(c.kind, ports);
  const p = layout.inputs[pin];
  if (!p) {
    throw new Error(`入力ピン ${pin} がありません: ${c.kind}`);
  }
  return sheetPin(c, layout, p).tip;
}

/** 出力ピンの先端座標 */
export function outputPinPos(c: Component, ports: Ports, pin: number): Point {
  const layout = layoutOf(c.kind, ports);
  const p = layout.outputs[pin];
  if (!p) {
    throw new Error(`出力ピン ${pin} がありません: ${c.kind}`);
  }
  return sheetPin(c, layout, p).tip;
}

/**
 * 本体の外で、部品が占める幅 (px)。
 * 左右はピンの先まで取る (ピンのない辺も 1 マス)。上下は、その辺にピンがあればピンの先まで取る。
 * 上は、本体の上に書く名前 (モジュール名) の分も取る
 */
export function outerMargin(layout: PartLayout): Rect {
  const pins = [...layout.inputs, ...layout.outputs];
  const has = (side: PinSide) => pins.some((p) => p.side === side);
  return {
    left: GRID,
    top: layout.nameAbove || has('top') ? GRID : 0,
    right: GRID,
    bottom: has('bottom') ? GRID : 0,
  };
}

/** シートの幅と高さ (横 300 マス、縦 200 マス)。部品はこの中にだけ置ける */
export const SHEET_WIDTH = GRID * 300;
export const SHEET_HEIGHT = GRID * 200;

/** 部品の本体とピンが、シートからはみ出さないよう位置を補正する。補正後もグリッド上に乗るようにする */
export function clampPosition(c: Component, ports: Ports, p: Point): Point {
  const { w, h } = bodySize(c, ports);
  const m = outerMargin(layoutOf(c.kind, ports));
  const minX = m.left;
  const minY = m.top;
  // 右端と下端は「本体 + 外の幅」がシートに収まる位置。グリッドに乗るよう切り捨てる。
  // Math.max は、シートより大きな部品でも minX / minY を下回らないようにするため
  const maxX = Math.max(minX, Math.floor((SHEET_WIDTH - w - m.right) / GRID) * GRID);
  const maxY = Math.max(minY, Math.floor((SHEET_HEIGHT - h - m.bottom) / GRID) * GRID);
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

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** シート上で部品が占める範囲。本体に加え、ピンの先端と、本体の上に書く名前 (モジュール名) の分を含める */
export function componentBounds(c: Component, ports: Ports): Rect {
  const { w, h } = bodySize(c, ports);
  const m = outerMargin(layoutOf(c.kind, ports));
  return {
    left: c.x - m.left,
    top: c.y - m.top,
    right: c.x + w + m.right,
    bottom: c.y + h + m.bottom,
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
