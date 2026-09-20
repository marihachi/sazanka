# ソースの構成

`src/` は次のように分けている（プロジェクトの方針）。

- `engine/` … 回路のデータと計算処理。React や DOM に依存させない。
  - `circuit.ts` … 回路1つ分のデータと、部品の種類ごとの仕様
  - `project.ts` … プロジェクトの構造、モジュールのピン、データの検証
  - `sim.ts` … 回路の評価
  - `flatten.ts` … モジュールの展開
  - `edit.ts` … 回路の編集
  - `layout.ts` … 部品の大きさとピンの座標
  - `share.ts` … 共有用 JSON
  - `util.ts` … 型を問わない小さな判定
- `components/` … 画面の部品。`app/` を import しない（表示に必要なものは props で受け取る）。回路を直接書き換えず、「移動した」「接続した」などの出来事をコールバックで知らせる。元に戻す対象にするかどうかは `app/` 側で決める（[編集と元に戻す](editing.md)）。
  - 各コンポーネントと、その CSS。`parts.ts` … 部品の表示名とドラッグの受け渡し。`classNames.ts` … クラス名の連結
- `app/` … 画面全体の組み立てと状態。
  - `App.tsx` … 画面の組み立てと編集操作
  - `storage.ts` … localStorage への保存
  - `history.ts`、`useProjectHistory.ts`、`switchStates.ts` … 元に戻す / やり直し
  - `useClock.ts` … クロックの進行。`useShortcuts.ts` … キーボード操作。`hints.ts` … ヒントの文言
- `style.css` … 色の変数とページ全体のスタイル。どのコンポーネントからも使うものだけを置く。
- `assets/` … SVG。

CSS は、コンポーネント固有のものならコンポーネントごとに CSS Modules で分けて `components/` に置き（例: `TabBar.tsx` と `TabBar.module.css`）、そのコンポーネントから `styles` として import する（プロジェクトの方針）。共通の `style.css` は `main.tsx` で各コンポーネントより先に読み込む。

- CSS のクラス名はケバブケース、TS からの参照はキャメルケース（`vite.config.ts` の `localsConvention`）。存在しないクラス名を参照しても型エラーにならず `undefined` になるだけなので、追加・改名のときは両方を見比べること。
- ほかのコンポーネントのクラスは直接使わない。見た目を共有したいときは、コンポーネントとして切り出す（例: ツールバーなどのボタンのアイコンは `Icons.tsx` の `ToolIcon`）。

依存の向きは `app` → `components` → `engine` の一方向に保つ。

テストは、React に依存しない処理について、対象のファイルと同じフォルダに、同じ名前で置く（`sim.ts` なら `sim.test.ts`）。対象のファイルを分けたり名前を変えたりしたら、テストも合わせる。
