// 利用者ごとの環境設定 (環境設定のウィンドウで変える)。プロジェクトには含めない。保存は file/storage.ts にある
import type { LanguageSetting, Localized } from '../i18n/language';

export interface Preferences {
  /**
   * シミュレーションで 1 秒に進める tick 数。小さいほどゆっくり進む。
   * CLOCK の周期も tick 数で決まるので、同じだけ伸び縮みする。
   * 計算が間に合わないと、これより遅く進む (simulation/useSimulation.ts)
   */
  ticksPerSecond: number;
  /** シートに方眼を表示するか */
  showGrid: boolean;
  /** 配線の角を丸めるか */
  roundWires: boolean;
  /** アクセントカラー (#rrggbb)。テーマ (theme.ts) の --accent を差し替える */
  accent: string;
  /** 画面に出す言語。auto はブラウザの言語に合わせる (i18n/language.ts の resolveLanguage) */
  language: LanguageSetting;
}

export const DEFAULT_PREFERENCES: Preferences = {
  ticksPerSecond: 100,
  showGrid: true,
  roundWires: true,
  accent: '#20b2aa',
  language: 'auto',
};

/** すぐに選べるアクセントカラー。先頭が既定 */
export const ACCENT_PRESETS: { value: string; label: Localized<string> }[] = [
  // ロゴの色 (テーマの brand) と同じ
  { value: '#20b2aa', label: { ja: '青緑', en: 'Teal' } },
  { value: '#60a5fa', label: { ja: '青', en: 'Blue' } },
  { value: '#a78bfa', label: { ja: '紫', en: 'Purple' } },
  { value: '#f472b6', label: { ja: 'ピンク', en: 'Pink' } },
  { value: '#fb923c', label: { ja: 'オレンジ', en: 'Orange' } },
  { value: '#a3e635', label: { ja: '黄緑', en: 'Lime' } },
];

/** アクセントカラーとして使える値か (#rrggbb) */
export function isAccent(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
}

/** 入力できる、1 秒に進める tick 数の範囲 */
export const MIN_TICKS_PER_SECOND = 1;
export const MAX_TICKS_PER_SECOND = 100_000;

/** 1 秒に進める tick 数として使える値か (範囲内の整数) */
export function isTicksPerSecond(v: unknown): v is number {
  return (
    Number.isInteger(v) &&
    (v as number) >= MIN_TICKS_PER_SECOND &&
    (v as number) <= MAX_TICKS_PER_SECOND
  );
}
