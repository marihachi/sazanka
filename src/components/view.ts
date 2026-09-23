// シートの表示 (スクロールと拡大縮小): 回路の座標と画面の座標の変換。
// 部品の大きさや配置は engine/layout.ts、表示の保存は app/storage.ts にある

import {
  componentBounds,
  GRID,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  type Point,
  type Rect,
} from '../engine/layout';
import type { CircuitDef, Project } from '../engine/project';
import { portsOf } from '../engine/module';

/** シートの表示位置と倍率。画面の座標 = 回路の座標 × scale + (x, y) */
export interface View {
  x: number;
  y: number;
  scale: number;
}

export const MIN_SCALE = 0.2;
export const MAX_SCALE = 3;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** 画面の座標 (シートの左上からの位置) を、回路の座標にする */
export function toWorld(v: View, p: Point): Point {
  return { x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale };
}

export function toScreen(v: View, p: Point): Point {
  return { x: p.x * v.scale + v.x, y: p.y * v.scale + v.y };
}

/** 倍率を変える。画面の at の位置にある回路の点は、変えた後も同じ位置に残す */
export function zoomAt(v: View, at: Point, scale: number): View {
  const s = clampScale(scale);
  const w = toWorld(v, at);
  return { x: at.x - w.x * s, y: at.y - w.y * s, scale: s };
}

/** シートの中央を、幅 width・高さ height の画面の真ん中に置いた等倍の表示。部品のない回路はこの表示で開く (開発者の方針) */
export function centerView(width: number, height: number): View {
  return {
    x: width / 2 - SHEET_WIDTH / 2,
    y: height / 2 - SHEET_HEIGHT / 2,
    scale: 1,
  };
}

/**
 * シートの外 (部品を置けない範囲) が画面に映らないよう、表示をずらす。
 * シートが画面より小さい向き (縮小したとき) は、どうずらしても映るのでそのままにする
 */
function hideOutside(v: View, width: number, height: number): View {
  const clamp = (pos: number, screen: number, sheet: number) => {
    const size = sheet * v.scale;
    return size >= screen ? Math.min(0, Math.max(screen - size, pos)) : pos;
  };
  return {
    ...v,
    x: clamp(v.x, width, SHEET_WIDTH),
    y: clamp(v.y, height, SHEET_HEIGHT),
  };
}

/**
 * 範囲 bounds 全体が、幅 width・高さ height の画面の真ん中に収まる表示。
 * 小さな回路を大きく映しすぎないよう、等倍より大きくはしない。
 * 真ん中に置くとシートの外が映るときは、シートの端を画面の端に合わせる。bounds はシートの中にあるので、合わせても回路は画面に収まったまま
 */
export function fitView(bounds: Rect, width: number, height: number): View {
  const margin = GRID * 2;
  const w = bounds.right - bounds.left;
  const h = bounds.bottom - bounds.top;
  const scale = clampScale(
    Math.min(1, (width - margin * 2) / w, (height - margin * 2) / h),
  );
  const centered = {
    x: width / 2 - ((bounds.left + bounds.right) / 2) * scale,
    y: height / 2 - ((bounds.top + bounds.bottom) / 2) * scale,
    scale,
  };
  return hideOutside(centered, width, height);
}

/** 回路全体が占める範囲。部品がなければ undefined */
export function circuitBounds(
  circuit: CircuitDef,
  project: Project,
): Rect | undefined {
  const rects = circuit.components.map((c) =>
    componentBounds(c, portsOf(c, project)),
  );
  if (rects.length === 0) return undefined;
  return {
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  };
}

/**
 * 回路全体を表示する。部品がなければシートの中央。
 * 表示を保存していない回路を開いたときもこれを使う。既存の回路はシートの左上の近くに部品があるので、中央を表示すると隠れてしまうため
 */
export function overview(
  circuit: CircuitDef,
  project: Project,
  width: number,
  height: number,
): View {
  const bounds = circuitBounds(circuit, project);
  return bounds && width > 0 && height > 0
    ? fitView(bounds, width, height)
    : centerView(width, height);
}

/** 保存データから読んだ値が、表示として使えるか */
export function isView(v: unknown): v is View {
  if (typeof v !== 'object' || v === null) return false;
  const { x, y, scale } = v as Record<string, unknown>;
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(scale) &&
    (scale as number) >= MIN_SCALE &&
    (scale as number) <= MAX_SCALE
  );
}
