import { useState } from 'react';
import type { ConfirmRequest } from '../components/dialogs/ConfirmDialog';
import type { Selection } from '../components/Sheet';
import { newId, type Circuit, type PinRef } from '../engine/circuit';
import * as edit from '../engine/edit';
import type { Point } from '../engine/layout';
import { dependsOn } from '../engine/module';
import { type CircuitDef, findDef, type Project } from '../engine/project';

/** 部品のコピー・切り取り・貼り付け。貼り付けは、位置をシートのクリックで決める */
export function useClipboard({
  project,
  circuit,
  selection,
  onSelect,
  onPendingChange,
  setCircuit,
  deleteComponents,
  showConfirm,
}: {
  project: Project;
  /** 開いている回路 */
  circuit: CircuitDef;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onPendingChange: (pending: PinRef | null) => void;
  /** 開いている回路を、元に戻せる編集として更新する */
  setCircuit: (update: (c: CircuitDef) => CircuitDef) => void;
  deleteComponents: (ids: string[]) => void;
  showConfirm: (request: ConfirmRequest) => void;
}) {
  /** コピーした部品と配線 */
  const [clipboard, setClipboard] = useState<Circuit | null>(null);
  /** 貼り付ける位置を選んでいる部品と配線。クリックした位置で確定する */
  const [placing, setPlacing] = useState<Circuit | null>(null);

  function copy() {
    if (selection?.type !== 'comp') {
      return;
    }
    setClipboard(edit.extractComponents(circuit, selection.ids));
  }

  function cut() {
    if (selection?.type !== 'comp') {
      return;
    }
    copy();
    deleteComponents(selection.ids);
  }

  /** コピーした部品の貼り付けを始める。位置はシートをクリックして決める */
  function startPaste() {
    if (!clipboard || clipboard.components.length === 0) {
      return;
    }
    // モジュールを、それ自身の中や、それを含む回路に貼ると循環してしまう
    const blocked = clipboard.components.find(
      (c) =>
        c.kind === 'CUSTOM' &&
        c.custom &&
        (c.custom === circuit.id || dependsOn(project, c.custom, circuit.id)),
    );
    if (blocked) {
      const name = findDef(project, blocked.custom)?.name ?? '';
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
    const clone = edit.cloneComponents(placing, newId, delta);
    setCircuit((cur) => edit.addParts(cur, clone));
    onSelect({ type: 'comp', ids: clone.components.map((c) => c.id) });
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
