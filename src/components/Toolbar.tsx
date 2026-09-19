import clearIcon from '../assets/icons/clear.svg';
import plusIcon from '../assets/icons/plus.svg';
import redoIcon from '../assets/icons/redo.svg';
import undoIcon from '../assets/icons/undo.svg';
import { MaskIcon } from './Icons';
import './Toolbar.css';

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
    <div className="toolbar actions">
      <button className="tool" onClick={onUndo} disabled={!canUndo} title="元に戻す (Ctrl+Z)">
        <MaskIcon src={undoIcon} className="tool-icon" />
        元に戻す
      </button>
      <button className="tool" onClick={onRedo} disabled={!canRedo} title="やり直し (Ctrl+Shift+Z / Ctrl+Y)">
        <MaskIcon src={redoIcon} className="tool-icon" />
        やり直し
      </button>
      <span className="divider" />
      <button className="tool" onClick={onAddModule}>
        <MaskIcon src={plusIcon} className="tool-icon" />
        モジュールを追加
      </button>
      <button className="tool" onClick={onClear} title="この回路をすべて消去">
        <MaskIcon src={clearIcon} className="tool-icon" />
        全消去
      </button>
    </div>
  );
}
