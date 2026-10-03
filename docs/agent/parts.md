# 部品の種類

部品の種類を足す・直すときの置き場所と決まり。遅延と評価の考え方は[シミュレーション](simulation.md)、保存データの形は[保存データ](persistence.md)にある。

## 1 種類 = 1 フォルダ

部品の種類は、`src/parts/<名前>/` に 1 種類ずつまとめる。

- `spec.ts` … 仕様。種類の名前（`kind`）、形（`shape`）、入力ピン（`inputs`）、遅延（`delay`）、評価（ゲートは `output`、記憶素子は `next`）。型は `parts/spec.ts`。
- `view.ts` … 見せ方。表示名（`label`）、本体の中に書く名前（`bodyLabel`）、アイコン、パレットのグループ、説明（パレットのツールチップ）、ヒント。型は `parts/view.ts`。
- `icon.svg` … アイコン（描き方は[アイコンとロゴ](icons.md)）。

仕様と見せ方を分けるのは、計算の側（`circuit/`、`simulation/`、`editing/` の `.ts`）を画面に依存させないため。計算の側は `spec.ts` と `specs.ts` だけを import する。`view.ts` を import すると、アイコンなどの画面の素材まで計算の側に入る。

## 種類を足す手順

1. `src/parts/<名前>/` に `spec.ts`、`view.ts`、`icon.svg` を作る。
2. `parts/specs.ts` の `PARTS` と、`parts/views.ts` の `PART_VIEWS` に 1 行ずつ足す。
3. [保存データ](persistence.md)の形式の文書（`docs/format/`）の「部品の種類とピン」の表と、「version 1 の中で変えたもの」に書き足す。種類を足すだけなら版は上げない。

- 種類の型（`ComponentKind`）は `PARTS` から導いている。`PART_VIEWS` は置ける種類すべてをキーに持つ型なので、見せ方を書き忘れると型エラーになる。
- 読み込みの検証、パレット、シートの描画、ヒントは一覧を見て動くので、ほかのファイルは直さなくてよい。
- パレットのグループの中の並びは `PART_VIEWS` の順。グループの並びと見出しは `Palette.tsx` の `GROUPS`。
- 部品の設定によって文が変わるヒント（CLOCK の周期など）は、`hints` を関数にする（受け取るものは `parts/view.ts` の `HintContext`）。ヒントの後ろには、移動と削除の案内が自動で付く。

## `spec.ts` で書ける部品と、書けない部品

- `spec.ts` で書けるのは、入力ピンの値だけで出力が決まる部品（ゲート、端子の HIGH）と、記憶素子（ラッチとフリップフロップ）。
- 形（`shape`）は、今ある 3 つから選ぶ。大きさとピンの座標は `geometry/layout.ts` が形ごとに決めている。
  - `gate` … 入力は 1 本か 2 本、出力は 1 本。3 本以上の入力には `layout.ts` の対応が要る。
  - `flipflop` … 入力は 3 本まで、出力は Q と Q̄ の 2 本。
  - `terminal` … 小さな正方形。入力ピンはなく、出力は 1 本。本体に `bodyLabel` を大きく書き、ON の色で塗る（今の HIGH が常に ON のため）。OFF を出すもの（LOW など）を足すなら、色の付け方を直す。
- エッジトリガ型のフリップフロップは、CLK を入力ピンの 1 番（`CLK_PIN`）に置き、`onRisingEdge` で次の状態を作る。JK も CLK を真ん中（J、>、K）に置いてそろえている。
  - 前回の結果がない（ページを開いた直後など）ときは、前の CLK を OFF とみなす。その時点で CLK が ON なら、立ち上がりとして 1 回動く。
- 特別な部品（INPUT、OUTPUT、CLOCK、モジュール）は `spec.ts` を持たない。モジュールのピン、時間での切り替え、展開などの処理が、種類の名前を見て個別に扱っているため。
  - 種類の名前は `parts/specs.ts` の `SPECIAL_KINDS`、ピンと遅延は `circuit/component.ts` にある。遅延はどれも 0。
  - 見せ方（`view.ts` と `icon.svg`）は、ほかの種類と同じく種類のフォルダに置く。モジュールのフォルダは `module/`。
- 内部用の BUF は、`SPECIAL_KINDS` にも `PARTS` にも入れず、`component.ts` の `ComponentKind` に直接足している。見せ方も持たない（アイコンはモジュールのもので代える）。

## 触ると壊れるもの

- 入力ピンの並び順がピン番号になる。保存データの配線はピン番号で指すので、並べ替えると保存済みの回路の配線が別のピンにつながる。
- 種類の名前（`kind`）は保存データに入る。改名すると、古いデータが読めなくなる。
- いちばん長い遅延を延ばしたら、`simulation/sim.ts` の `SETTLED_TICKS` と、テストの `settle` の打ち切り条件（`stableTicks > 3`）も合わせる（[シミュレーション](simulation.md)）。
- パレットのグループの ID（`PaletteGroupId`）は、折り畳みの保存に使うので変えない（[保存データ](persistence.md)）。
