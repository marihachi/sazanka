import { useState } from 'react';
import type { ConfirmRequest } from '../ui/ConfirmDialog';
import type { Selection } from './edit';
import { newId, type Circuit } from '../circuit/circuit';
import * as edit from './edit';
import type { Point } from '../geometry/layout';
import { assignPinNumbers, dependsOn } from '../circuit/module';
import { type CircuitDef, findDef, type Project } from '../circuit/project';

/** 部品と配線のコピー・切り取り・貼り付け。貼り付けは、位置をシートのクリックで決める */
export function useClipboard({
  project,
  circuit,
  selection,
  onSelect,
  onPendingChange,
  setCircuit,
  deleteSelection,
  showConfirm,
}: {
  project: Project;
  /** 開いている回路 */
  circuit: CircuitDef;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onPendingChange: (pending: Point[] | null) => void;
  /** 開いている回路を、元に戻せる編集として更新する */
  setCircuit: (update: (c: CircuitDef) => CircuitDef) => void;
  deleteSelection: () => void;
  showConfirm: (request: ConfirmRequest) => void;
}) {
  /** コピーした部品と配線 */
  const [clipboard, setClipboard] = useState<Circuit | null>(null);
  /** 貼り付ける位置を選んでいる部品と配線。クリックした位置で確定する */
  const [placing, setPlacing] = useState<Circuit | null>(null);

  function copy() {
    if (!selection) {
      return;
    }
    setClipboard(edit.extractParts(circuit, selection.comps, selection.wires));
  }

  function cut() {
    if (!selection) {
      return;
    }
    copy();
    deleteSelection();
  }

  /** コピーした部品の貼り付けを始める。位置はシートをクリックして決める */
  function startPaste() {
    if (!clipboard || (clipboard.parts.length === 0 && clipboard.wires.length === 0)) {
      return;
    }
    // モジュールを、それ自身の中や、それを含む回路に貼ると循環してしまう
    const blocked = clipboard.parts.find(
      (c) =>
        c.kind === 'module' &&
        c.module &&
        (c.module === circuit.id || dependsOn(project, c.module, circuit.id)),
    );
    if (blocked) {
      const name = findDef(project, blocked.module)?.name ?? '';
      showConfirm({
        message: `「${name}」はこの回路を含んでいるため、ここには貼り付けられません`,
      });
      return;
    }
    onPendingChange(null);
    setPlacing(clipboard);
  }

  /** 貼り付ける位置が決まった。delta はコピー元の位置からのずれ */
  function paste(delta: Point) {
    if (!placing) {
      return;
    }
    const clone = edit.cloneParts(placing, newId, delta);
    // 貼り付けた INPUT / OUTPUT のピン番号は、貼り付け先に合わせて付け直す
    setCircuit((cur) =>
      assignPinNumbers(edit.addParts(cur, clone), new Set(clone.parts.map((c) => c.id))),
    );
    onSelect(
      edit.selectionOf(
        clone.parts.map((c) => c.id),
        clone.wires.map((w) => w.id),
      ),
    );
    setPlacing(null);
  }

  return {
    /** 貼り付ける位置を選んでいる部品と配線 */
    placing,
    copy,
    cut,
    startPaste,
    paste,
    /** 貼り付けをやめる (回路を切り替えたとき、Esc など) */
    cancelPaste: () => setPlacing(null),
  };
}
