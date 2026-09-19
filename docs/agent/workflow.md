# 作業の進め方

- ユーザーとのやりとり、UI の文言、コードコメントは日本語。
- 変更後は `npm run format` で整形し（Prettier）、`npx tsc -b`、`npm test`、`npx vite build` を通す。`npm run build` は型チェックとビルドをまとめて行う。整形されているかの確認だけなら `npm run format:check`。
- 改行コードは LF に統一している（`.gitattributes` と Prettier の設定）。この環境は `core.autocrlf=true` なので、`.gitattributes` がないと Git から取り出したファイルが CRLF になり、整形チェックに引っかかる。
- ブラウザで動作を確かめていない場合は、報告にそう明記する。
  - 見た目の確認は、開発サーバー（`npx vite --port 5199 --strictPort` をバックグラウンドで起動）を、インストール済みの Chrome のヘッドレスモードで開いてスクリーンショットを撮ればできる（`chrome.exe --headless=new --user-data-dir=<作業用フォルダ> --window-size=1000,600 --virtual-time-budget=3000 --screenshot=<出力先>.png http://localhost:5199/`）。新しいプロファイルで開くので、localStorage は空（メイン回路だけ）の状態になる。終わったらサーバーを止める。
- コミットはユーザーに頼まれたときだけ行う。
- `npm test` がまれに、全テストファイルの読み込みに失敗して「no tests」で終わることがある。再実行すると通る。原因は未特定（作業ディレクトリのドライブ名が `c:` と `C:` で切り替わった直後に起きやすいが、意図して再現はできていない）。個別のテストが失敗しているのではなく全ファイルがまとめて読み込めない場合は、まず再実行する。

## Claude Code

- Edit / Write でファイルを編集するたびに、フック（`.claude/settings.json` → `.claude/hooks/format.mjs`）が Prettier で整形する。シェルからの書き込み（sed、スクリプトなど）には効かないので、その場合は自分で整形する。
