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

/**
 * 部品本体のサイズ。
 * 部品の位置はグリッド上にあるので、ピンの先端もグリッド上に来るよう、高さはピンの並びに合わせて決めている
 */
export function bodySize(c: Component, ports: Ports): { w: number; h: number } {
  if (c.kind === 'INPUT' || c.kind === 'CLOCK' || c.kind === 'OUTPUT') {
    return { w: 40, h: 40 };
  } else if (isFlipFlop(c.kind)) {
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
  if (c.kind === 'INPUT' || c.kind === 'CLOCK' || c.kind === 'OUTPUT') {
    // 入力ピンがあるのは OUTPUT だけ (1本)
    y = c.y + h / 2;
  } else if (isFlipFlop(c.kind)) {
    y = c.y + GRID * (pin + 1);
  } else if (c.kind === 'CUSTOM') {
    y = c.y + GRID * (pin + 1);
  } else {
    // 論理ゲート: 1入力 (NOT、BUF) は中央、2入力は上下端から1グリッド内側
    if (ports.inputs.length === 1) y = c.y + h / 2;
    else y = pin === 0 ? c.y + GRID : c.y + h - GRID;
  }
  return { x: c.x - GRID, y };
}

/** 出力ピンの先端座標 */
export function outputPinPos(c: Component, ports: Ports, pin: number): Point {
  const { w, h } = bodySize(c, ports);
  let y: number;
  if (c.kind === 'INPUT' || c.kind === 'CLOCK' || c.kind === 'OUTPUT') {
    // 出力ピンがあるのは INPUT と CLOCK だけ (1本)
    y = c.y + h / 2;
  } else if (isFlipFlop(c.kind)) {
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
