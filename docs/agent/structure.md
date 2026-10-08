# ソースの構成

`src/` のフォルダと、各ファイルの責務。構成を変えるときの考え方は[コードの置き場所の決め方](code-placement.md)にある。

## フォルダの分け方

以下は開発者からの指示です。

- フォルダは目的（機能）ごとに分け、その目的の型・計算・画面・状態のカスタムフックを同じフォルダに置く。ある機能を直すときに、そのフォルダだけを読めば済むようにするため。
- 画面と計算は、フォルダではなくファイルで分ける（下の「画面と計算の分け方」）。

## 画面と計算の分け方

- React を使うのは `.tsx` と `use*.ts` だけ。それ以外の `.ts`（データ、計算、編集、保存）は React や Chakra UI を import しない。Biome で守らせている（[コードの書き方](coding-style.md)の「React を import できるファイル」）。計算の側が画面の都合を知らないようにし、React なしでテストできるようにするため。
- 画面の部品（`App.tsx` 以外の `.tsx`）は、回路を直接書き換えない。表示に要るものは props で受け取り、「動かした」「つないだ」などの出来事をコールバックで知らせる。
- 回路の編集の流れ: 画面の部品が出来事を知らせる → `App.tsx` が `editing/edit.ts` の関数で新しい回路を作る → `App.tsx` が元に戻す対象にするかを決めて履歴に入れる（[編集と元に戻す](editing.md)）。この分担を崩す処理（例: コンポーネントの中で履歴を積む）を足さない。

## フォルダとファイル

上のものほど下のものを組み合わせて使い、下のものほど土台になる。

- `main.tsx` … 入口。Chakra のテーマを渡して `App` を描く。
- `app/` … 画面全体の組み立てと、状態のつなぎ役。
  - `App.tsx` … 画面の組み立て、状態の保持、回路の編集操作（部品の追加、削除、移動、配線など）。
  - `useDialogs.tsx` … ダイアログの開閉と描画。`useStableCallbacks.ts` … 子に渡す関数を固定する（[描画の重さ](performance.md)）。
  - `Header.tsx` … ヘッダー。`PropertyPanel.tsx` … プロパティ欄。`AboutDialog.tsx` … 「このアプリについて」。
- `modules/` … モジュールの追加・改名・削除・設定と、回路の切り替え。
  - `useModules.ts` … モジュールの操作と、パレットに出すモジュールの一覧。`TabBar.tsx` … タブバー。`ModuleSettingsDialog.tsx` … モジュール設定のダイアログ（パッケージとピンの割り当て。計算は `circuit/module.ts`）。
- `sheet/` … シートの描画と操作（[画面操作](interaction.md)、[シートの表示](view.md)）。
  - `Sheet.tsx` … シート。回路を描き、ポインターの操作を受けて出来事を知らせる。
  - `SheetPart.tsx` … シート上の部品 1 つ。`wirePath.ts` … 配線の点の並びから作る SVG のパス（角の丸め）。
  - `useViewGestures.ts` … 表示を動かす操作（ホイール、中ボタンか Space でのドラッグ、2 本指）。
  - `ZoomControls.tsx` … ズーム。`TrashZone.tsx` … 削除エリア。
  - `Sheet.module.css`、`SheetPart.module.css` … シートのスタイル（[見た目](styling.md)）。
- `palette/` … パレット。
  - `Palette.tsx` … パレット本体。`drag.ts` … パレットからシートへドラッグするときに渡すデータの形。
- `file/` … 保存と共有（[保存データ](persistence.md)）。
  - `storage.ts` … localStorage への保存と読み込み。`share.ts` … 共有用 JSON。`useProjectFile.ts` … 新規作成・書き出し・読み込みの操作。
  - `upgrade.ts` … 古い版のプロジェクトを、1 版分の変換を順に通して今の版の形にする入口（保存データと共有用 JSON で共通）。`upgradeV1.ts` … version 1 → 2 の変換。`upgradeV2.ts` … version 2 → 3 の変換。
- `preferences/` … 環境設定。
  - `preferences.ts` … 型、既定値、選択肢。`PreferencesDialog.tsx` … 環境設定のダイアログ。
- `hints/` … ヒント。
  - `hints.ts` … 状況に応じたヒントの文の選び方。`StatusBar.tsx` … ステータスバー。
- `editing/` … 回路の編集と元に戻す（[編集と元に戻す](editing.md)）。
  - `edit.ts` … 回路の編集（新しい回路を返すだけ）と、選択の型（`Selection`）。
  - `history.ts` … 履歴の計算。`useProjectHistory.ts` … 元に戻せるプロジェクトの状態。`switchStates.ts` … 元に戻すときに INPUT の ON/OFF を引き継ぐ。
  - `useClipboard.ts` … コピー・切り取り・貼り付け。`useShortcuts.ts` … キーボードの操作。
- `simulation/` … シミュレーション（[シミュレーション](simulation.md)）。
  - `sim.ts` … 回路の評価（1 tick ずつ進める）。`flatten.ts` … モジュールの展開と、配線のネットからピン同士のつながりを作ること。
  - `testCircuits.ts` … テスト用の回路の作り方（つなぎたいピンから配線を引いた回路）。アプリからは使わない。
  - `useSimulation.ts` … 時間を進めるループ、一時停止、1 tick 送り・戻し、CLOCK の ON/OFF、シートに結果を渡す入れ物（`SimStore`）。`frameTicks.ts` … 1 フレームで進める tick 数。
  - `SheetToolbar.tsx` … シートのツールバー（選択モードと配線モードの切り替え、一時停止、1 tick 送り・戻し、モジュールの削除）と、モードの型（`Tool`）。
- `geometry/` … 座標の計算。
  - `layout.ts` … グリッド、部品の大きさとピンの座標（種類ごとの配置をマスから px に直す）、シートの大きさ、はみ出さない位置、範囲選択、配線中の点の置き方。
  - `net.ts` … 配線とピンの、位置によるつながり（ネット）、分岐の印の位置、出力のぶつかり。
  - `view.ts` … 表示（位置と倍率）と、回路の座標と画面の座標の変換。
- `circuit/` … 回路のデータ。
  - `part.ts` … 部品のデータ、置ける種類、種類ごとのピンと遅延を引く入口。特別な部品のピン、CLOCK の周期もここ。
  - `circuit.ts` … 回路 1 つ分のデータ（部品と配線）と ID の作り方。配線は点の並びで、部品を指さない。
  - `project.ts` … プロジェクトの構造と、外から来たデータの検証（`checkProject`）。
  - `module.ts` … モジュールのピンの決め方（ピン番号の割り当てと、外側のピンに出せないポートの判定を含む）と、回路同士の依存（循環の判定）。
- `parts/` … 部品の種類（[部品の種類](parts.md)）。
  - `<種類>/` … 1 種類 1 フォルダ。フォルダの名前は種類の名前（`kind`）と同じ。`spec.ts`（仕様）、`view.ts`（見せ方）、`layout.ts`（シート上の配置。既定と違う種類だけ）、`icon.svg`（アイコン）、`Body.tsx`（本体の描き込み。デバイスなど、描き込みを種類のフォルダに置く種類だけ）。
  - `spec.ts` / `view.ts` / `layout.ts` … 仕様、見せ方、配置の型と、共通の処理（配置は、動作の分類ごとの既定の配置と、小さな四角の配置 `squareLayout` も）。`specs.ts` … 仕様の一覧（`PART_SPECS`）。`views.ts` … 見せ方の一覧（`PART_VIEWS`）。`layouts.ts` … 配置の一覧（`PART_LAYOUTS`）と、配置を引く `getLayout`。`PartIcon.tsx` … 種類のアイコン。`bodies.tsx` … 本体の描き込みを種類のフォルダ（`<種類>/Body.tsx`）に置く種類の一覧（`PART_BODIES`）。
- `ui/` … 回路を知らない、共通の画面部品。
  - `ToolButton.tsx` … ヘッダーやツールバーのボタン。`HintTooltip.tsx` … ツールチップ。`Icons.tsx` … 文字色で塗るアイコン。`InlineInput.tsx` … その場で文字を編集する入力欄（タブの名前の変更）。
  - `DialogFrame.tsx` … ダイアログの外枠。`ConfirmDialog.tsx`（確認とお知らせ）、`PromptDialog.tsx`（名前の入力）、`TextDialog.tsx`（書き出し・読み込み）。
  - `theme.ts` … Chakra UI のテーマ。`classNames.ts` … クラス名の連結。
- `util.ts` … どの責務にも属さない、型を問わない小さな関数（`isObject`、`mustGet`、`shallowEqual` など）。何も import しない。
- `assets/` … ロゴと、ボタンなどのアイコンの SVG（部品の種類のアイコンは `parts/`）。

## 依存の向き

今のフォルダ同士の依存は、次の向きになっている（左が右を使う）。依存の向きについての方針は[コードの置き場所の決め方](code-placement.md)の「依存の向き」。

`app` → `modules` → `sheet` → `palette` → `file` → `preferences` → `hints` → `editing` → `simulation` → `geometry` → `circuit` → `parts` → `ui` → `util`

- この向きになる主な理由: モジュールの一覧はパレットに出す（`modules` → `palette`）。シートは、パレットからのドラッグ、選択の型、シミュレーションの結果、座標を組み合わせる（`sheet` → `palette`、`editing`、`simulation`、`geometry`）。保存は環境設定とシートの表示も保存する（`file` → `preferences`、`geometry`）。座標の計算は部品の形を見る（`geometry` → `circuit`、`parts`）。ネットはピンの座標から作るので `geometry/net.ts` に置き、展開（`simulation/flatten.ts`）とシートから使う。部品のアイコンは共通のアイコンで描く（`parts` → `ui`）。
- `circuit/` の中では、`module.ts` → `project.ts` → `circuit.ts` → `part.ts` → `parts/` の向きに使う。`part.ts` と `circuit.ts` はプロジェクトを知らず、`project.ts` と `module.ts` は知る。逆向きに、`parts/layout.ts` は配置の入力として `module.ts` の `Pinout` を型だけ import する。
- `util.ts` は何も import しない。
- 互いに import し合う形（循環）の落とし穴: 読み込みの途中では、相手のファイルの値がまだできていないことがある。読み込んだ時点で相手の値を使う処理（例: `parts/specs.ts` が読み込み時に `PART_SPECS` から `Map` を作る）が循環に入ると、`undefined` を読んで壊れる。相手の値を関数の中で使うだけのときや、型だけを import するときは問題ない。
