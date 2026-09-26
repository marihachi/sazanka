# ソースの構成

`src/` の今の構成（プロジェクトの方針）。構成を変えるときの決め方は[コードの置き場所の決め方](code-placement.md)にある。

- `engine/` … 回路のデータと計算処理。React や DOM に依存させない。
  - `component.ts` … 部品のデータと、部品の種類ごとの仕様（置ける種類の一覧、ピン、遅延）
  - `circuit.ts` … 回路1つ分のデータ（部品と配線）
  - `project.ts` … プロジェクト（メイン回路と複数のモジュール）の構造と、データの検証
  - `module.ts` … モジュールのピンの決め方と、回路同士の依存
  - この4つは、後に挙げたものが前に挙げたものだけを使う（`component` ← `circuit` ← `project` ← `module`）。
  - `sim.ts` … 回路の評価（1 tick ずつ進める）
  - `flatten.ts` … モジュールの展開
  - `edit.ts` … 回路の編集
  - `layout.ts` … 部品の大きさとピンの座標
  - `share.ts` … 共有用 JSON
  - `util.ts` … 型を問わない小さな判定
- `components/` … 画面の部品。`app/` を import しない（表示に必要なものは props で受け取る）。回路を直接書き換えず、「移動した」「接続した」などの出来事をコールバックで知らせる。元に戻す対象にするかどうかは `app/` 側で決める（[編集と元に戻す](editing.md)）。
  - 各コンポーネントと、その CSS。`parts.ts` … 部品の表示名とドラッグの受け渡し。`view.ts` … シートの表示位置と倍率（回路の座標と画面の座標の変換）。`preferences.ts` … 環境設定の型と選択肢。`classNames.ts` … クラス名の連結
- `app/` … 画面全体の組み立てと状態。
  - `App.tsx` … 画面の組み立てと編集操作
  - `storage.ts` … localStorage への保存
  - `history.ts`、`useProjectHistory.ts`、`switchStates.ts` … 元に戻す / やり直し
  - `useSimulation.ts` … 時間を進めるシミュレーションと、一時停止・1 tick 送り。`useShortcuts.ts` … キーボード操作。`hints.ts` … ヒントの文言
- `style.css` … 色の変数とページ全体のスタイル。どのコンポーネントからも使うものだけを置く。
- `assets/` … SVG。

CSS は、コンポーネント固有のものならコンポーネントごとに CSS Modules で分けて `components/` に置き（例: `TabBar.tsx` と `TabBar.module.css`）、そのコンポーネントから `styles` として import する（プロジェクトの方針）。共通の `style.css` は `main.tsx` で各コンポーネントより先に読み込む。

- CSS のクラス名はケバブケース、TS からの参照はキャメルケース（`vite.config.ts` の `localsConvention`）。存在しないクラス名を参照しても型エラーにならず `undefined` になるだけなので、追加・改名のときは両方を見比べること。
- ほかのコンポーネントのクラスは直接使わない。見た目を共有したいときは、コンポーネントとして切り出す（例: ヘッダーやツールバーのボタンは `ToolButton.tsx`）。

フォルダ同士の依存の向きは `app` → `components` → `engine` の一方向に保つ。フォルダの中のファイル同士も同じ考え方で一方向にする（[依存が一方向になるように分ける](code-placement.md#依存が一方向になるように分ける)）。

テストは、React に依存しない処理について、対象のファイルと同じフォルダに、同じ名前で置く（`sim.ts` なら `sim.test.ts`）。対象のファイルを分けたり名前を変えたりしたら、テストも合わせる。
