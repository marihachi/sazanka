# README のスクリーンショット

README の `screenshot.png` を撮り直すときの手順と、写す回路。画像は英語版（`README.md`）と日本語版（`README.ja.md`）で共通。画面の見た目を大きく変えたら撮り直す。ヘッドレスブラウザの動かし方は Skill の `browser-check` と[ブラウザでの動作確認](browser-check.md)にある。

## 撮り方

1. `npx vite build` のあと `npx vite preview --port 5199 --strictPort` で、ビルドしたものを開く（開発用のサーバーでは開発用の表示が混ざることがあるため）。
2. 表示言語を決める。言語は、保存した環境設定がなければブラウザの言語で決まり、ヘッドレスの Chrome ではたいてい英語になる。英語で撮る（開発者からの指示）。`sazanka.preferences` の `language` に `'en'` を書いて指定する（[ブラウザでの動作確認](browser-check.md)の「表示言語」）。英語版の README を主にしているのに合わせるため。
3. 画面の大きさを 1242×1120 にする（今の画像と同じ。README での見え方が変わらないように）。
   - スクロールバーも写す（パレットのスクロールバー）。Puppeteer は既定でブラウザを `--hide-scrollbars` 付きで起動するので、`launch` の `ignoreDefaultArgs: ['--hide-scrollbars']` で外す。外さないと、スクロールバーのない、実際の画面と違う画像になる。
4. 下の「写す回路」を保存データ（`sazanka.project`）に書き、`sazanka.views`（シートの表示）と `sazanka.paletteCollapsed`（パレットの折り畳み）を消して開き直す。表示を消したので、回路全体が見える表示（この回路では倍率 100%）で開く。
   - 2 の環境設定も、ここで一緒に書く。
   - タブ（`sazanka.tabs`）に `{"open":["main","e4c364b7-5aa0-4ca1-a43c-298c0bb4c5e8"],"current":"main"}` を書き、メイン回路と AND Memory のタブを開いてメイン回路を選ぶ。書かないと、タブのない（回路を開いていない）画面で開く。
   - サイドパネル（`sazanka.sidePanel`）に `parts` を書き、パレットを出す。書かないと、プロジェクトパネルで開く。
   - 回路に CLOCK があり、アプリが自動保存を続けるので、書いた値が上書きされやすい。一度開いてから、`page.evaluateOnNewDocument` で書いて再読み込みし、読み込んだら `removeScriptToEvaluateOnNewDocument` で外す（Skill の `browser-check` の「ハマりやすい点」）。
5. 倍率が 100% でなければ、ズームの「回路全体を表示」を押す。
6. INPUT の ON/OFF は保存データから読まないので、画面でクリックして切り替える。押す位置は、本体の真ん中の回路の座標を、シートの `<g transform>` で画面の座標に直して求める（[ブラウザでの動作確認](browser-check.md)の「状態の用意」）。
   - 上の 2 つの INPUT、IN0 (2680, 1800) と IN1 (2680, 1880) の真ん中を順にクリックして ON にする。座標はアプリの中の px（保存データのマスの 20 倍）。3 つ目の IN2 は OFF のままにする（開発者からの指示）。最後にクリックした IN1 が選ばれた状態になり、プロパティ欄に INPUT の項目が出る。右端の OUTPUT（OUT0）は、IN2 が OFF なので点灯しない。
7. ポインターをシートの何もない所（部品の上でない所）へ動かし、ヒントが落ち着くまで 1〜2 秒待つ。
8. CLOCK が ON の間に、画面全体を PNG で撮る（開発者からの指示）。CLOCK は 0.5 秒ごとに切り替わるので、CLOCK の配線の分岐の印（クラスに `junction` を含む要素）が OFF から ON（クラスに `on` を含む）に変わるのを待ち、その直後に撮る。
9. 撮った画像を見て、次を確かめる: 英語で表示されている（ヘッダーに File のメニューがある）、パレットのスクロールバーが写っている、CLOCK の配線が点灯している、IN0 と IN1 が ON で IN2 が OFF、IN1 が選ばれている（枠がアクセントカラー）、ツールチップやダイアログが写り込んでいない、エラーがない。
10. 撮った画像で `screenshot.png` を置き換える。プレビューのサーバーを止め、ポート 5199 で待ち受けるプロセスが残っていないかも確かめる（[ブラウザでの動作確認](browser-check.md)の「Claude Code」）。

## 写す回路

AND と D Latch をまとめたモジュール（AND Memory）を 2 つつなぎ、INPUT・OUTPUT のポート番号とポート名、CLOCK も並べて、このアプリでできることが一目で分かるようにしている。座標は、回路全体を表示したときに今の配置になる値。形式は version 4（位置はマス単位）。

```json
{"version":4,"project":{"circuits":[{"id":"main","sheet":{"width":300,"height":200},"elements":[{"kind":"input","x":133,"y":89,"portNumber":1,"portName":"IN0"},{"kind":"input","x":133,"y":93,"portNumber":2,"portName":"IN1"},{"kind":"input","x":133,"y":97,"portNumber":3,"portName":"IN2"},{"kind":"output","x":164,"y":92,"portNumber":1,"portName":"OUT0"},{"kind":"clock","x":133,"y":102},{"kind":"module","x":143,"y":89,"module":"e4c364b7-5aa0-4ca1-a43c-298c0bb4c5e8"},{"kind":"module","x":155,"y":92,"module":"e4c364b7-5aa0-4ca1-a43c-298c0bb4c5e8"},{"kind":"wire","points":[{"x":160,"y":93},{"x":163,"y":93}]},{"kind":"wire","points":[{"x":136,"y":90},{"x":142,"y":90}]},{"kind":"wire","points":[{"x":136,"y":94},{"x":137,"y":94},{"x":137,"y":91},{"x":142,"y":91}]},{"kind":"wire","points":[{"x":142,"y":92},{"x":141,"y":92},{"x":141,"y":103}]},{"kind":"wire","points":[{"x":154,"y":95},{"x":153,"y":95},{"x":153,"y":103},{"x":136,"y":103}]},{"kind":"wire","points":[{"x":136,"y":98},{"x":150,"y":98},{"x":150,"y":94},{"x":154,"y":94}]},{"kind":"wire","points":[{"x":148,"y":90},{"x":150,"y":90},{"x":150,"y":93},{"x":154,"y":93}]}]},{"id":"e4c364b7-5aa0-4ca1-a43c-298c0bb4c5e8","name":"AND Memory","package":{"kind":"split"},"sheet":{"width":300,"height":200},"elements":[{"kind":"input","x":134,"y":93,"portNumber":1,"portName":"IN0"},{"kind":"input","x":134,"y":97,"portNumber":2,"portName":"IN1"},{"kind":"input","x":134,"y":101,"portNumber":3,"portName":">CLK"},{"kind":"output","x":163,"y":97,"portNumber":1,"portName":"OUT0"},{"kind":"and","x":144,"y":94},{"kind":"dLatch","x":155,"y":97},{"kind":"wire","points":[{"x":137,"y":94},{"x":140,"y":94},{"x":140,"y":95},{"x":143,"y":95}]},{"kind":"wire","points":[{"x":137,"y":98},{"x":140,"y":98},{"x":140,"y":97},{"x":143,"y":97}]},{"kind":"wire","points":[{"x":137,"y":102},{"x":151,"y":102},{"x":151,"y":99},{"x":154,"y":99}]},{"kind":"wire","points":[{"x":148,"y":96},{"x":151,"y":96},{"x":151,"y":98},{"x":154,"y":98}]},{"kind":"wire","points":[{"x":159,"y":98},{"x":162,"y":98}]}]}]}}
```
