# 見た目

スタイルの書き方と色の決まり。アイコンとロゴは[アイコンとロゴ](icons.md)にある。

## Chakra UI

- 見た目は主に Chakra UI で作る。Chakra の既定の見た目をもとに、必要なところだけテーマ（`ui/theme.ts`）で変える。スタイルは Chakra の style props とレシピで書く。
- Chakra らしさ（Chakra の部品、レシピのバリアント、トークン、ブレークポイント）を優先する。
- 画面の幅での出し分けは、Chakra のブレークポイント（`md` = 768px など）を使う。
- ページ全体のスタイル（高さ、背景、既定のアクセントカラー）も、テーマの `globalCss` に置く。共通の CSS ファイルは持たない。
- 見た目を共有したいときは、コンポーネントとして切り出す（例: ボタンは `ui/ToolButton.tsx`）。ほかのコンポーネントのスタイルを直接使わない。

## シートの CSS Modules

- シートの SVG（`Sheet.tsx`、`ComponentView.tsx`）は、Chakra を使わず CSS Modules で書く。ドラッグ中に何十回も描き直すので、実行時にスタイルを作る Chakra の書き方では重くなるため。
- CSS Modules は、コンポーネントごとに `sheet/` に置き（`Sheet.tsx` と `Sheet.module.css`）、そのコンポーネントから `styles` として import する。ほかのコンポーネントのクラスは使わない。
- CSS のクラス名はケバブケース、TS からはキャメルケースで参照する（`vite.config.ts` の `localsConvention`）。存在しないクラス名を参照しても型エラーにならず `undefined` になるだけなので、足したり改名したりしたら両方を見比べる。
- 色は、テーマのトークンが出す CSS の変数で参照する（例: `var(--chakra-colors-sheet-on)`）。
- Chakra のスタイルは CSS の `@layer` の中に入るので、層に入っていない CSS Modules の方が優先される。そのため、シートの CSS Modules には、Chakra の部品に効くような指定を書かない。

## 色

- 画面はダーク固定（`index.html` の `<html class="dark">`）。Chakra のダークの色が使われる。
- 色はテーマのトークンで決める。
  - `sheet.*` … シートの色（背景、方眼、シートの外、値が 0 の線、値が 1 の線、出力がぶつかっている線）。
  - `brand` … ロゴの色（`lightseagreen`）。環境設定では変わらない。
  - `accent.*` … アクセントカラー。
- アクセントカラーは、環境設定で利用者が変えられる（`preferences.ts` の `accent`）。
  - `App.tsx` がページの `--accent` を差し替え、テーマの `accent` のパレットはそれから作る（`color-mix`）。
  - ページ全体の既定のパレットは `accent`（`globalCss` の `colorPalette`）。
  - 色は必ず `colorPalette="accent"` か `accent.*` のトークンで書く。色の値を直接書くと、利用者がアクセントカラーを変えたときに、そこだけ元の色のまま残る。
- 既定のアクセントカラー（青緑 `#20b2aa`）は、ロゴの色と同じにしている。ロゴの色を変えたら、`preferences.ts` の既定値と選択肢、`theme.ts` の `--accent` の既定値も合わせる。

## 触ったら確かめること

テーマ（`theme.ts`）を触ったら、ヘッドレスブラウザで次を確かめる。

- 環境設定でアクセントカラーを選び直すと、テーマの色も変わる。`getComputedStyle(document.documentElement)` で `--chakra-colors-accent-solid` を読み、選んだ色になっていればよい。
- シートの配線や部品の色（`--chakra-colors-sheet-*`）が、変える前と同じに出る。
