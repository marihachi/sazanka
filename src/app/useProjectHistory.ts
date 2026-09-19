import { useCallback, useState } from 'react';
import { keepSwitchStates, type Project } from '../engine/project';
import { checkpoint, commit, initHistory, redo, replace, undo } from './history';

type Update = React.SetStateAction<Project>;

function apply(update: Update, current: Project): Project {
  return typeof update === 'function' ? update(current) : update;
}

/** 元に戻す / やり直しができるプロジェクトの状態 */
export function useProjectHistory(initial: () => Project) {
  const [history, setHistory] = useState(() => initHistory(initial()));

  return {
    project: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    /** 編集操作。元に戻せる */
    commit: useCallback((u: Update) => setHistory((h) => commit(h, apply(u, h.present))), []),
    /** 元に戻す対象でない変更 (スイッチ、クロック、ドラッグ中の移動) */
    replace: useCallback((u: Update) => setHistory((h) => replace(h, apply(u, h.present))), []),
    /** ここから後の replace を、1回の操作として元に戻せるようにする (ドラッグの開始時) */
    checkpoint: useCallback(() => setHistory(checkpoint), []),
    undo: useCallback(() => setHistory((h) => undo(h, keepSwitchStates)), []),
    redo: useCallback(() => setHistory((h) => redo(h, keepSwitchStates)), []),
  };
}
