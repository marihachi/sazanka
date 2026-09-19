import type { Ports } from './project';
import { isFlipFlop, type Component } from './sim';

export const GRID = 20;

export interface Point {
  x: number;
  y: number;
}

export function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

/** 部品本体のサイズ */
export function bodySize(c: Component, ports: Ports): { w: number; h: number } {
  if (c.kind === 'INPUT' || c.kind === 'CLOCK' || c.kind === 'OUTPUT') return { w: 40, h: 40 };
  if (c.kind === 'CUSTOM') {
    const n = Math.max(ports.inputs.length, ports.outputs.length, 1);
    return { w: 80, h: (n + 1) * GRID };
  }
  return isFlipFlop(c.kind) ? { w: 60, h: 80 } : { w: 60, h: 60 };
}

/** 入力ピンの先端座標 */
export function inputPinPos(c: Component, ports: Ports, pin: number): Point {
  const { h } = bodySize(c, ports);
  const y = c.kind !== 'CUSTOM' && ports.inputs.length === 1 ? c.y + h / 2 : c.y + GRID * (pin + 1);
  return { x: c.x - GRID, y };
}

/** 出力ピンの先端座標 */
export function outputPinPos(c: Component, ports: Ports, pin: number): Point {
  const { w, h } = bodySize(c, ports);
  let y: number;
  if (c.kind === 'CUSTOM') y = c.y + GRID * (pin + 1);
  // 2出力 (Q, Q̄) は上下端から1グリッド内側
  else if (ports.outputs.length === 2) y = pin === 0 ? c.y + GRID : c.y + h - GRID;
  else y = c.y + h / 2;
  return { x: c.x + w + GRID, y };
}

/**
 * 部品の本体とピンが、幅 width・高さ height の領域に収まるよう位置を補正する。
 * 補正後もグリッド上に乗るようにする。
 */
export function clampPosition(c: Component, ports: Ports, p: Point, width: number, height: number): Point {
  const { w, h } = bodySize(c, ports);
  // 左右はピンの先端まで、上はモジュール名 (本体の上に描く) の分も含める
  const minX = GRID;
  const minY = c.kind === 'CUSTOM' ? GRID : 0;
  const maxX = Math.max(minX, Math.floor((width - w - GRID) / GRID) * GRID);
  const maxY = Math.max(minY, Math.floor((height - h) / GRID) * GRID);
  return {
    x: Math.min(Math.max(p.x, minX), maxX),
    y: Math.min(Math.max(p.y, minY), maxY),
  };
}
