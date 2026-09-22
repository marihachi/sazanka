// 利用者ごとの環境設定 (環境設定のウィンドウで変える)。プロジェクトには含めない。保存は app/storage.ts にある

export interface Preferences {
  /**
   * シミュレーションで 1 tick を進める間隔 (ms)。大きいほどゆっくり進む。
   * CLOCK の周期も tick 数で決まるので、同じだけ伸びる
   */
  tickMs: number;
  /** シートに方眼を表示するか */
  showGrid: boolean;
  /** アクセントカラー (#rrggbb)。style.css の --accent を差し替える */
  accent: string;
}

export const DEFAULT_PREFERENCES: Preferences = { tickMs: 10, showGrid: true, accent: '#20b2aa' };

/** すぐに選べるアクセントカラー。先頭が既定 */
export const ACCENT_PRESETS: { value: string; label: string }[] = [
  // ロゴの色 (style.css の --brand) と同じ
  { value: '#20b2aa', label: '青緑' },
  { value: '#60a5fa', label: '青' },
  { value: '#a78bfa', label: '紫' },
  { value: '#f472b6', label: 'ピンク' },
  { value: '#fb923c', label: 'オレンジ' },
  { value: '#a3e635', label: '黄緑' },
];

/** アクセントカラーとして使える値か (#rrggbb) */
export function isAccent(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
}

/** 入力できる間隔の範囲 (ms)。1 未満は、1 フレームで進める tick 数の上限に当たって、それ以上速くならない */
export const MIN_TICK_MS = 1;
export const MAX_TICK_MS = 1000;

/** 間隔として使える値か (範囲内の整数) */
export function isTickMs(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= MIN_TICK_MS && (v as number) <= MAX_TICK_MS;
}
