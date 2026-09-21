// 回路 1 つ分のデータ構造。
// 部品の種類の仕様は component.ts、複数の回路をまとめたプロジェクトは project.ts にある

import type { Component } from './component';

/** 回路 */
export interface Circuit {
  components: Component[];
  wires: Wire[];
}

export interface Wire {
  id: string;
  from: PinRef; // 出力ピン
  to: PinRef; // 入力ピン
}

export interface PinRef {
  comp: string;
  pin: number;
}

/** 部品・配線・回路の ID。回路の中で重ならなければよいので、短いランダムな文字列で足りる */
export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
