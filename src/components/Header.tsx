import exportIcon from '../assets/icons/export.svg';
import importIcon from '../assets/icons/import.svg';
import infoIcon from '../assets/icons/info.svg';
import logo from '../assets/logo.svg';
import newIcon from '../assets/icons/new.svg';
import redoIcon from '../assets/icons/redo.svg';
import undoIcon from '../assets/icons/undo.svg';
import { MaskIcon } from './Icons';
import styles from './Header.module.css';
import { ToolButton, ToolDivider } from './ToolButton';

interface HeaderProps {
  onNew: () => void;
  onExport: () => void;
  onImport: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAbout: () => void;
}

/**
 * 最上部のヘッダー。ロゴと、プロジェクト全体に効く操作 (新規作成、書き出し、読み込み、元に戻す、やり直し)。
 * 元に戻すの履歴はすべての回路で1本なので、全体の操作としてここに置く。開いている回路に効く操作はシートのツールバーにある
 */
export function Header({ onNew, onExport, onImport, canUndo, canRedo, onUndo, onRedo, onAbout }: HeaderProps) {
  return (
    <header className={styles.header}>
      <h1>
        <MaskIcon src={logo} className={styles.logo} />
        <span className="visually-hidden">sazanka</span>
      </h1>
      <nav className={styles.actions} aria-label="プロジェクトの操作">
        <ToolButton icon={newIcon} label="新規作成" title="空のプロジェクトを新しく作る" onClick={onNew} />
        <ToolButton
          icon={exportIcon}
          label="書き出し"
          title="プロジェクト全体を JSON にして共有する"
          onClick={onExport}
        />
        <ToolButton
          icon={importIcon}
          label="読み込み"
          title="共有された JSON からプロジェクトを読み込む"
          onClick={onImport}
        />
        <ToolDivider />
        <ToolButton icon={undoIcon} label="元に戻す" title="元に戻す (Ctrl+Z)" onClick={onUndo} disabled={!canUndo} />
        <ToolButton
          icon={redoIcon}
          label="やり直し"
          title="やり直し (Ctrl+Shift+Z / Ctrl+Y)"
          onClick={onRedo}
          disabled={!canRedo}
        />
      </nav>
      <button className={styles.about} onClick={onAbout} title="このアプリについて" aria-label="このアプリについて">
        <MaskIcon src={infoIcon} className={styles.aboutIcon} />
      </button>
    </header>
  );
}
