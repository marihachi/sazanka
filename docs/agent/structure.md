# ソースの構成

`src/` の今の構成（プロジェクトの方針）。構成を変えるときの決め方は[コードの置き場所の決め方](code-placement.md)にある。

- `ui/` … 回路を知らない、共通の画面部品。`ToolButton.tsx` … ヘッダーやツールバーのボタン。`HintTooltip.tsx` … ツールチップ。`InlineInput.tsx` … その場で文字を編集する入力欄（タブの名前の変更）。`Icons.tsx` … 文字色で塗るアイコン。`classNames.ts` … クラス名の連結。`theme.ts` … Chakra UI のテーマ（色のトークン、アクセントカラーのパレット）。`DialogFrame.tsx` … ダイアログの共通の外枠。`ConfirmDialog.tsx`、`PromptDialog.tsx`、`TextDialog.tsx` … 確認とお知らせ、名前の入力、書き出し・読み込みのダイアログ
- `parts/` … 部品の種類（[部品の種類](parts.md)）。React に依存させない（`PartIcon.tsx` を除く）。
  - `<種類>/` … 1 種類 1 フォルダ。`spec.ts` … 仕様（ピン、遅延、評価、形）。`view.ts` … 見せ方（表示名、アイコン、パレットのグループ、説明、ヒント）。`icon.svg` … アイコン。特別な部品（INPUT、OUTPUT、CLOCK、モジュール）は `spec.ts` を持たない。
  - `spec.ts` / `view.ts` … 仕様と見せ方の書き方の型と、共通の処理。
  - `specs.ts` … 仕様の一覧（`PARTS`）と、特別な部品の種類の名前（`SPECIAL_KINDS`）。`views.ts` … 見せ方の一覧（`PART_VIEWS`）。`PartIcon.tsx` … 部品の種類のアイコン。
- `circuit/` … 回路のデータ。React や DOM に依存させない。
  - `component.ts` … 部品のデータと、置ける種類と、種類ごとのピン・遅延を引く入口。特別な部品（INPUT、OUTPUT、CLOCK、モジュール、BUF）のピンと遅延もここ
  - `circuit.ts` … 回路1つ分のデータ（部品と配線）
  - `project.ts` … プロジェクト（メイン回路と複数のモジュール）の構造と、データの検証
  - `module.ts` … モジュールのピンの決め方と、回路同士の依存
  - 後に挙げたものが前に挙げたものだけを使う（`parts` ← `component` ← `circuit` ← `project` ← `module`）。
- `simulation/` … シミュレーション（[シミュレーション](simulation.md)）。
  - `sim.ts` … 回路の評価（1 tick ずつ進める）。`flatten.ts` … モジュールの展開
  - `useSimulation.ts` … 時間を進めるシミュレーションと、一時停止・1 tick 送り。シートに結果を渡す入れ物（`SimStore`）もここ
  - `SheetToolbar.tsx` … 一時停止・1 tick 送りのボタンを並べたツールバー
- `sheet/` … シートの表示と操作（[シートの表示](view.md)、[画面操作](interaction.md)）。
  - `layout.ts` … 部品の大きさとピンの座標、シートの大きさ。`view.ts` … シートの表示位置と倍率（回路の座標と画面の座標の変換）。`wirePath.ts` … 配線の SVG のパス（角の丸め）
  - `Sheet.tsx` … シート。`ComponentView.tsx` … シート上の部品。`useViewGestures.ts` … シートの表示を動かす操作（ホイール、中ボタンか Space でのドラッグ、2本指）。`ZoomControls.tsx` … 拡大縮小のボタン。`TrashZone.tsx` … 部品を消す削除エリア。`drag.ts` … パレットからシートへのドラッグの受け渡し
- `editing/` … 回路の編集と元に戻す（[編集と元に戻す](editing.md)）。
  - `edit.ts` … 回路の編集（新しい回路を返すだけで、元に戻す対象にするかは決めない）
  - `history.ts`、`useProjectHistory.ts`、`switchStates.ts` … 元に戻す / やり直し
  - `useClipboard.ts` … コピー・切り取り・貼り付け。`useShortcuts.ts` … キーボード操作
- `engine/share.ts` … 共有用 JSON
- `components/` … 画面の部品。`app/` を import しない（表示に必要なものは props で受け取る）。回路を直接書き換えず、「移動した」「接続した」などの出来事をコールバックで知らせる。元に戻す対象にするかどうかは `app/` 側で決める（[編集と元に戻す](editing.md)）。
  - `dialogs/` … 特定の機能のダイアログ（`AboutDialog`、`PreferencesDialog`）。
  - 各コンポーネント。`preferences.ts` … 環境設定の型と選択肢
- `app/` … 画面全体の組み立てと状態。
  - `App.tsx` … 画面の組み立てと、状態のつなぎ役、回路の編集操作
  - `useDialogs.tsx` … ダイアログの開閉と描く部分。`useProjectFile.ts` … プロジェクトの新規作成・書き出し・読み込み。`useModules.ts` … モジュールの追加・改名・削除と、パレットのモジュールの一覧。`useStableCallbacks.ts` … 子に渡す関数の固定
  - `storage.ts` … localStorage への保存。`hints.ts` … ヒントの文言
- `util.ts` … このアプリのどの責務にも属さない、型を問わない小さな関数（`isObject`、`mustGet`、`shallowEqual` など）。何も import しない土台で、どのフォルダから使ってもよい。
- `assets/` … SVG。

見た目は Chakra UI を主にし、Chakra の既定の見た目をもとに、テーマ（`ui/theme.ts`）で直す（開発者の方針）。スタイルは Chakra の style props とレシピで書く。

- 見た目は、Chakra らしさ（Chakra の部品、レシピのバリアント、トークン、ブレークポイント）を優先する（開発者の方針）。
- 画面の幅での出し分けは、Chakra のブレークポイント（`md` = 768px など）を使う。
- ページ全体のスタイル（高さ、背景、既定のアクセントカラー）も、テーマの `globalCss` に置く。共通の CSS ファイルは持たない。
- 色はテーマのトークンで決める。画面はダーク固定（`index.html` の `<html class="dark">`）なので、Chakra のダークの色が使われる。
- シートの SVG（`Sheet.tsx`、`ComponentView.tsx`）は、Chakra に置き換えず CSS Modules のままにする（開発者の方針）。ドラッグ中に何十回も描き直すので、実行時にスタイルを作る Chakra の書き方では重くなるため。色はテーマのトークンが出す CSS の変数（`var(--chakra-colors-sheet-on)` など）で参照する。
- Chakra のスタイルは CSS の `@layer` の中に入るので、層に入っていない CSS Modules の方が優先される。シートの CSS Modules で、Chakra の部品に当たる指定を書かないこと。

CSS Modules で書くもの（シート）は、コンポーネントごとに分けて `sheet/` に置き（`Sheet.tsx` と `Sheet.module.css`）、そのコンポーネントから `styles` として import する（プロジェクトの方針）。

- CSS のクラス名はケバブケース、TS からの参照はキャメルケース（`vite.config.ts` の `localsConvention`）。存在しないクラス名を参照しても型エラーにならず `undefined` になるだけなので、追加・改名のときは両方を見比べること。
- ほかのコンポーネントのクラスは直接使わない。見た目を共有したいときは、コンポーネントとして切り出す（例: ヘッダーやツールバーのボタンは `ToolButton.tsx`）。Chakra で書くものも同じ。

## 描き直しを減らす

Chakra UI の部品は描き直すたびにスタイルを作り直すので、描き直しが多いと重くなる（開発者の方針で、重さを抑える作りにしている）。部品のドラッグの一歩ごとに App は描き直されるが、ドラッグで中身の変わらない部品は描き直さない。

- ヘッダー、タブバー、シートのツールバー、パレット、プロパティ欄、ステータスバー、ズーム、削除エリアは `React.memo` で包み、props が変わらなければ描き直さない。
- App からこれらへ渡す関数は、`useStableCallbacks` で固定する（描き直しても同じ関数で、呼ぶと最新の中身を実行する）。その場で `() => ...` を書いて渡すと、毎回違う関数になって `React.memo` が効かなくなる。シートからズームへ渡す関数も同じ考え方で固定している。
- 一部の部品は、props の比べ方を自分で持っている。props を足したり意味を変えたりしたら、比べ方も直す（直さないと、変わったのに描き直されない）。
  - タブバー（`sameTabs`）: 回路は ID と名前だけ比べる。
  - プロパティ欄（`samePanel`）: 選んだ部品の位置（x, y）は比べない。
  - ステータスバー（`sameStatus`）: ヒントは文の中身で比べる。
- パレットのモジュールの一覧は、回路の名前と、どの回路にどのモジュールを置いているかが変わったときだけ作り直す（`useModules.ts` の `modulesKey`）。パレットに出す情報を足したら、`modulesKey` にも足す。
- シミュレーションの結果は App を通さずシートに渡している（[シミュレーション](simulation.md)）。

フォルダ同士の依存の向きは `app` → `components` → `editing` → `sheet` → `simulation` → `circuit` → `parts` → `ui` の一方向に保つ（`engine/share.ts` は `circuit` だけを使う）。`util.ts` はその下の土台で、どこからも使ってよいが、`util.ts` からは何も import しない。フォルダの中のファイル同士も同じ考え方で一方向にする（[依存が一方向になるように分ける](code-placement.md#依存が一方向になるように分ける)）。

テストは、React に依存しない処理について、対象のファイルと同じフォルダに、同じ名前で置く（`sim.ts` なら `sim.test.ts`）。対象のファイルを分けたり名前を変えたりしたら、テストも合わせる。
