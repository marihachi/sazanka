import clearIcon from '../assets/icons/clear.svg';
import plusIcon from '../assets/icons/plus.svg';
import redoIcon from '../assets/icons/redo.svg';
import undoIcon from '../assets/icons/undo.svg';
import { ToolIcon } from './Icons';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddModule: () => void;
  onClear: () => void;
}

export function Toolbar({ canUndo, canRedo, onUndo, onRedo, onAddModule, onClear }: ToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <button className={styles.tool} onClick={onUndo} disabled={!canUndo} title="元に戻す (Ctrl+Z)">
        <ToolIcon src={undoIcon} />
        元に戻す
      </button>
      <button className={styles.tool} onClick={onRedo} disabled={!canRedo} title="やり直し (Ctrl+Shift+Z / Ctrl+Y)">
        <ToolIcon src={redoIcon} />
        やり直し
      </button>
      <span className={styles.divider} />
      <button className={styles.tool} onClick={onAddModule}>
        <ToolIcon src={plusIcon} />
        モジュールを追加
      </button>
      <button className={styles.tool} onClick={onClear} title="この回路をすべて消去">
        <ToolIcon src={clearIcon} />
        全消去
      </button>
    </div>
  );
}
