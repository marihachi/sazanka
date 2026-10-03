# README のスクリーンショット

README の `screenshot.png` を撮り直すときの手順と、写す回路。画面の見た目を大きく変えたら撮り直す。ヘッドレスブラウザの動かし方は Skill の `browser-check` と[ブラウザでの動作確認](browser-check.md)にある。

## 撮り方

1. `npx vite build` のあと `npx vite preview --port 5199 --strictPort` で、ビルドしたものを開く（開発用のサーバーでは開発用の表示が混ざることがあるため）。
2. 画面の大きさを 1242×1120 にする（今の画像と同じ。README での見え方が変わらないように）。
3. 下の「写す回路」を保存データ（`sazanka.project`）に書き、`sazanka.views`（シートの表示）と `sazanka.paletteCollapsed`（パレットの折り畳み）を消して開き直す。表示を消したので、回路全体が見える表示（この回路では倍率 100%）で開く。
4. 倍率が 100% でなければ、ズームの「回路全体を表示」を押す。
5. INPUT の ON/OFF は保存データから読まないので、画面でクリックして切り替える。
   - 左上の INPUT（AND につながる上側）をクリックして ON にする。
   - 左下の INPUT（D-FF の D につながるもの）をクリックして ON にする。最後にクリックした部品が選ばれた状態になり、プロパティ欄に INPUT の項目が出る。
6. D-FF が D の ON を取り込むまで（CLOCK の立ち上がりまで）4〜5 秒待つ。取り込むと Tri-state の Y と、右端の OUTPUT が点灯する。
7. ポインターをシートの何もない所（部品の上でない所）へ動かし、ヒントが落ち着くまで 1〜2 秒待ってから、画面全体を PNG で撮る。
8. 撮った画像を見て、次を確かめる: OUTPUT が点灯している、左下の INPUT が選ばれている（枠がアクセントカラー）、ツールチップやダイアログが写り込んでいない、エラーがない。

## 写す回路

AND と OR、モジュール（Tri-state）、D-FF と CLOCK を並べ、このアプリでできることが一目で分かるようにしている。座標は、回路全体を表示したときに今の配置になる値。

```json
{"version": 1, "project": {"circuits": [{"id": "main", "name": "メイン", "components": [{"id": "in1", "kind": "INPUT", "x": 2380, "y": 1860}, {"id": "in2", "kind": "INPUT", "x": 2380, "y": 2000}, {"id": "and", "kind": "AND", "x": 2560, "y": 1920}, {"id": "or", "kind": "OR", "x": 2740, "y": 2020}, {"id": "out", "kind": "OUTPUT", "x": 2900, "y": 2040}, {"id": "in3", "kind": "INPUT", "x": 2420, "y": 2100}, {"id": "tri", "kind": "CUSTOM", "custom": "tri", "x": 2540, "y": 2140}, {"id": "in4", "kind": "INPUT", "x": 2280, "y": 2180}, {"id": "dff", "kind": "DFF", "x": 2400, "y": 2240}, {"id": "clk", "kind": "CLOCK", "x": 2280, "y": 2320, "period": 200}], "wires": [{"id": "w1", "from": {"comp": "in1", "pin": 0}, "to": {"comp": "and", "pin": 0}, "points": []}, {"id": "w2", "from": {"comp": "in2", "pin": 0}, "to": {"comp": "and", "pin": 1}, "points": []}, {"id": "w3", "from": {"comp": "and", "pin": 0}, "to": {"comp": "or", "pin": 0}, "points": []}, {"id": "w4", "from": {"comp": "tri", "pin": 0}, "to": {"comp": "or", "pin": 1}, "points": []}, {"id": "w5", "from": {"comp": "or", "pin": 0}, "to": {"comp": "out", "pin": 0}, "points": []}, {"id": "w6", "from": {"comp": "in3", "pin": 0}, "to": {"comp": "tri", "pin": 0}, "points": []}, {"id": "w7", "from": {"comp": "dff", "pin": 0}, "to": {"comp": "tri", "pin": 1}, "points": []}, {"id": "w8", "from": {"comp": "in4", "pin": 0}, "to": {"comp": "dff", "pin": 0}, "points": []}, {"id": "w9", "from": {"comp": "clk", "pin": 0}, "to": {"comp": "dff", "pin": 1}, "points": []}]}, {"id": "tri", "name": "Tri-state (ActiveLow)", "components": [{"id": "e", "kind": "INPUT", "label": "E", "x": 2300, "y": 1800}, {"id": "a", "kind": "INPUT", "label": "A", "x": 2300, "y": 1900}, {"id": "not", "kind": "NOT", "x": 2420, "y": 1780}, {"id": "and", "kind": "AND", "x": 2560, "y": 1840}, {"id": "y", "kind": "OUTPUT", "label": "Y", "x": 2720, "y": 1860}], "wires": [{"id": "t1", "from": {"comp": "e", "pin": 0}, "to": {"comp": "not", "pin": 0}, "points": []}, {"id": "t2", "from": {"comp": "not", "pin": 0}, "to": {"comp": "and", "pin": 0}, "points": []}, {"id": "t3", "from": {"comp": "a", "pin": 0}, "to": {"comp": "and", "pin": 1}, "points": []}, {"id": "t4", "from": {"comp": "and", "pin": 0}, "to": {"comp": "y", "pin": 0}, "points": []}]}]}}
```
