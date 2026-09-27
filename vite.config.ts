import license, { type Dependency } from 'rollup-plugin-license';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * ビルドに入ったライブラリのライセンス文を dist/licenses.txt に書き出す。
 * MIT などは、配布物にライセンス文を含めることを条件にしている。圧縮で JS の中のライセンスのコメントは消えるので、別のファイルで配る。
 * ライセンス文のファイルがないものは種類だけを、種類も分からないものは載せずに、ビルドのログに警告を出す
 */
function licensesText(dependencies: Dependency[]): string {
  return dependencies
    .filter((dep) => {
      if (!dep.license) {
        console.warn(`[licenses] ${dep.name}: ライセンスの種類が分からないため、一覧に載せません`);
        return false;
      }
      if (!dep.licenseText) {
        console.warn(
          `[licenses] ${dep.name}: ライセンス文のファイルがないため、種類 (${dep.license}) だけを載せます`,
        );
      }
      return true;
    })
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    .map(
      (dep) =>
        `${dep.name} ${dep.version} (${dep.license})

${dep.licenseText?.trim() ?? 'ライセンス文のファイルは同梱されていません'}`,
    )
    .join(`

${'-'.repeat(72)}

`);
}

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // ライブラリ (React など) とアプリのコードを別のチャンクに分ける。
        // ライブラリは変更が少ないので、アプリだけを直したときにブラウザのキャッシュが効く
        advancedChunks: {
          groups: [{ name: 'vendor', test: /node_modules/ }],
        },
      },
    },
  },
  // GitHub Pages では https://<ユーザー名>.github.io/sazanka/ に置かれるので、その位置から読めるようにする
  base: '/sazanka/',
  plugins: [
    react(),
    license({
      thirdParty: {
        output: { file: 'dist/licenses.txt', template: licensesText },
      },
    }),
  ],
  css: {
    // CSS ではケバブケース、TS では styles.pinLabel のようにキャメルケースで参照する
    modules: { localsConvention: 'camelCaseOnly' },
  },
});
