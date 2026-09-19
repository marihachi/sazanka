import clearIcon from '../assets/icons/clear.svg';
import exportIcon from '../assets/icons/export.svg';
import importIcon from '../assets/icons/import.svg';
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
  onExport: () => void;
  onImport: () => void;
}

export function Toolbar({ canUndo, canRedo, onUndo, onRedo, onAddModule, onClear, onExport, onImport }: ToolbarProps) {
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
      <span className={styles.divider} />
      <button className={styles.tool} onClick={onExport} title="プロジェクト全体を JSON にして共有する">
        <ToolIcon src={exportIcon} />
        書き出し
      </button>
      <button className={styles.tool} onClick={onImport} title="共有された JSON からプロジェクトを読み込む">
        <ToolIcon src={importIcon} />
        読み込み
      </button>
    </div>
  );
}
