import chevronIcon from '../assets/icons/chevron.svg';
import collapseAllIcon from '../assets/icons/collapse-all.svg';
import expandAllIcon from '../assets/icons/expand-all.svg';
import trashIcon from '../assets/icons/trash.svg';
import type { ComponentKind } from '../engine/component';
import type { CircuitDef } from '../engine/project';
import { DRAG_MIME, LABELS, type PaletteDrag } from './parts';
import { classNames } from './classNames';
import { MaskIcon, PartIcon } from './Icons';
import styles from './Palette.module.css';

/**
 * 部品のグループ。id は折り畳みの状態の保存に使うので、一度決めたら変えない。
 * 変えると、利用者が折り畳んでいた状態が失われる (見出しの title は変えてよい)
 */
const GROUPS: { id: string; title: string; kinds: ComponentKind[] }[] = [
  // INPUT / OUTPUT はモジュールのピンにもなる。自分で信号を出す CLOCK / HIGH は「信号源」に分ける
  { id: 'io', title: '入出力', kinds: ['INPUT', 'OUTPUT'] },
  { id: 'source', title: '信号源', kinds: ['CLOCK', 'HIGH'] },
  {
    id: 'gate',
    title: '論理ゲート',
    kinds: ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'],
  },
  { id: 'latch', title: 'ラッチ', kinds: ['RS', 'RSEN', 'DLATCH'] },
  { id: 'flipflop', title: 'フリップフロップ', kinds: ['DFF', 'TFF', 'JKFF'] },
];

/** モジュールのグループ。部品のグループと同じく、id は変えない */
const MODULE_GROUP = { id: 'module', title: 'モジュール' };
const GROUP_IDS = [...GROUPS.map((g) => g.id), MODULE_GROUP.id];

/** パレットの部品のツールチップ。部品の働きを1文で説明する */
const DESCRIPTIONS: Partial<Record<ComponentKind, string>> = {
  INPUT:
    '入力スイッチ。クリックで ON/OFF を切り替える。モジュールの中に置くと、そのモジュールの入力ピンになる',
  CLOCK: '一定の周期で ON/OFF を繰り返す',
  HIGH: '常に ON を出力する',
  OUTPUT:
    '入力が ON のとき点灯するランプ。モジュールの中に置くと、そのモジュールの出力ピンになる',
  AND: 'すべての入力が ON のとき ON',
  OR: 'どれかの入力が ON のとき ON',
  NOT: '入力を反転する',
  NAND: 'AND の反転。すべての入力が ON のときだけ OFF',
  NOR: 'OR の反転。すべての入力が OFF のときだけ ON',
  XOR: '2つの入力が異なるとき ON',
  RS: 'S で ON、R で OFF にして値を保持する。クロックはなく、入力にすぐ反応する',
  RSEN: 'EN が ON の間だけ、S で ON、R で OFF にする。EN が OFF の間は値を保持する',
  DLATCH:
    'EN が ON の間は D の値をそのまま出し、OFF になると直前の値を保持する',
  DFF: 'CLK が OFF から ON になった瞬間に D の値を取り込み、保持する',
  TFF: 'CLK が OFF から ON になった瞬間に、T が ON なら出力を反転する',
  JKFF: 'CLK が OFF から ON になった瞬間に、J で ON、K で OFF、両方 ON なら反転する',
  CUSTOM: '回路をまとめた部品。シート上でダブルクリックすると中身を開く',
};

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
  /** 折り畳んでいるグループの ID */
  collapsed: string[];
  onCollapsedChange: (collapsed: string[]) => void;
  onAdd: (kind: ComponentKind, custom?: string) => void;
}

/** 左側のパネル。部品の一覧と、下端の削除エリア */
export function Palette({
  modules,
  dragMode,
  trashRef,
  collapsed,
  onCollapsedChange,
  onAdd,
}: PaletteProps) {
  const allCollapsed = GROUP_IDS.every((id) => collapsed.includes(id));
  const toggleLabel = allCollapsed ? 'すべて展開' : 'すべて折りたたむ';
  const onToggleGroup = (id: string) =>
    onCollapsedChange(
      collapsed.includes(id)
        ? collapsed.filter((c) => c !== id)
        : [...collapsed, id],
    );

  return (
    <div className={styles.sidebar}>
      <div className={styles.toolbar}>
        <button
          className={styles.tool}
          title={toggleLabel}
          aria-label={toggleLabel}
          onClick={() => onCollapsedChange(allCollapsed ? [] : GROUP_IDS)}
        >
          <MaskIcon
            src={allCollapsed ? expandAllIcon : collapseAllIcon}
            className={styles.toolIcon}
          />
        </button>
      </div>
      <aside className={styles.palette}>
        {GROUPS.map((group) => (
          <PaletteGroup
            key={group.id}
            id={group.id}
            title={group.title}
            collapsed={collapsed}
            onToggle={onToggleGroup}
          >
            {group.kinds.map((k) => (
              <PaletteItem
                key={k}
                label={LABELS[k] ?? k}
                kind={k}
                onAdd={() => onAdd(k)}
              />
            ))}
          </PaletteGroup>
        ))}
        <PaletteGroup
          id={MODULE_GROUP.id}
          title={MODULE_GROUP.title}
          collapsed={collapsed}
          onToggle={onToggleGroup}
        >
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
          {modules.length === 0 && (
            <p className={styles.empty}>モジュールはまだありません</p>
          )}
        </PaletteGroup>
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

interface PaletteGroupProps {
  id: string;
  title: string;
  collapsed: string[];
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

/** 見出しをクリックすると折り畳めるグループ */
function PaletteGroup({
  id,
  title,
  collapsed,
  onToggle,
  children,
}: PaletteGroupProps) {
  const open = !collapsed.includes(id);
  return (
    <section className={open ? undefined : styles.collapsed}>
      <h3>
        <button
          className={styles.groupToggle}
          aria-expanded={open}
          onClick={() => onToggle(id)}
        >
          <MaskIcon src={chevronIcon} className={styles.chevron} />
          {title}
        </button>
      </h3>
      {open && children}
    </section>
  );
}

interface PaletteItemProps {
  label: string;
  kind: ComponentKind;
  custom?: string;
  /** 置けない場合の理由。あればグレーアウトし、理由をツールチップに出す */
  disabledReason?: string;
  onAdd: () => void;
}

/** クリックで追加、シートへドラッグで好きな位置に追加 */
function PaletteItem({
  label,
  kind,
  custom,
  disabledReason,
  onAdd,
}: PaletteItemProps) {
  const disabled = !!disabledReason;
  return (
    <button
      className={classNames(styles.item, kind === 'CUSTOM' && styles.custom)}
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
