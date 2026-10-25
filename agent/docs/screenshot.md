# README のスクリーンショット

README の `screenshot.png` を撮り直すときの手順と、写す回路。画像は英語版（`README.md`）と日本語版（`README.ja.md`）で共通。画面の見た目を大きく変えたら撮り直す。ヘッドレスブラウザの動かし方は Skill の `browser-check` と[ブラウザでの動作確認](browser-check.md)にある。

## 撮り方

1. `npx vite build` のあと `npx vite preview --port 5199 --strictPort` で、ビルドしたものを開く（開発用のサーバーでは開発用の表示が混ざることがあるため）。
2. 表示言語を決める。言語は、保存した環境設定がなければブラウザの言語で決まり、ヘッドレスの Chrome ではたいてい英語になる。英語で撮る（開発者が決めた）。`sazanka.preferences` の `language` に `'en'` を書いて指定する（[ブラウザでの動作確認](browser-check.md)の「表示言語」）。英語版の README を主にしているのに合わせるため。
3. 画面の大きさを 1242×1120 にする（今の画像と同じ。README での見え方が変わらないように）。
   - スクロールバーも写す（パレットのスクロールバー）。Puppeteer は既定でブラウザを `--hide-scrollbars` 付きで起動するので、`launch` の `ignoreDefaultArgs: ['--hide-scrollbars']` で外す。外さないと、スクロールバーのない、実際の画面と違う画像になる。
4. 下の「写す回路」を保存データ（`sazanka.project`）に書き、`sazanka.views`（シートの表示）と `sazanka.paletteCollapsed`（パレットの折り畳み）を消して開き直す。表示を消したので、回路全体が見える表示（この回路では倍率 100%）で開く。
   - 2 の環境設定も、ここで一緒に書く。
   - タブ（`sazanka.tabs`）に `{"open":["main","3f6b2c1e-8d4a-4f0b-9c7e-5a2d1b6e4f90"],"current":"main"}` を書き、メイン回路と Half Adder のタブを開いてメイン回路を選ぶ。書かないと、タブのない（回路を開いていない）画面で開く。
   - サイドパネル（`sazanka.sidePanel`）に `parts` を書き、パレットを出す。書かないと、プロジェクトパネルで開く。
   - 回路に CLOCK があり、アプリが自動保存を続けるので、書いた値が上書きされやすい。一度開いてから、`page.evaluateOnNewDocument` で書いて再読み込みし、読み込んだら `removeScriptToEvaluateOnNewDocument` で外す（Skill の `browser-check` の「ハマりやすい点」）。
5. 倍率が 100% でなければ、ズームの「回路全体を表示」を押す。
6. INPUT の ON/OFF は保存データから読まないので、画面でクリックして切り替える。押す位置は、本体の真ん中の回路の座標を、シートの `<g transform>` で画面の座標に直して求める（[ブラウザでの動作確認](browser-check.md)の「状態の用意」）。
   - 上の 2 つの INPUT、A (2620, 1820) と B (2620, 1900) の真ん中を順にクリックして ON にする。座標はアプリの中の px（保存データのマスの 20 倍）。3 つ目の Cin は OFF のままにする。1 + 1 + 0 の足し算になり、右の OUTPUT の S は消え、Cout は点く。最後にクリックした B が選ばれた状態になり、プロパティ欄に INPUT の項目が出る。
7. ポインターをシートの何もない所（部品の上でない所）へ動かし、ヒントが落ち着くまで 1〜2 秒待つ。
8. CLOCK が ON の間に、画面全体を PNG で撮る（開発者が決めた）。CLOCK は 0.5 秒ごとに切り替わるので、CLOCK の本体の矩形波の絵（`path`）の線の色が、ON の色（`stroke` に `sheet-on` を含む）に変わるのを待ち、その直後に撮る。
9. 撮った画像を見て、次を確かめる: 英語で表示されている（ヘッダーに File のメニューがある）、パレットのスクロールバーが写っている、CLOCK と、NOT の手前の配線が点灯している（NOT の先の LED は消えている）、A と B が ON で Cin が OFF、S が消えて Cout が点いている、B が選ばれている（枠がアクセントカラー）、ゲートの記号（OR、NOT）が描かれている、ツールチップやダイアログが写り込んでいない、エラーがない。
10. 撮った画像で `screenshot.png` を置き換える。プレビューのサーバーを止め、ポート 5199 で待ち受けるプロセスが残っていないかも確かめる（[ブラウザでの動作確認](browser-check.md)の「Claude Code」）。

## 写す回路

全加算器（入力 A・B・Cin、出力 S・Cout）を、半加算器のモジュール（Half Adder。中は XOR と AND）2 つと OR で組み、その下に CLOCK → NOT → OUTPUT（LED）を置いている。足し算の意味、モジュールを作って使い回すこと、ゲートの記号、ポート名、CLOCK が一目で分かるようにしている（開発者が選んだ）。座標は、回路全体を表示したときに今の配置になる値。形式はプロジェクトの形式 version 1、回路の形式 version 2（位置はマス単位）。

```json
{"format":"sazanka-project","version":1,"folders":[],"circuits":[{"path":"","circuit":{"format":"sazanka-circuit","version":2,"id":"main","author":"","package":{"kind":"split"},"sheet":{"width":300,"height":200},"elements":[{"kind":"input","x":130,"y":90,"portNumber":1,"portName":"A"},{"kind":"input","x":130,"y":94,"portNumber":2,"portName":"B"},{"kind":"input","x":130,"y":98,"portNumber":3,"portName":"Cin"},{"kind":"output","x":163,"y":91,"portNumber":1,"portName":"S"},{"kind":"output","x":163,"y":95,"portNumber":2,"portName":"Cout"},{"kind":"output","x":144,"y":104,"portNumber":3,"portName":"LED"},{"kind":"clock","x":130,"y":104,"period":100},{"kind":"not","x":137,"y":104},{"kind":"module","x":138,"y":90,"circuitId":"3f6b2c1e-8d4a-4f0b-9c7e-5a2d1b6e4f90","circuitName":"Half Adder","circuitSize":{"width":4,"height":3}},{"kind":"module","x":148,"y":91,"circuitId":"3f6b2c1e-8d4a-4f0b-9c7e-5a2d1b6e4f90","circuitName":"Half Adder","circuitSize":{"width":4,"height":3}},{"kind":"or","x":156,"y":94},{"kind":"wire","points":[{"x":133,"y":91},{"x":137,"y":91}]},{"kind":"wire","points":[{"x":133,"y":95},{"x":135,"y":95},{"x":135,"y":92},{"x":137,"y":92}]},{"kind":"wire","points":[{"x":143,"y":91},{"x":145,"y":91},{"x":145,"y":92},{"x":147,"y":92}]},{"kind":"wire","points":[{"x":133,"y":99},{"x":146,"y":99},{"x":146,"y":93},{"x":147,"y":93}]},{"kind":"wire","points":[{"x":143,"y":92},{"x":144,"y":92},{"x":144,"y":101},{"x":154,"y":101},{"x":154,"y":97},{"x":155,"y":97}]},{"kind":"wire","points":[{"x":153,"y":92},{"x":162,"y":92}]},{"kind":"wire","points":[{"x":153,"y":93},{"x":154,"y":93},{"x":154,"y":95},{"x":155,"y":95}]},{"kind":"wire","points":[{"x":160,"y":96},{"x":162,"y":96}]},{"kind":"wire","points":[{"x":133,"y":105},{"x":136,"y":105}]},{"kind":"wire","points":[{"x":141,"y":105},{"x":143,"y":105}]}]}},{"path":"","circuit":{"format":"sazanka-circuit","version":2,"id":"3f6b2c1e-8d4a-4f0b-9c7e-5a2d1b6e4f90","author":"","package":{"kind":"split"},"sheet":{"width":300,"height":200},"name":"Half Adder","elements":[{"kind":"input","x":130,"y":95,"portNumber":1,"portName":"A"},{"kind":"input","x":130,"y":99,"portNumber":2,"portName":"B"},{"kind":"output","x":147,"y":95,"portNumber":1,"portName":"S"},{"kind":"output","x":147,"y":101,"portNumber":2,"portName":"C"},{"kind":"xor","x":140,"y":94},{"kind":"and","x":140,"y":100},{"kind":"wire","points":[{"x":133,"y":96},{"x":136,"y":96},{"x":136,"y":95},{"x":139,"y":95}]},{"kind":"wire","points":[{"x":136,"y":96},{"x":136,"y":101},{"x":139,"y":101}]},{"kind":"wire","points":[{"x":133,"y":100},{"x":137,"y":100},{"x":137,"y":97},{"x":139,"y":97}]},{"kind":"wire","points":[{"x":137,"y":100},{"x":137,"y":103},{"x":139,"y":103}]},{"kind":"wire","points":[{"x":144,"y":96},{"x":146,"y":96}]},{"kind":"wire","points":[{"x":144,"y":102},{"x":146,"y":102}]}]}}]}
```
