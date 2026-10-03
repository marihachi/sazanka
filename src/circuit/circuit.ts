// 回路 1 つ分のデータ構造。
// 部品のデータは component.ts (種類ごとの仕様は parts/)、複数の回路をまとめたプロジェクトは project.ts にある

import type { Component } from './component';
import { isObject } from '../util';

/** 回路 */
export interface Circuit {
  components: Component[];
  wires: Wire[];
}

/**
 * 配線。points を順に結んだ線で、どの区間も縦か横 (2 点以上)。
 * 部品とは参照でつながず、位置で接続を決める (geometry/net.ts)。
 * 端が部品のピンの先や、ほかの配線の上 (端・折れる点・途中) にあれば接続。途中どうしが交わるだけなら接続しない
 */
export interface Wire {
  id: string;
  points: { x: number; y: number }[];
}

export function isWire(w: unknown): w is Wire {
  return (
    isObject(w) &&
    typeof w.id === 'string' &&
    Array.isArray(w.points) &&
    w.points.length >= 2 &&
    w.points.every(isPoint) &&
    isAxisAligned(w.points as { x: number; y: number }[])
  );
}

/** どの区間も縦か横か */
function isAxisAligned(points: { x: number; y: number }[]): boolean {
  return points.every((p, i) => i === 0 || p.x === points[i - 1].x || p.y === points[i - 1].y);
}

export function isPoint(p: unknown): boolean {
  return isObject(p) && typeof p.x === 'number' && typeof p.y === 'number';
}

export interface PinRef {
  comp: string;
  pin: number;
}

export function isPinRef(p: unknown): p is PinRef {
  return (
    isObject(p) && typeof p.comp === 'string' && Number.isInteger(p.pin) && (p.pin as number) >= 0
  );
}

/** 部品・配線・回路の ID。回路の中で重ならなければよいので、短いランダムな文字列で足りる */
export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
