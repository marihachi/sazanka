import trashIcon from '../assets/icons/trash.svg';
import { MAIN_ID, type CircuitDef } from '../engine/project';
import { InlineInput } from './Dialogs';
import { MaskIcon } from './Icons';
import './TabBar.css';

interface TabBarProps {
  circuits: CircuitDef[];
  currentId: string;
  /** 名前を編集中のタブ */
  renamingId?: string;
  onOpen: (id: string) => void;
  onStartRename: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  /** 開いているモジュールを削除する */
  onDeleteCurrent: () => void;
}

/** 回路を切り替えるタブ。モジュールのタブはダブルクリックで名前を変更できる */
export function TabBar({
  circuits,
  currentId,
  renamingId,
  onOpen,
  onStartRename,
  onRename,
  onCancelRename,
  onDeleteCurrent,
}: TabBarProps) {
  return (
    <div className="tabbar">
      <div className="tabs" role="tablist">
        {circuits.map((d) =>
          renamingId === d.id ? (
            <InlineInput
              key={d.id}
              className="tab-input"
              initial={d.name}
              onCommit={(v) => onRename(d.id, v)}
              onCancel={onCancelRename}
            />
          ) : (
            <button
              key={d.id}
              role="tab"
              aria-selected={d.id === currentId}
              className={`tab${d.id === currentId ? ' active' : ''}`}
              onClick={() => onOpen(d.id)}
              onDoubleClick={() => d.id !== MAIN_ID && onStartRename(d.id)}
              title={d.id !== MAIN_ID ? 'ダブルクリックで名前を変更できます。' : undefined}
            >
              {d.name}
            </button>
          ),
        )}
      </div>
      {currentId !== MAIN_ID && (
        <div className="tabbar-actions">
          <button className="tool" onClick={onDeleteCurrent}>
            <MaskIcon src={trashIcon} className="tool-icon" />
            モジュールを削除
          </button>
        </div>
      )}
    </div>
  );
}
