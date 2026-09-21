import exportIcon from '../assets/icons/export.svg';
import importIcon from '../assets/icons/import.svg';
import newIcon from '../assets/icons/new.svg';
import pauseIcon from '../assets/icons/pause.svg';
import playIcon from '../assets/icons/play.svg';
import stepIcon from '../assets/icons/step.svg';
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
  onNew: () => void;
  /** シミュレーションが動いているか */
  running: boolean;
  onToggleRunning: () => void;
  /** 一時停止中に1段だけ進める */
  onStep: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function Toolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddModule,
  onNew,
  onExport,
  onImport,
  running,
  onToggleRunning,
  onStep,
}: ToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <button className={styles.tool} onClick={onNew} title="空のプロジェクトを新しく作る">
        <ToolIcon src={newIcon} />
        新規作成
      </button>
      <button className={styles.tool} onClick={onExport} title="プロジェクト全体を JSON にして共有する">
        <ToolIcon src={exportIcon} />
        書き出し
      </button>
      <button className={styles.tool} onClick={onImport} title="共有された JSON からプロジェクトを読み込む">
        <ToolIcon src={importIcon} />
        読み込み
      </button>
      <span className={styles.divider} />
      <button className={styles.tool} onClick={onUndo} disabled={!canUndo} title="元に戻す (Ctrl+Z)">
        <ToolIcon src={undoIcon} />
        元に戻す
      </button>
      <button className={styles.tool} onClick={onRedo} disabled={!canRedo} title="やり直し (Ctrl+Shift+Z / Ctrl+Y)">
        <ToolIcon src={redoIcon} />
        やり直し
      </button>
      <span className={styles.divider} />
      <button
        className={styles.tool}
        onClick={onToggleRunning}
        title={running ? 'シミュレーションを一時停止' : 'シミュレーションを再開'}
      >
        <ToolIcon src={running ? pauseIcon : playIcon} />
        {running ? '一時停止' : '再開'}
      </button>
      <button className={styles.tool} onClick={onStep} disabled={running} title="1 段だけ時間を進める">
        <ToolIcon src={stepIcon} />1 段進める
      </button>
      <span className={styles.divider} />
      <button className={styles.tool} onClick={onAddModule}>
        <ToolIcon src={plusIcon} />
        モジュールを追加
      </button>
    </div>
  );
}
