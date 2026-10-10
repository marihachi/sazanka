# 部品の種類

部品の種類を足す・直すときの置き場所と決まり。遅延と評価の考え方は[シミュレーション](simulation.md)、保存データの形は[保存データ](persistence.md)にある。

## 1 種類 = 1 フォルダ

部品の種類は、`src/parts/<名前>/` に 1 種類ずつまとめる。

- `spec.ts` … 仕様。種類の名前（`kind`）、動作の分類（`behavior`）、入力ピン（`inputs`）、遅延（`delay`）、評価（`logic` は `output`、`flipFlop` は `next`）。動作だけを書き、見た目は書かない。型は `parts/spec.ts`。
- `view.ts` … 見せ方。表示名（`label`）、本体の中に書く名前（`bodyLabel`）、アイコン、パレットのグループ、説明（パレットのツールチップ）、ヒント。型は `parts/view.ts`。
- `layout.ts` … シート上の配置。既定と違う配置にする種類だけが持つ（下の「配置」）。型は `parts/layout.ts`。
- `icon.svg` … アイコン（描き方は[アイコンとロゴ](icons.md)）。

仕様と見せ方を分けるのは、計算の側（`circuit/`、`simulation/`、`editing/` の `.ts`）を画面に依存させないため。計算の側は `spec.ts` と `specs.ts` だけを import する。`view.ts` を import すると、アイコンなどの画面の素材まで計算の側に入る。配置を `view.ts` ではなく `layout.ts` に分けるのも同じ理由で、ピンの座標はネットと展開（計算の側）からも使う。

## 種類を足す手順

1. `src/parts/<名前>/` に `spec.ts`、`view.ts`、`icon.svg` を作る。
2. `parts/specs.ts` の `PART_SPECS` と、`parts/views.ts` の `PART_VIEWS` に 1 行ずつ足す。既定と違う配置にするなら、`layout.ts` も作って `parts/layouts.ts` の `PART_LAYOUTS` に足す。
3. [保存データ](persistence.md)の形式の文書（`docs/format/`）の「部品の種類とピン」の表と、「version 3 の中で変えたもの」に書き足す。種類を足すだけなら版は上げない。

- 種類の型（`PartKind`）は `PART_SPECS` から導いている。仕様の一覧にある種類だけの型は `SpecKind`。`PART_VIEWS` は置ける種類すべてをキーに持つ型なので、見せ方を書き忘れると型エラーになる。
- 読み込みの検証、パレット、シートの描画、ヒントは一覧を見て動くので、ほかのファイルは直さなくてよい。
- パレットのグループの中の並びは `PART_VIEWS` の順。グループの並びは `Palette.tsx` の `GROUPS`、見出しは文言の表（`i18n/ja.ts` の `palette.groups`）。
- `view.ts` の説明（`description`）とヒント（`hints`）は、日本語と英語の両方で書く（`{ ja: ..., en: ... }`。型は `i18n/language.ts` の `Localized`）。英語を書き忘れると型エラーになる。表示名（`label`、`bodyLabel`）は、言語で変わらなければ文字列 1 つでよい（`LocalText`。例: 7 セグは言語ごと）。英語の書き方は[文言と表示言語](i18n.md)にある。
- 部品の設定によって文が変わるヒント（CLOCK の周期など）は、言語ごとの `hints` を関数にする（受け取るものは `parts/view.ts` の `HintContext`）。ヒントの後ろには、移動と削除の案内が自動で付く。

## `spec.ts` で書ける部品と、書けない部品

- `spec.ts` で書けるのは、入力ピンの値だけで出力が決まる部品（ゲート、HIGH）と、記憶素子（ラッチとフリップフロップ）と、表示するだけの部品（7 セグメント）。
- 動作の分類（`behavior`）は、今ある 3 つから選ぶ。分類ごとに既定の配置がある（下の「配置」）。見た目を変えるなら、種類の `layout.ts` を置く。
  - `logic` … 入力から出力 1 本を求める（`output`）。既定の配置はゲート（`gateLayout`）。入力は 1 本か 2 本で、3 本以上の入力には、既定の配置の対応か、種類の `layout.ts` が要る。
  - `flipFlop` … 状態（`{ q, clk }`）を持ち、次の状態を求める（`next`）。入力は 3 本まで、出力は Q と Q̄ の 2 本。既定の配置は記憶素子（`flipflopLayout`）。
  - `display` … 入力ピンだけを持ち、出力ピンはない（`circuit/part.ts` の `isDisplayKind`）。シミュレーションでは何も求めず、遅延のない部品の計算からも外す。見た目は、種類の `layout.ts` と描き込み（下の「本体の描き込み」）で決める。既定の配置はないので、`layout.ts` を必ず置く。
- デバイス（将来の UART など）の作り方（状態、出力の数、時間での動き、設定を持てる動作の分類を足すか）は、足すときに要件を見て決める。`display` は、そのときにまとめる候補（[7 セグメントの計画](../plans/seven-segment/plan.md)）。
- HIGH は `logic` で、配置は小さな四角（`high/layout.ts` の `squareLayout`）。本体に `bodyLabel` を大きく書き、ON の色で塗る（HIGH は常に ON のため。`SheetPart.tsx` が種類の名前で分けて描く）。OFF を出すもの（LOW など）を足すなら、色の付け方を直す。
- 前は仕様の形（`shape`: `gate` / `terminal` / `flipflop`）が、動作の分類と見た目の既定の両方を決めていた。分かりにくいので、動作の分類だけにした（[計画](../plans/part-behavior/plan.md)）。
- エッジトリガ型のフリップフロップは、CLK を入力ピンの 1 番（`CLK_PIN`）に置き、`onRisingEdge` で次の状態を作る。JK も CLK を真ん中（J、>、K）に置いてそろえている。
  - 前回の結果がない（ページを開いた直後など）ときは、前の CLK を OFF とみなす。その時点で CLK が ON なら、立ち上がりとして 1 回動く。
- 特別な部品（INPUT、OUTPUT、CLOCK、モジュール）は `spec.ts` を持たない。モジュールのピン、時間での切り替え、展開などの処理が、種類の名前を見て個別に扱っているため。
  - 種類の名前は `parts/specs.ts` の `SPECIAL_KINDS`、ピンと遅延は `circuit/part.ts` にある。遅延はどれも 0。
  - 見せ方（`view.ts` と `icon.svg`）は、ほかの種類と同じく種類のフォルダに置く。モジュールのフォルダは `module/`。
  - 形を持たないので、配置（`layout.ts`）はどれも種類のフォルダに置く。
- 内部用の BUF（種類 `buf`）は、`SPECIAL_KINDS` にも `PART_SPECS` にも入れず、`part.ts` の `PartKind` に直接足している。見せ方も持たない（アイコンはモジュールのもので代える）。配置はゲートの既定の配置。

## 配置

シート上の本体の大きさ、輪郭、ピンの置き方は、種類ごとの配置（`parts/layout.ts` の `PartLayout`）で決める。配置を引く入口は `parts/layouts.ts` の `getLayout`。それを px のシート上の座標に直すのは `geometry/layout.ts`。

- 長さはマス単位で書く。整数にすれば、部品がグリッド上にあるかぎり、ピンの先もグリッドに乗る。配線とピンのつながり（`geometry/net.ts`）は、この前提で動く。
- 決められるもの:
  - 本体の幅と高さ（`w`、`h`）
  - 本体の輪郭（`body`）: `rect`（角張った四角）、`rounded`（角の丸い四角）、`circle`（円）
  - ピンの置き方（`inputs`、`outputs`）: 辺（`side`。`left` / `right` / `top` / `bottom`）と、辺の上の位置（`at`。左右の辺なら本体の上端から、上下の辺なら左端からのマス）。並び順がピン番号。ピンの先は辺から 1 マス外にある
  - 本体の上に名前を書くか（`nameAbove`）。部品の占める範囲に、その 1 マスを含める
  - どのポートにもつながらないピン（`nc`。線と「NC」の文字だけを描く）と、外側のピン番号（`PinPlacement.number`）。dip / qfp のモジュールだけが使う。ピン番号は、シート上には書かず、モジュール設定のプレビューでだけピンの横に書く（`SheetPart` の `showPinNumbers`）
  - ピンの線に、入力か出力かを示す向きの三角を付けるか（`directionMarks`）。辺から入力か出力かが分からない配置（dip / qfp のモジュール）で付ける
- 部品の占める範囲（`geometry/layout.ts` の `calcMarginAroundBody`）: 左右は、ピンがなくても 1 マス取る。上下は、その辺にピンがあるときだけ 1 マス取る。
- ピンの線とピン名は、入力か出力かではなく辺で描き分ける（`sheet/SheetPart.tsx`）。
- 配置は、部品のピンの割り当て（`circuit/module.ts` の `Pinout`。ピンの名前、モジュールのパッケージと外側のピン番号）を受け取って返す関数（`PartLayoutOf`）。モジュールは、パッケージとピンの数で形が変わるため。
- モジュールの配置（`module/layout.ts`）は、パッケージで分かれる。`split` は今までの形（幅 4、ピンは 1 マスおき）、`dip` は幅 3 で左右に 2 マスおき（番号は左上から反時計回り）、`qfp` は正方形で 4 辺に 2 マスおき（角から 2 マスあける。名前は本体の中）。
- 上下の辺のピン名は、90 度回して本体の内側に縦に書く（`SheetPart.tsx` の `PinName`）。
- 種類の `layout.ts` がなければ、動作の分類の既定の配置（`gateLayout`、`flipflopLayout`）になる。INPUT、OUTPUT、CLOCK、HIGH は、種類の `layout.ts` で小さな四角（`squareLayout`）にしている。一部だけ変えるときは、既定の配置を広げて上書きする（例: `output/layout.ts` は小さな四角の配置の輪郭だけを円にしている）。
- 本体の中の描き込み（ランプ、矩形波の絵、文字）は、配置ではなく `sheet/SheetPart.tsx` が種類ごとに描いている。
- モジュールごとに大きさやピンの位置を変えられるようにするなら、モジュールの定義から `module/layout.ts` の配置を上書きする形にする。保存データの形が変わるので、[保存データ](persistence.md)の決まりに従う。

## 本体の描き込み

- 前からある部品（INPUT のスイッチ、OUTPUT のランプ、CLOCK の矩形波、HIGH の記号、ゲートなどの名前）の描き込みは、`sheet/SheetPart.tsx` が種類ごとに描く。
- デバイスのように描くものが大きく種類ごとに違う部品は、描き込みを種類のフォルダの `Body.tsx` に置き、`parts/bodies.tsx` の `PART_BODIES` に並べる。`SheetPart.tsx` は、一覧にある種類なら、本体の左上を原点にしてそれを描き、名前は書かない（本体を描き込みが使い切り、見た目で何の部品か分かるため）。
  - 描き込みが受け取るもの（`PartBodyProps`）: 本体の幅と高さ（px）、種類の配置（ピンのある辺を避けて描くため）、入力ピンの値。
  - 一覧は部品（`.tsx`）を import するので `.tsx` にしている（`.ts` から `.tsx` の部品を import しない決まり。[コードの書き方](coding-style.md)）。
- 7 セグメント（`sevenSegment/Body.tsx`）は、実物の表示器に寄せて数字を右に 10 度傾ける（`skewX`）。小数点は傾けると楕円になるので、位置だけを傾きに合わせて円のまま描く。
- 前からある部品の描き込みを `Body.tsx` に移すのは、振る舞いを変えない組み替えなので、別の作業にする。

## 触ると壊れるもの

- 入力ピンの並び順がピン番号になる。保存データの配線はピン番号で指すので、並べ替えると保存済みの回路の配線が別のピンにつながる。
- 種類の名前（`kind`）は保存データに入る。改名すると、古いデータが読めなくなる。
- いちばん長い遅延を延ばしたら、`simulation/sim.ts` の `SETTLED_TICKS` と、テストの `settle` の打ち切り条件（`stableTicks > 3`）も合わせる（[シミュレーション](simulation.md)）。
- パレットのグループの ID（`PaletteGroupId`）は、折り畳みの保存に使うので変えない（[保存データ](persistence.md)）。
