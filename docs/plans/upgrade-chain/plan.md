# 古い版の変換を順に適用する形にする（計画）

状態: **計画中**（段階はまだどれも始めていない）。開発者の合図を受けてから実装する（[作業の進め方](../../agent/workflow.md)の「実装を始める合図」）。決まったことや変わったことがあれば、その都度この文書を直す（[ドキュメントの書き方](../../agent/documentation.md)の「計画の文書」）。

振る舞いを変えない組み替え（Skill の `refactor`）。[モジュールのフットプリントとピン番号](../module-footprint/plan.md)（version 3）の段階 3 より前に終える。version 3 では部品の種類の名前と配置が変わり、今の `upgradeV1` がそのままでは壊れるため。

## 目的

今後の版の上げ方も、この計画の形にそろえる。決まりは[保存データ](../../agent/persistence.md)の「形式を変えるとき」の開発者からの指示にある。

- 古い版のデータを、1 版ずつ順に変換してから検証する（1 → 2 → 3 …）。
- 版を上げるときに、変換を 1 つ足すだけで済むようにする。
- 各変換が、今のアプリのコードの変更に左右されないようにする。

## 今の作り

- `file/storage.ts` の `readStored` と `file/share.ts` の `parseProject` が、どちらも `data.version < 2 ? upgradeV1(data.project) : data.project` と書いている。版を上げるたびに 2 か所を直すことになる。
- `file/upgradeV1.ts` の `upgradeV1` は、今のアプリのコードに頼っている。

| 頼っているもの                                     | 困ること                                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `isComponent`（`circuit/component.ts`、部品の検証） | 種類の名前を変えると、version 1 の部品（`AND` など）を受け付けなくなる                          |
| `portsOf`（`circuit/module.ts`、モジュールのピン）  | 種類の名前（`CUSTOM`、`INPUT`）と、今のモジュールのピンの決め方に頼っている                     |
| `inputPinPos` / `outputPinPos`（`geometry/layout.ts`） | 今の配置に頼っている。部品の大きさやピンの位置を直すと、version 1 の変換の結果まで変わる |

## 決めた形

### 順に適用する

- 版の数を受け取り、今の版まで順に変換する入口を 1 つ作る。`readStored` と `parseProject` は、それを呼ぶだけにする。
- 変換は、版の順に並べる（例: `[upgradeV1]`。version 3 で `upgradeV2` を足す）。版を上げるときは、変換を 1 つ足して並びに加えるだけにする。
- 検証（`checkProject`）は、今の版まで変換し終えてから 1 回だけ行う。

### 変換は、今のアプリのコードに頼らない

- 各変換は、変換前と変換後の版の形だけを知る。今のアプリの型、検証、配置には頼らない。今のコードはこの先も変わるので、頼ると古い変換の結果が変わってしまうため。
- `upgradeV1` には、次のものを変換の中に持たせる。どれも version 2 の時点のもので、形式の文書（`docs/format/v2.md`。version 3 を公開したら `archive/` に移る）と同じにする。
  - 部品の確かめ方（version 1 の形だけを見る）
  - モジュールのピンの数え方（中の `INPUT` / `OUTPUT` を位置の順に数える）
  - ピンの先の位置（形式の文書の「ピンの先の位置」の表）
- 変換の中に持った決め方は、今のアプリの配置を直しても直さない。
- 変換の出力は、次の版の形のまま。`upgradeV1` の出力は version 2 の形（種類は大文字の名前）。

## 段階

### 段階 1: 入口を作り、`upgradeV1` を切り離す

- 入口（名前は決めてほしいこと）を作り、`storage.ts` と `share.ts` から呼ぶ。
- `upgradeV1` から、`isComponent`、`portsOf`、`inputPinPos` / `outputPinPos` の import をなくす。
- 確かめること:
  - 切り離す前と後で、`upgradeV1` の出力が同じこと。全種類の部品とモジュール（ピンの数がいろいろなもの）を含む version 1 のデータで比べる。比べるテストは使い捨てでよい。
  - 今のテスト（`upgradeV1.test.ts`、`storage.test.ts`、`share.test.ts`）が通ること。
- ドキュメント: [保存データ](../../agent/persistence.md)の「形式を変えるとき」（入口と、版を上げるときにすること）、[ソースの構成](../../agent/structure.md)の `file/`。

## 進み具合

| 段階                                     | 状態   |
| ---------------------------------------- | ------ |
| 1. 入口を作り、`upgradeV1` を切り離す    | 未着手 |

## 決めてほしいこと

- 入口の関数の名前と置き場所。候補: `upgradeProject`（`file/upgrade.ts`）/ `toCurrentVersion`（`file/upgrade.ts`）/ `migrate`（`file/migrate.ts`）
- 変換の中に持つ、version 2 の時点のピンの先の位置を、`upgradeV1.ts` に置くか、別のファイル（例: `file/layoutV2.ts`）に分けるか。今のところ使うのは `upgradeV1` だけなので、`upgradeV1.ts` に置く案を推す。
