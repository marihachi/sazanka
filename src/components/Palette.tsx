import trashIcon from '../assets/icons/trash.svg';
import type { CircuitDef } from '../engine/project';
import type { Kind } from '../engine/sim';
import { LABELS } from './ComponentView';
import { classNames } from './classNames';
import { MaskIcon, PartIcon } from './Icons';
import styles from './Palette.module.css';

const GROUPS: { title: string; kinds: Kind[] }[] = [
  { title: '入出力', kinds: ['INPUT', 'CLOCK', 'HIGH', 'OUTPUT'] },
  { title: '論理ゲート', kinds: ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'] },
  { title: 'ラッチ', kinds: ['RS'] },
  { title: 'フリップフロップ', kinds: ['DFF', 'TFF', 'JKFF'] },
];

/** パレットの部品のツールチップ。部品の働きを1文で説明する */
const DESCRIPTIONS: Partial<Record<Kind, string>> = {
  INPUT: '入力スイッチ。クリックで ON/OFF を切り替える',
  CLOCK: '一定の周期で ON/OFF を繰り返す',
  HIGH: '常に ON を出力する',
  OUTPUT: '入力が ON のとき点灯するランプ',
  AND: 'すべての入力が ON のとき ON',
  OR: 'どれかの入力が ON のとき ON',
  NOT: '入力を反転する',
  NAND: 'AND の反転。すべての入力が ON のときだけ OFF',
  NOR: 'OR の反転。すべての入力が OFF のときだけ ON',
  XOR: '2つの入力が異なるとき ON',
  RS: 'S で ON、R で OFF にして値を保持する。クロックはなく、入力にすぐ反応する',
  DFF: 'CLK が OFF から ON になった瞬間に D の値を取り込み、保持する',
  TFF: 'CLK が OFF から ON になった瞬間に、T が ON なら出力を反転する',
  JKFF: 'CLK が OFF から ON になった瞬間に、J で ON、K で OFF、両方 ON なら反転する',
  CUSTOM: '回路をまとめた部品。シート上でダブルクリックすると中身を開く',
};

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
    <div className={styles.sidebar}>
      <aside className={styles.palette}>
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
          {modules.length === 0 && <p className={styles.empty}>モジュールはまだありません</p>}
        </section>
      </aside>
      <div
        ref={trashRef}
        className={classNames(
          styles.trash,
          dragMode !== 'none' && styles.dragging,
          dragMode === 'trash' && styles.active,
        )}
      >
        <MaskIcon src={trashIcon} className={styles.trashIcon} />
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
      className={kind === 'CUSTOM' ? styles.custom : undefined}
      disabled={disabled}
      // 置けないモジュールは、説明よりも置けない理由を見せる
      title={disabledReason ?? DESCRIPTIONS[kind]}
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
