# ソースの構成

`src/` は次のように分けている（プロジェクトの方針）。

- `engine/` … 回路の計算処理（部品の評価、モジュールの展開、回路の編集、部品の大きさと配置）。React や DOM に依存させない。
- `components/` … 画面の部品。`app/` を import しない（表示に必要なものは props で受け取る）。回路を直接書き換えず、「移動した」「接続した」などの出来事をコールバックで知らせる。元に戻す対象にするかどうかは `app/` 側で決める（[編集と元に戻す](editing.md)）。
- `app/` … 画面全体の組み立てと状態、保存、クロック、ヒントの文言。
- `style.css` … 色の変数（`:root`）、ページ全体、`app/` の画面レイアウトのスタイルと、共通のユーティリティ（`.visually-hidden`）。
- `assets/` … SVG。

CSS は、コンポーネント固有のものならコンポーネントごとに CSS Modules で分けて `components/` に置き（例: `TabBar.tsx` と `TabBar.module.css`）、そのコンポーネントから `styles` として import する（プロジェクトの方針）。共通の `style.css` は `main.tsx` で各コンポーネントより先に読み込む。

- CSS のクラス名はケバブケースで書き、TS からは `styles.tabInput` のようにキャメルケースで参照する（`vite.config.ts` の `localsConvention`）。存在しないクラス名を参照しても型エラーにならず、`undefined` になるだけなので注意。
- 条件付きのクラスは `components/classNames.ts` の `classNames` でつなげる。
- ほかのコンポーネントのクラスは直接使わない。見た目を共有したいときは、コンポーネントとして切り出す（例: ツールバーなどのボタンのアイコンは `Icons.tsx` の `ToolIcon`）。

依存の向きは `app` → `components` → `engine` の一方向に保つ。

テストは、React に依存しない処理について、対象のファイルと同じフォルダに置く（`engine/*.test.ts`、`app/history.test.ts`）。
