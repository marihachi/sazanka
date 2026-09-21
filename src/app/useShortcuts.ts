import { useEffect, useRef } from 'react';

export interface Shortcuts {
  /** false の間はキーを編集操作として扱わない (ダイアログ表示中など) */
  enabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onEscape: () => void;
}

/** 編集操作のキーボードショートカット */
export function useShortcuts(shortcuts: Shortcuts) {
  // リスナーは一度だけ登録し、呼び出し時点の最新の処理を使う
  const ref = useRef(shortcuts);
  useEffect(() => {
    ref.current = shortcuts;
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const s = ref.current;
      // 文字入力中も、キーを編集操作として扱わない
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (!s.enabled || typing) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && (key === 'z' || key === 'y')) {
        e.preventDefault();
        if (key === 'y' || e.shiftKey) s.onRedo();
        else s.onUndo();
        return;
      }
      if (mod && key === 'a') {
        e.preventDefault();
        s.onSelectAll();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') s.onDelete();
      if (e.key === 'Escape') s.onEscape();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
