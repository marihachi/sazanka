import trashIcon from '../assets/icons/trash.svg';
import type { CircuitDef } from '../engine/project';
import type { Kind } from '../engine/sim';
import { LABELS } from './ComponentView';
import { MaskIcon, PartIcon } from './Icons';
import './Palette.css';

const GROUPS: { title: string; kinds: Kind[] }[] = [
  { title: '入出力', kinds: ['INPUT', 'CLOCK', 'OUTPUT'] },
  { title: '論理ゲート', kinds: ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'] },
  { title: 'ラッチ', kinds: ['RS'] },
  { title: 'フリップフロップ', kinds: ['DFF', 'TFF', 'JKFF'] },
];

/** パレットからシートへドラッグするときの dataTransfer の型 */
export const DRAG_MIME = 'application/x-sazanka-part';

export interface PaletteDrag {
  kind: Kind;
  custom?: string;
}

export interface PaletteModule {
  def: CircuitDef;
  /** 今の回路に置けない理由 */
  blocked?: string;
}

interface PaletteProps {
  modules: PaletteModule[];
  /** 部品をドラッグ中か。'trash' は削除エリアの上 */
  dragMode: 'none' | 'moving' | 'trash';
  trashRef: React.Ref<HTMLDivElement>;
  onAdd: (kind: Kind, custom?: string) => void;
}

/** 左側のパネル。部品の一覧と、下端の削除エリア */
export function Palette({ modules, dragMode, trashRef, onAdd }: PaletteProps) {
  return (
    <div className="sidebar">
      <aside className="palette">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            {group.kinds.map((k) => (
              <PaletteItem key={k} label={LABELS[k] ?? k} kind={k} onAdd={() => onAdd(k)} />
            ))}
          </section>
        ))}
        <section>
          <h3>モジュール</h3>
          {modules.map(({ def, blocked }) => (
            <PaletteItem
              key={def.id}
              label={def.name}
              kind="CUSTOM"
              custom={def.id}
              disabledReason={blocked}
              onAdd={() => onAdd('CUSTOM', def.id)}
            />
          ))}
          {modules.length === 0 && <p className="empty">モジュールはまだありません</p>}
        </section>
      </aside>
      <div
        ref={trashRef}
        className={`trash${dragMode !== 'none' ? ' dragging' : ''}${dragMode === 'trash' ? ' active' : ''}`}
      >
        <MaskIcon src={trashIcon} className="trash-icon" />
        ここへドラッグで削除
      </div>
    </div>
  );
}

interface PaletteItemProps {
  label: string;
  kind: Kind;
  custom?: string;
  /** 置けない場合の理由。あればグレーアウトし、理由をツールチップに出す */
  disabledReason?: string;
  onAdd: () => void;
}

/** クリックで追加、シートへドラッグで好きな位置に追加 */
function PaletteItem({ label, kind, custom, disabledReason, onAdd }: PaletteItemProps) {
  const disabled = !!disabledReason;
  return (
    <button
      className={kind === 'CUSTOM' ? 'custom' : undefined}
      disabled={disabled}
      title={disabledReason}
      draggable={!disabled}
      onClick={onAdd}
      onDragStart={(e) => {
        const data: PaletteDrag = { kind, custom };
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(data));
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <PartIcon kind={kind} />
      <span>{label}</span>
    </button>
  );
}
