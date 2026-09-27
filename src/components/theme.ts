import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

/**
 * Chakra UI のテーマ。Chakra の既定の見た目をもとに、このアプリで要る色だけを足す。
 * 画面はダーク固定 (index.html の <html class="dark">) なので、色はダークの値だけを使う
 */
const config = defineConfig({
  globalCss: {
    // ボタンのフォーカスの枠などを、アクセントカラーで出す
    html: { colorPalette: 'accent' },
  },
  theme: {
    semanticTokens: {
      colors: {
        // アクセントカラーのパレット。元の色は環境設定で変わるので、App.tsx が差し替える --accent から作る
        // (Chakra の colorPalette が使う名前をそろえる)
        accent: {
          solid: { value: 'var(--accent)' },
          contrast: { value: '#fff' },
          fg: { value: 'color-mix(in srgb, var(--accent) 80%, #fff)' },
          muted: { value: 'color-mix(in srgb, var(--accent) 35%, #111)' },
          subtle: { value: 'color-mix(in srgb, var(--accent) 20%, #111)' },
          emphasized: { value: 'color-mix(in srgb, var(--accent) 50%, #111)' },
          focusRing: { value: 'var(--accent)' },
        },
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
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
