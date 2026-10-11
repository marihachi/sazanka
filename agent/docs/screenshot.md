# README のスクリーンショット

README の `screenshot.png` を撮り直すときの手順と、写す回路。画像は英語版（`README.md`）と日本語版（`README.ja.md`）で共通。画面の見た目を大きく変えたら撮り直す。ヘッドレスブラウザの動かし方は Skill の `browser-check` と[ブラウザでの動作確認](browser-check.md)にある。

## 撮り方

1. `npx vite build` のあと `npx vite preview --port 5199 --strictPort` で、ビルドしたものを開く（開発用のサーバーでは開発用の表示が混ざることがあるため）。
2. 表示言語を決める。言語は、保存した環境設定がなければブラウザの言語で決まり、ヘッドレスの Chrome ではたいてい英語になる。英語で撮る（開発者が決めた）。`sazanka.preferences` の `language` に `'en'` を書いて指定する（[ブラウザでの動作確認](browser-check.md)の「表示言語」）。英語版の README を主にしているのに合わせるため。
3. 画面の大きさを 1242×1120 にする（今の画像と同じ。README での見え方が変わらないように）。
   - スクロールバーも写す（パレットのスクロールバー）。Puppeteer は既定でブラウザを `--hide-scrollbars` 付きで起動するので、`launch` の `ignoreDefaultArgs: ['--hide-scrollbars']` で外す。外さないと、スクロールバーのない、実際の画面と違う画像になる。
4. 下の「写す回路」を保存データ（`sazanka.project`）に書き、`sazanka.views`（シートの表示）と `sazanka.paletteCollapsed`（パレットの折り畳み）を消して開き直す。表示を消したので、回路全体が見える表示（この回路では倍率 100%）で開く。
   - 2 の環境設定も、ここで一緒に書く。
   - 回路に CLOCK があり、アプリが自動保存を続けるので、書いた値が上書きされやすい。一度開いてから、`page.evaluateOnNewDocument` で書いて再読み込みし、読み込んだら `removeScriptToEvaluateOnNewDocument` で外す（Skill の `browser-check` の「ハマりやすい点」）。
5. 倍率が 100% でなければ、ズームの「回路全体を表示」を押す。
6. INPUT の ON/OFF は保存データから読まないので、画面でクリックして切り替える。押す位置は、本体の真ん中の回路の座標を、シートの `<g transform>` で画面の座標に直して求める（[ブラウザでの動作確認](browser-check.md)の「状態の用意」）。
   - 上の 2 つの INPUT、IN0 (2680, 1800) と IN1 (2680, 1880) の真ん中を順にクリックして ON にする。座標はアプリの中の px（保存データのマスの 20 倍）。3 つ目の IN2 は OFF のままにする（開発者が決めた）。最後にクリックした IN1 が選ばれた状態になり、プロパティ欄に INPUT の項目が出る。右端の OUTPUT（OUT0）は、IN2 が OFF なので点灯しない。
7. ポインターをシートの何もない所（部品の上でない所）へ動かし、ヒントが落ち着くまで 1〜2 秒待つ。
8. CLOCK が ON の間に、画面全体を PNG で撮る（開発者が決めた）。CLOCK は 0.5 秒ごとに切り替わるので、CLOCK の配線の分岐の印（クラスに `junction` を含む要素）が OFF から ON（クラスに `on` を含む）に変わるのを待ち、その直後に撮る。
9. 撮った画像を見て、次を確かめる: 英語で表示されている（ヘッダーが New / Import / Export）、パレットのスクロールバーが写っている、CLOCK の配線が点灯している、IN0 と IN1 が ON で IN2 が OFF、IN1 が選ばれている（枠がアクセントカラー）、ツールチップやダイアログが写り込んでいない、エラーがない。
10. 撮った画像で `screenshot.png` を置き換える。プレビューのサーバーを止め、ポート 5199 で待ち受けるプロセスが残っていないかも確かめる（[ブラウザでの動作確認](browser-check.md)の「Claude Code」）。

## 写す回路

AND と D Latch をまとめたモジュール（AND Memory）を 2 つつなぎ、INPUT・OUTPUT のポート番号とポート名、CLOCK も並べて、このアプリでできることが一目で分かるようにしている。座標は、回路全体を表示したときに今の配置になる値。形式は version 4（位置はマス単位）。

```json
{"version":4,"project":{"circuits":[{"id":"main","sheet":{"width":300,"height":200},"parts":[{"id":"280d5d1c-d379-4714-b557-76688ad399a7","kind":"input","x":133,"y":89,"portNumber":1,"portName":"IN0"},{"id":"7fb4e6c8-1561-45aa-9717-a6ca993f1ac0","kind":"input","x":133,"y":93,"portNumber":2,"portName":"IN1"},{"id":"6826e070-f438-4a7b-a39c-794c82c9af9f","kind":"output","x":164,"y":92,"portNumber":1,"portName":"OUT0"},{"id":"72a792f6-ed1c-4bca-9a0e-792e69854461","kind":"module","x":143,"y":89,"module":"e4c364b7-5aa0-4ca1-a43c-298c0bb4c5e8"},{"id":"2cf4cb74-07a6-4476-926a-5aca43a8c46f","kind":"module","x":155,"y":92,"module":"e4c364b7-5aa0-4ca1-a43c-298c0bb4c5e8"},{"id":"5a558098-71e5-4005-837b-2fc1962d1d4b","kind":"input","x":133,"y":97,"portNumber":3,"portName":"IN2"},{"id":"7b1021de-2a36-4e81-be7c-b1d518dd1fd9","kind":"clock","x":133,"y":102}],"wires":[{"id":"ebec991e-7806-44b7-bfb6-129447f2cc60","points":[{"x":160,"y":93},{"x":163,"y":93}]},{"id":"29d052eb-4ce5-4554-bc9c-b57dcd395d14","points":[{"x":136,"y":90},{"x":142,"y":90}]},{"id":"b70b1dd1-0e98-4219-8366-76b9e5d47a70","points":[{"x":136,"y":94},{"x":137,"y":94},{"x":137,"y":91},{"x":142,"y":91}]},{"id":"8cbface0-3989-4ae2-9189-f16864b9f525","points":[{"x":142,"y":92},{"x":141,"y":92},{"x":141,"y":103}]},{"id":"856df9b6-e800-42ab-ad85-a7870be91a97","points":[{"x":154,"y":95},{"x":153,"y":95},{"x":153,"y":103},{"x":136,"y":103}]},{"id":"e4da54e8-e820-4e62-ba4b-303687cb70c5","points":[{"x":136,"y":98},{"x":150,"y":98},{"x":150,"y":94},{"x":154,"y":94}]},{"id":"41ec2ea6-9ba3-477a-b832-6a53d70b63c5","points":[{"x":148,"y":90},{"x":150,"y":90},{"x":150,"y":93},{"x":154,"y":93}]}]},{"id":"e4c364b7-5aa0-4ca1-a43c-298c0bb4c5e8","name":"AND Memory","package":{"kind":"split"},"sheet":{"width":300,"height":200},"parts":[{"id":"035fd980-551d-42ac-8e4e-d44e2d9997f8","kind":"and","x":144,"y":94},{"id":"ba71b4cb-c8f2-4661-87c0-dbe796d23a5e","kind":"input","x":134,"y":93,"portNumber":1,"portName":"IN0"},{"id":"d2d8ee5f-e5f9-4214-bf1e-b06c456b11ed","kind":"input","x":134,"y":97,"portNumber":2,"portName":"IN1"},{"id":"13f40cec-0b3e-4827-b99f-f15bab862355","kind":"output","x":163,"y":97,"portNumber":1,"portName":"OUT0"},{"id":"cd7194aa-4c04-4d77-b133-ea2f5e5049eb","kind":"dLatch","x":155,"y":97},{"id":"87f20c1e-4e80-4444-a6d1-fa9ba0176128","kind":"input","x":134,"y":101,"portNumber":3,"portName":">CLK"}],"wires":[{"id":"af0b2262-5805-4b0f-abaf-34042ae329a3","points":[{"x":137,"y":94},{"x":140,"y":94},{"x":140,"y":95},{"x":143,"y":95}]},{"id":"f65415ba-665d-4cb8-af99-2567632abd65","points":[{"x":137,"y":98},{"x":140,"y":98},{"x":140,"y":97},{"x":143,"y":97}]},{"id":"d44dd890-a1b3-4fe6-9129-429a24038e13","points":[{"x":137,"y":102},{"x":151,"y":102},{"x":151,"y":99},{"x":154,"y":99}]},{"id":"9970a463-1fcc-4c8c-bdb1-88a9f50c6427","points":[{"x":148,"y":96},{"x":151,"y":96},{"x":151,"y":98},{"x":154,"y":98}]},{"id":"6953238f-f4d2-4df9-8eba-6fc223990618","points":[{"x":159,"y":98},{"x":162,"y":98}]}]}]}}
```
