# 部品の仕様の形を、動作の分類にする（計画）

状態: **計画中**（実装の合図を待っている）。

- 振る舞いを変えない組み替え。実装は Skill の `refactor` で進める。開発者の合図を受けてから始める（[作業の進め方](../../agent/workflow.md)の「実装を始める合図」）。
- 決まったことや変わったことがあれば、その都度この文書を直す（[ドキュメントの書き方](../../agent/documentation.md)の「計画の文書」）。

## 目的

部品の仕様（`parts/spec.ts`）の `shape` が、動作の分類（評価の仕方）と、見た目の既定（配置と描き方）の 2 つを決めていて分かりにくい。仕様には動作の分類だけを残し、見た目は配置（`layout.ts`）と描画の側で決める。

[7 セグメントディスプレイ](../seven-segment/plan.md)の前に行う。出力のない部品を足すときに、動作と見た目が混ざった形をもう 1 つ増やさずに済むようにするため。

## 今の形と問題

| `shape`    | 動作の分類                        | 見た目の既定                                            |
| ---------- | --------------------------------- | ------------------------------------------------------- |
| `gate`     | 入力 → 出力 1 本                  | ゲートの配置                                            |
| `terminal` | 入力 → 出力 1 本（`gate` と同じ） | 小さな四角の配置。本体に記号を大きく書き、ON の色で塗る |
| `flipflop` | 状態を持ち、出力は Q / Q̄          | 記憶素子の配置                                          |

- `gate` と `terminal` は動作が同じで、見た目だけが違う。
- 「端子」と呼んでいるが、使っているのは HIGH（いつも ON を出す信号源）だけ。
- `terminalLayout` という配置は INPUT、OUTPUT、CLOCK も使うが、この 3 つは `shape: 'terminal'` を持たない。同じ言葉が、仕様と配置で別の範囲を指している。

`shape` を見ているところ: `simulation/sim.ts`（評価の仕方）、`circuit/part.ts`（記憶素子か）、`parts/layouts.ts`（既定の配置）、`sheet/SheetPart.tsx`（記号を大きく書くか）、`parts/specs.ts`（`GateKind`、`FlipFlopKind` の型）。

保存データには種類の名前しか入らないので、データには響かない。

## 決めたこと

開発者が決めたこと:

- 仕様の `shape` をやめ、動作の分類だけを持たせる（案 A）。採らなかった案: 名前だけ直す（`terminal` を `square` などに。2 つのことを 1 つの項目で決めている点は残る）、今は直さない（7 セグメントで `display` の形を足し、整理は UART のときにまとめる）。
- 動作の分類の値は `logic`（入力から出力を求める）と `flipFlop`（記憶素子。Q / Q̄ と `{ q, clk }` の状態）。今のコードの言葉（`FlipFlopKind`、`isFlipFlopKind`、`FlipFlopState`）とそろえるため。採らなかった案: `memory`（将来の記憶素子の配列と紛らわしい）、`combinational` / `sequential`（RAM も順序回路なので、分類と食い違う）、`gate` / `latch`、`stateless` / `stateful`。
- HIGH の配置を、新しいファイル `parts/high/layout.ts` に置く。
- 計画の文書は `docs/plans/part-behavior/plan.md` に置く。

エージェントが決めたこと:

- 項目の名前は `behavior`。採らなかった案: `category`（パレットのグループと紛らわしい）、`evaluation`。
- `terminalLayout` を `squareLayout`（小さな四角）に改名する。INPUT、OUTPUT、CLOCK、HIGH が使う。採らなかった案: `ioLayout`（HIGH も使うため）。
- 既定の配置は、`logic` ならゲートの配置、`flipFlop` なら記憶素子の配置。HIGH は種類の `layout.ts` で小さな四角にする。
- `SheetPart.tsx` の「`terminal` なら記号を大きく書いて ON の色で塗る」は、「HIGH なら」にする（INPUT、OUTPUT、CLOCK と同じく、種類で分ける）。

## 構成案

| ファイル                                        | 変えること                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `parts/spec.ts`                                 | `LogicPartSpec` の `shape: 'gate' \| 'terminal'` を `behavior: 'logic'` に、`MemoryPartSpec` の `shape: 'flipflop'` を `behavior: 'flipFlop'` に |
| 各種類の `spec.ts`（14 個）                     | `shape` を `behavior` に                                                                                                                         |
| `parts/specs.ts`                                | `GateKind`、`FlipFlopKind` を `behavior` から導く                                                                                                |
| `parts/layout.ts`                               | `terminalLayout` を `squareLayout` に改名                                                                                                        |
| `parts/high/layout.ts`（新規）                  | `export const high = squareLayout;`                                                                                                              |
| `parts/layouts.ts`                              | `PART_LAYOUTS` に HIGH を足す。既定の配置を `behavior` で決める                                                                                  |
| `parts/input`、`output`、`clock` の `layout.ts` | `squareLayout` を使う                                                                                                                            |
| `circuit/part.ts`                               | `isFlipFlopKind` を `behavior` で判定                                                                                                            |
| `simulation/sim.ts`                             | 評価の分け方を `behavior` で                                                                                                                     |
| `sheet/SheetPart.tsx`                           | 記号を大きく書く条件を `c.kind === 'high'` に                                                                                                    |

`MemoryPartSpec` の型の名前は、`FlipFlopPartSpec` に直すかを実装のときに見る（値の名前とそろえるため）。

ドキュメント: [部品の種類](../../agent/parts.md)（形の説明、配置の既定）、[ソースの構成](../../agent/structure.md)、[用語](../../agent/glossary.md)。

## 段階

1 つの段階で行う。

- 置き換えて、テストを通す。
- 確かめること: 全種類の部品の見た目が、変える前と画素で同じか（スクリーンショットを比べる）。シミュレーションの動き。描画のコードに触るので、フレームレートも測る。

## 進み具合

| 段階        | 状態   |
| ----------- | ------ |
| 1. 置き換え | 未着手 |

## 決まっていないこと

今はない。
