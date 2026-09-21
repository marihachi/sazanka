// 利用者ごとの環境設定 (環境設定のウィンドウで変える)。プロジェクトには含めない。保存は app/storage.ts にある

export interface Preferences {
  /**
   * シミュレーションで 1 段 (1 tick) を進める間隔 (ms)。大きいほどゆっくり進む。
   * CLOCK の周期も tick 数で決まるので、同じだけ伸びる
   */
  tickMs: number;
  /** シートに方眼を表示するか */
  showGrid: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = { tickMs: 10, showGrid: true };

/** 入力できる間隔の範囲 (ms)。1 未満は、1 フレームで進める tick 数の上限に当たって、それ以上速くならない */
export const MIN_TICK_MS = 1;
export const MAX_TICK_MS = 1000;

/** 間隔として使える値か (範囲内の整数) */
export function isTickMs(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= MIN_TICK_MS && (v as number) <= MAX_TICK_MS;
}
