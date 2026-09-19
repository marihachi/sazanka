# 編集と元に戻す

- 回路の編集は元に戻せる（Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y、ツールバーのボタン）。プロジェクト全体の状態をそのまま履歴に積む方式（`src/app/history.ts`、`useProjectHistory`）。
- 新しい編集操作を足すときは、元に戻す対象かどうかを決めて使い分ける。
  - 回路の編集（部品・配線・ラベル・モジュールの追加や変更や削除）は `history.commit`（App の `setCircuit` / `setProject` の既定）。
  - 回路の編集ではない変更（INPUT の ON/OFF、CLOCK の切り替わり）は `history.replace`（`setCircuit(..., false)`）。元に戻しても、INPUT / CLOCK の ON/OFF は今の値を引き継ぐ（`keepSwitchStates`）。
  - ドラッグのように連続する変更は、動き始めに `history.checkpoint()` を1回呼び、以降は `replace` で更新して、1回の操作として戻せるようにする。移動してから削除エリアで削除した場合も、移動と削除で1回。
- 元に戻すと、選択・配線中・名前の編集中の状態は解除する。戻した先に対象が存在しないことがあるため。
- 履歴は保存しない。ページを開き直すと元に戻せなくなる。
