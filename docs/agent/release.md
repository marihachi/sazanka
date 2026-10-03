# 公開

GitHub Pages への公開と、ビルドの設定。

## 公開のしかた

- 公開先は `https://marihachi.logical-flower.net/sazanka/`（GitHub Pages）。
- 公開は GitHub Actions の Deploy（`.github/workflows/deploy.yml`）で行う。テストとビルドをしてから Pages に置く。
  - 動くきっかけは、`pages` ブランチへの push と、手動の実行（`workflow_dispatch`）。
  - 今は、main に push したあと、Deploy を手動で実行して公開している。
- Pages の公開元は、リポジトリの設定で「GitHub Actions」にしてある。ワークフローからは有効化しない。
- ワークフローでは整形チェックをしない。整形は手元で済ませる。
- 公開したあとは、利用者の手元に保存データが残る。保存データと共有用 JSON の形式を変えるときは、版を上げる必要があるかを確かめる（[保存データ](persistence.md)）。

## ビルドの設定

- 公開先ではリポジトリ名のフォルダ（`/sazanka/`）の下に置かれるので、`vite.config.ts` の `base` を `/sazanka/` にしている。公開先のパスが変わったら、`base` を直す。
- 「このアプリについて」に GitHub のリポジトリへのリンクがある（`app/AboutDialog.tsx`）。リポジトリ名が変わったら直す。
- ビルドした JS は、ライブラリ（`node_modules` のもの）とアプリのコードを別のチャンクに分ける（`vite.config.ts` の `advancedChunks`）。ライブラリは変更が少ないので、アプリだけを直して公開したときに、ブラウザのキャッシュが効く。
- ライセンスの一覧（`dist/licenses.txt`）もビルドで書き出す（[ライブラリとライセンス](licenses.md)）。

### 開発者からの指示

- ライブラリとアプリのコードを、別のチャンクに分ける。
