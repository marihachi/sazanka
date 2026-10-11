// 回路 1 つ分のデータ構造。
// 部品のデータは part.ts (種類ごとの仕様は parts/)、複数の回路をまとめたプロジェクトは project.ts にある

import type { Part } from './part';
import { isObject } from '../util';

/** 回路 */
export interface Circuit {
  parts: Part[];
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

/**
 * 保存データの配線として正しい形か。種類 (kind) が普通の配線 (wire) で、点が 2 つ以上あり、どの区間も縦か横。
 * 知らない種類は断る (あとで種類を足したとき、古いアプリが普通の配線として読み違えないため)。
 * ID は保存しないので見ない (あっても読み込むときに捨てる)
 */
export function isWire(w: unknown): boolean {
  return (
    isObject(w) &&
    w.kind === 'wire' &&
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

/** 点として正しい形か。保存データの座標はマス単位なので、整数でなければならない */
export function isPoint(p: unknown): boolean {
  return isObject(p) && Number.isInteger(p.x) && Number.isInteger(p.y);
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

/**
 * 部品・配線・回路の新しい ID。プロジェクトをまたいでも重ならないものにするため、UUID (version 4。122 ビットの乱数) を使う。
 * 一度付けた ID は、保存・書き出し・読み込みで付け直さない (形式の文書の「ID の付け方」)。
 * crypto.randomUUID は安全な接続 (https か localhost) でしか使えず、開発サーバーに http でつなぐと例外になるので、
 * どこでも使える crypto.getRandomValues で同じ形を作る
 */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // UUID version 4 の決まり: 7 バイトめの上位 4 ビットは版 (4)、9 バイトめの上位 2 ビットは 10 (RFC 9562 の variant)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  // 8-4-4-4-12 桁に区切る (例: 3f2a9c1e-7b4d-4e8a-9f01-2c3d4e5f6a7b)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
