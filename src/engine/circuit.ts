// 回路 1 つ分のデータ構造。
// 部品の種類の仕様は component.ts、複数の回路をまとめたプロジェクトは project.ts にある

import type { Component } from './component';
import { isObject } from './util';

/** 回路 */
export interface Circuit {
  components: Component[];
  wires: Wire[];
}

export interface Wire {
  id: string;
  from: PinRef; // 出力ピン
  to: PinRef; // 入力ピン
  /** 利用者が置いた、配線の折れる点 (シートの座標、並び順に通る)。なければ中間で1回折れる形 */
  points?: { x: number; y: number }[];
}

export function isWire(w: unknown): w is Wire {
  return (
    isObject(w) &&
    typeof w.id === 'string' &&
    isPinRef(w.from) &&
    isPinRef(w.to) &&
    (w.points === undefined || (Array.isArray(w.points) && w.points.every(isPoint)))
  );
}

export function isPoint(p: unknown): boolean {
  return isObject(p) && typeof p.x === 'number' && typeof p.y === 'number';
}

export interface PinRef {
  comp: string;
  pin: number;
}

export function isPinRef(p: unknown): p is Wire['from'] {
  return isObject(p) && typeof p.comp === 'string' && Number.isInteger(p.pin) && (p.pin as number) >= 0;
}

/** 部品・配線・回路の ID。回路の中で重ならなければよいので、短いランダムな文字列で足りる */
export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
