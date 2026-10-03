import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

/**
 * Chakra UI のテーマ。Chakra の既定の見た目をもとに、このアプリで要る色だけを足す。
 * 画面はダーク固定 (index.html の <html class="dark">) なので、色はダークの値だけを使う
 */
const config = defineConfig({
  globalCss: {
    html: {
      // ボタンのフォーカスの枠などを、アクセントカラーで出す
      colorPalette: 'accent',
      // 既定のアクセントカラー。環境設定で変えると、App.tsx が差し替える (preferences.ts の既定値と合わせる)
      '--accent': '#20b2aa',
    },
    'html, body, #root': {
      height: '100%',
      // シートの背景の色 (シートの SVG は背景を塗らない)
      bg: 'sheet.bg',
      // アプリは画面全体に収める。一時的なはみ出しでページのスクロールバーを出さない
      overflow: 'hidden',
    },
  },
  theme: {
    semanticTokens: {
      colors: {
        // アクセントカラーのパレット。元の色は環境設定で変わるので、App.tsx が差し替える --accent から作る
        // (Chakra の colorPalette が使う名前をそろえる)。
        // 文字の色 (fg) は白に混ぜて明るくし、暗い背景の上で読めるようにする。
        // 背景や枠に使う色 (muted、subtle、emphasized) は、暗い色 (#111) に混ぜて暗くする。
        // アクセントカラーの割合が小さいほど背景に近い (subtle 20% < muted 35% < emphasized 50%)
        accent: {
          solid: { value: 'var(--accent)' },
          contrast: { value: '#fff' },
          fg: { value: 'color-mix(in srgb, var(--accent) 80%, #fff)' },
          muted: { value: 'color-mix(in srgb, var(--accent) 35%, #111)' },
          subtle: { value: 'color-mix(in srgb, var(--accent) 20%, #111)' },
          emphasized: { value: 'color-mix(in srgb, var(--accent) 50%, #111)' },
          focusRing: { value: 'var(--accent)' },
        },
        // ロゴの色。アクセントカラーと違い、環境設定では変わらない (ブラウザのタブのアイコン public/favicon.svg も同じ色)
        brand: { value: 'lightseagreen' },
        // シートの色。シートは性能のため CSS Modules のままなので、CSS の変数で参照する
        // (例: var(--chakra-colors-sheet-grid))
        sheet: {
          bg: { value: '#1c1c1c' },
          grid: { value: '#2a2a2a' },
          // 部品を置けない範囲
          outside: { value: '#121212' },
          // 値が 0 の配線とピン
          line: { value: '#888' },
          // 値が 1 の配線とピン
          on: { value: '#4fc3f7' },
          // 出力ピンが 2 つ以上つながって、値がぶつかっている配線
          conflict: { value: '#ef5350' },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
