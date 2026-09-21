# 作業の進め方

- 開発者とのやりとり、UI の文言、コードコメントは日本語。
- 変更後は `npm run format` で整形し（Prettier）、`npx tsc -b`、`npm test`、`npx vite build` を通す。`npm run build` は型チェックとビルドをまとめて行う。整形されているかの確認だけなら `npm run format:check`。
- 改行コードは LF に統一している（`.gitattributes` と Prettier の設定）。Windows などで `core.autocrlf=true` の環境では、`.gitattributes` がないと Git から取り出したファイルが CRLF になり、整形チェックに引っかかる。
- 画面や操作に関わる変更をしたら、ヘッドレスブラウザで動作を確かめる（開発者の方針）。テストとビルドが通るだけで済ませない。
  - 開発サーバー（`npx vite --port 5199 --strictPort` をバックグラウンドで起動）を、ヘッドレスブラウザで開く。使えるブラウザは開発環境によって異なるので、その環境にあるものを確かめてから使う。新しいプロファイルで開くと、localStorage は空（メイン回路だけ）の状態になる。終わったらサーバーとブラウザを止める。
  - 見た目はスクリーンショットで確かめる。ドラッグやクリックなどの操作は、ブラウザを操作するスクリプト（Chrome DevTools Protocol など）でポインター操作を送って確かめる。確認用のスクリプトはリポジトリに置かない。
  - どうしても確かめられなかった場合は、報告にそう明記する。
- コミットは開発者に頼まれたときだけ行う。
- Windows では、`npm test` がまれに、全テストファイルの読み込みに失敗して「no tests」で終わることがある。再実行すると通る。原因は未特定（作業ディレクトリのドライブ名が `c:` と `C:` で切り替わった直後に起きやすいが、意図して再現はできていない）。個別のテストが失敗しているのではなく全ファイルがまとめて読み込めない場合は、まず再実行する。

## 公開

- main に push すると、GitHub Actions（`.github/workflows/deploy.yml`）がテストとビルドをして GitHub Pages に公開する。公開先は `https://marihachi.github.io/sazanka/`。
  - Pages の公開元は、リポジトリの設定で「GitHub Actions」にしてある。ワークフローからは有効化しない（開発者の方針）。
  - ワークフローでは整形チェックをしない（開発者の方針）。整形は手元で済ませる。
- Pages ではリポジトリ名のフォルダの下に置かれるので、`vite.config.ts` の `base` を `/sazanka/` にしている。リポジトリ名や公開先が変わったら、`base` と、「このアプリについて」の GitHub へのリンク（`Dialogs.tsx`）も合わせて直す。
- 公開後なので、保存データと共有用 JSON の形式を変えるときは、版を上げる必要があるかを確かめる（[保存データ](persistence.md)）。

## Claude Code

- Edit / Write でファイルを編集するたびに、フック（`.claude/settings.json` → `.claude/hooks/format.mjs`）が Prettier で整形する。シェルからの書き込み（sed、スクリプトなど）には効かないので、その場合は自分で整形する。
