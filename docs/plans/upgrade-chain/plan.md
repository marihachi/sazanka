# 古い版の変換を順に適用する形にする（計画）

状態: **完了**（2026-10-06）。

- 開発者の合図を受けてから実装する（[作業の進め方](../../agent/workflow.md)の「実装を始める合図」）。
- 決まったことや変わったことがあれば、その都度この文書を直す（[ドキュメントの書き方](../../agent/documentation.md)の「計画の文書」）。

振る舞いを変えない組み替え（Skill の `refactor`）。[保存データの version 3](../format-v3/plan.md) の段階 2 より前に終える。version 3 では部品の種類の名前と配置が変わり、今の `upgradeV1` がそのままでは壊れるため。

## 目的

- 古い版のデータを、1 版ずつ順に変換してから検証する（1 → 2 → 3 …）。
- 版を上げるときに、変換を 1 つ足すだけで済むようにする。
- 各変換が、今のアプリのコードの変更に左右されないようにする。

今後の版の上げ方も、この形にそろえる。決まりは[保存データ](../../agent/persistence.md)の「形式を変えるとき」の「開発者からの指示」にある。

## 今の作り

- `file/storage.ts` の `readStored` と `file/share.ts` の `parseProject` が、どちらも `data.version < 2 ? upgradeV1(data.project) : data.project` と書いている。版を上げるたびに 2 か所を直すことになる。
- `file/upgradeV1.ts` の `upgradeV1` は、今のアプリのコードに頼っている。

| 頼っているもの                                         | 困ること                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `isComponent`（`circuit/component.ts`、部品の検証）    | 種類の名前を変えると、version 1 の部品（`AND` など）を受け付けなくなる                   |
| `portsOf`（`circuit/module.ts`、モジュールのピン）     | 種類の名前（`CUSTOM`、`INPUT`）と、今のモジュールのピンの決め方に頼っている              |
| `inputPinPos` / `outputPinPos`（`geometry/layout.ts`） | 今の配置に頼っている。部品の大きさやピンの位置を直すと、version 1 の変換の結果まで変わる |

## 決めた形

### 順に適用する

- 版の数を受け取り、今の版まで順に変換する入口を 1 つ作る。入口は `file/upgrade.ts` の `upgradeProject`。`readStored` と `parseProject` は、それを呼ぶだけにする。
- 変換は、版の順に並べる（例: `[upgradeV1]`。version 3 で `upgradeV2` を足す）。版を上げるときは、変換を 1 つ足して並びに加えるだけにする。
- 検証（`checkProject`）は、今の版まで変換し終えてから 1 回だけ行う。

### 変換は、今のアプリのコードに頼らない

- 各変換は、変換前と変換後の版の形だけを知る。今のアプリの型、検証、配置には頼らない。今のコードはこの先も変わるので、頼ると古い変換の結果が変わってしまうため。
- `upgradeV1` には、次のものを変換の中に持たせる。どれも version 2 の時点のものにし、形式の文書（`docs/format/v2.md`。version 3 を公開したら `archive/` に移る）と同じにする。
  - 部品の確かめ方（version 1 の形だけを見る）
  - モジュールのピンの数え方（中の `INPUT` / `OUTPUT` を位置の順に数える）
  - ピンの先の位置（形式の文書の「ピンの先の位置」の表）
- version 2 の時点のピンの先の位置などは、`upgradeV1.ts` の中に置く。使うのは `upgradeV1` だけなので、そのファイルだけ読めば変換の全体が分かるようにするため。ほかの変換でも要るようになったら、別のファイル（例: `file/layoutV2.ts`）に分ける。
- 変換の中に持った決め方は、今のアプリの配置を直しても直さない。
- 変換の出力は、次の版の形にする。たとえば `upgradeV1` の出力は version 2 の形（種類は大文字の名前）。

## 段階

### 段階 1: 入口を作り、`upgradeV1` を切り離す

- 入口（`file/upgrade.ts` の `upgradeProject`）を作り、`storage.ts` と `share.ts` から呼ぶ。
- `upgradeV1` から、`isComponent`、`portsOf`、`inputPinPos` / `outputPinPos` の import をなくす。
- 確かめること:
  - 切り離す前と後で、`upgradeV1` の出力が同じこと。全種類の部品とモジュール（ピンの数がいろいろなもの）を含む version 1 のデータで比べる。比べるテストは使い捨てでよい。
  - 今のテスト（`upgradeV1.test.ts`、`storage.test.ts`、`share.test.ts`）が通ること。
- ドキュメント: [保存データ](../../agent/persistence.md)の「形式を変えるとき」（入口と、版を上げるときにすること）、[ソースの構成](../../agent/structure.md)の `file/`。

## 進み具合

| 段階                                  | 状態   |
| ------------------------------------- | ------ |
| 1. 入口を作り、`upgradeV1` を切り離す | 済み   |

## 実装で決めたこと

開発者に聞かずに決めたこと（[作業の進め方](../../agent/workflow.md)の「合意してから進める」）。

- `upgradeV1` は、計画で挙げた `isComponent`、`portsOf`、`inputPinPos` / `outputPinPos` に加えて、`isPinRef`、`isPoint`、`snap` と型（`Component`、`PinRef`、`Wire`、`Point`、`Project`）も今のコードから切り離した。どれも今のコードの変更で変わりうるため。残っている import は `util.ts` の `isObject`（型を問わない判定）だけ。
- 入口に渡す版が 1 より小さいときや整数でないときは、version 1 から変える（`Math.max(1, Math.floor(version))`）。切り離す前の `data.version < 2 ? upgradeV1(...)` と同じ結果にするため。
- 変換の並びは、配列 `UPGRADES` にした。`UPGRADES[i]` が version i + 1 → i + 2。版を上げるときは末尾に足すだけで済む。採らなかった案: 版の数をキーにした表（版が飛ぶことはないので、配列で足りる）。
- version 2 の時点の部品の種類、入力ピンの数、ラッチ・フリップフロップの一覧は、`upgradeV1.ts` の定数（`KINDS_V2`、`INPUT_COUNTS_V2`、`FLIP_FLOPS_V2`）に書いた。

## 結果

- 切り離す前と後で、`upgradeV1` の出力が同じことを、使い捨てのテストで確かめた（全種類の部品、ピン数の違うモジュール、見つからないモジュール、範囲外のピン番号を含む約 9,000 本の配線と、形の正しくないデータ）。
- 入口のテスト（`file/upgrade.test.ts`）を足した。
