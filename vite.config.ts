import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

interface PackageLicense {
  name: string;
  version: string;
  license: string;
  text: string;
}

/**
 * アプリに同梱するライブラリ (package.json の dependencies と、そこから辿れるもの) の、名前・版・ライセンス文。
 * MIT などは、配布物にライセンス文を含めることを条件にしているので、「このアプリについて」に表示する。
 * ライセンス文のファイルが見つからないものは、表示から漏れないよう、ビルドを止める
 */
function collectLicenses(): PackageLicense[] {
  const root = JSON.parse(readFileSync('package.json', 'utf8'));
  const found = new Map<string, PackageLicense>();
  const visit = (name: string) => {
    if (found.has(name)) return;
    const dir = join('node_modules', name);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)/i.test(f));
    if (!file) {
      throw new Error(`${name} のライセンス文のファイルが見つかりません`);
    }
    found.set(name, {
      name,
      version: pkg.version,
      license: pkg.license,
      text: readFileSync(join(dir, file), 'utf8').trim(),
    });
    Object.keys(pkg.dependencies ?? {}).forEach(visit);
  };
  Object.keys(root.dependencies ?? {}).forEach(visit);
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** collectLicenses の結果を、import 'virtual:licenses' で読めるようにする */
function licenses(): Plugin {
  const id = 'virtual:licenses';
  return {
    name: 'sazanka-licenses',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load: (source) =>
      source === `\0${id}`
        ? `export default ${JSON.stringify(collectLicenses())};`
        : undefined,
  };
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
  plugins: [react(), licenses()],
  css: {
    // CSS ではケバブケース、TS では styles.pinLabel のようにキャメルケースで参照する
    modules: { localsConvention: 'camelCaseOnly' },
  },
});
