import { memo } from 'react';
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import chevronIcon from '../assets/icons/chevron.svg';
import collapseAllIcon from '../assets/icons/collapse-all.svg';
import expandAllIcon from '../assets/icons/expand-all.svg';
import { type ComponentKind, isSpecialKind, type SpecialKind } from '../engine/component';
import type { PartKind } from '../engine/parts';
import type { CircuitDef } from '../engine/project';
import {
  DRAG_MIME,
  labelOf,
  PART_VIEWS,
  type PaletteDrag,
  type PaletteGroupId,
  partViewOf,
} from './parts';
import { MaskIcon, PartIcon } from './Icons';
import { ToolButton } from './ToolButton';
import { HintTooltip } from './HintTooltip';

/**
 * 部品のグループ。id は折り畳みの状態の保存に使うので、一度決めたら変えない。
 * 変えると、利用者が折り畳んでいた状態が失われる (見出しの title は変えてよい)。
 * グループには、specials に挙げた特別な部品の後ろに、parts/ の見せ方でそのグループを選んだ種類が並ぶ
 */
const GROUPS: { id: PaletteGroupId; title: string; specials: SpecialKind[] }[] = [
  // INPUT / OUTPUT はモジュールのピンにもなる。自分で信号を出す CLOCK / HIGH は「信号源」に分ける
  { id: 'io', title: '入出力', specials: ['INPUT', 'OUTPUT'] },
  { id: 'source', title: '信号源', specials: ['CLOCK'] },
  { id: 'gate', title: '論理ゲート', specials: [] },
  { id: 'latch', title: 'ラッチ', specials: [] },
  { id: 'flipflop', title: 'フリップフロップ', specials: [] },
];

/** グループに並べる部品の種類 */
function kindsOf(group: (typeof GROUPS)[number]): ComponentKind[] {
  const parts = (Object.keys(PART_VIEWS) as PartKind[]).filter(
    (k) => PART_VIEWS[k].group === group.id,
  );
  return [...group.specials, ...parts];
}

/** モジュールのグループ。部品のグループと同じく、id は変えない */
const MODULE_GROUP = { id: 'module', title: 'モジュール' };
const GROUP_IDS = [...GROUPS.map((g) => g.id), MODULE_GROUP.id];

/** 特別な部品の、パレットのツールチップ。ほかの種類の説明は parts/ の見せ方にある */
const SPECIAL_DESCRIPTIONS: Record<SpecialKind, string> = {
  INPUT:
    '入力スイッチ。クリックで ON/OFF を切り替える。モジュールの中に置くと、そのモジュールの入力ピンになる',
  CLOCK: '一定の周期で ON/OFF を繰り返す',
  OUTPUT: '入力が ON のとき点灯するランプ。モジュールの中に置くと、そのモジュールの出力ピンになる',
  CUSTOM: '回路をまとめた部品。シート上でダブルクリックすると中身を開く',
};

/** パレットの部品のツールチップ */
function descriptionOf(kind: ComponentKind): string | undefined {
  if (isSpecialKind(kind)) {
    return SPECIAL_DESCRIPTIONS[kind];
  }
  return partViewOf(kind)?.description;
}

export interface PaletteModule {
  def: CircuitDef;
  /** 今の回路に置けない理由 */
  blocked?: string;
}

interface PaletteProps {
  modules: PaletteModule[];
  /** 折り畳んでいるグループの ID */
  collapsed: string[];
  onCollapsedChange: (collapsed: string[]) => void;
  onAdd: (kind: ComponentKind, custom?: string) => void;
}

/** 左側のパネル。置ける部品の一覧 (削除エリアはシートの右下、TrashZone.tsx) */
export const Palette = memo(function Palette({
  modules,
  collapsed,
  onCollapsedChange,
  onAdd,
}: PaletteProps) {
  const allCollapsed = GROUP_IDS.every((id) => collapsed.includes(id));
  const toggleLabel = allCollapsed ? 'すべて展開' : 'すべて折りたたむ';
  const onToggleGroup = (id: string) =>
    onCollapsedChange(
      collapsed.includes(id) ? collapsed.filter((c) => c !== id) : [...collapsed, id],
    );

  return (
    <Flex direction="column" w="176px" flexShrink={0} bg="bg.panel" borderRightWidth="1px">
      <Flex p="1" borderBottomWidth="1px">
        <ToolButton
          icon={allCollapsed ? expandAllIcon : collapseAllIcon}
          label={toggleLabel}
          onClick={() => onCollapsedChange(allCollapsed ? [] : GROUP_IDS)}
          iconOnly
        />
      </Flex>
      <Box as="aside" flex="1" minH="0" overflowY="auto" p="2">
        {GROUPS.map((group) => (
          <PaletteGroup
            key={group.id}
            id={group.id}
            title={group.title}
            collapsed={collapsed}
            onToggle={onToggleGroup}
          >
            {kindsOf(group).map((k) => (
              <PaletteItem key={k} label={labelOf(k)} kind={k} onAdd={() => onAdd(k)} />
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
            <Text textStyle="xs" color="fg.subtle">
              モジュールはまだありません
            </Text>
          )}
        </PaletteGroup>
      </Box>
    </Flex>
  );
});

interface PaletteGroupProps {
  id: string;
  title: string;
  collapsed: string[];
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

/** 見出しをクリックすると折り畳めるグループ */
function PaletteGroup({ id, title, collapsed, onToggle, children }: PaletteGroupProps) {
  const open = !collapsed.includes(id);
  return (
    <Box as="section" mb="2">
      <h3>
        <Button
          variant="ghost"
          size="xs"
          // ボタンの文字はアクセントカラーにせず、灰色で出す (ToolButton と同じ)
          colorPalette="gray"
          // 開いているグループの見出しにも、背景は付けない
          _expanded={{ bg: 'transparent' }}
          _hover={{ bg: 'colorPalette.subtle' }}
          w="full"
          justifyContent="flex-start"
          gap="1"
          px="1"
          color="fg.muted"
          aria-expanded={open}
          onClick={() => onToggle(id)}
        >
          {/* 折り畳んだグループは、矢印を右向きにする */}
          <MaskIcon
            src={chevronIcon}
            boxSize="3"
            transition="transform 0.15s"
            transform={open ? undefined : 'rotate(-90deg)'}
          />
          {title}
        </Button>
      </h3>
      {open && (
        <Flex direction="column" gap="1" mt="1">
          {children}
        </Flex>
      )}
    </Box>
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
function PaletteItem({ label, kind, custom, disabledReason, onAdd }: PaletteItemProps) {
  const disabled = !!disabledReason;
  const button = (
    <Button
      variant="outline"
      size="sm"
      colorPalette="gray"
      w="full"
      justifyContent="flex-start"
      gap="2"
      px="2"
      cursor={disabled ? 'not-allowed' : 'grab'}
      // モジュールは、枠を点線にして組み込みの部品と見分ける
      borderStyle={kind === 'CUSTOM' ? 'dashed' : 'solid'}
      _hover={{ borderColor: 'accent.solid' }}
      disabled={disabled}
      draggable={!disabled}
      onClick={onAdd}
      onDragStart={(e) => {
        const data: PaletteDrag = { kind, custom };
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(data));
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <PartIcon kind={kind} />
      <Box as="span" truncate>
        {label}
      </Box>
    </Button>
  );
  return (
    // 置けないモジュールは、説明よりも置けない理由を見せる
    <HintTooltip content={disabledReason ?? descriptionOf(kind)}>
      {/* 押せないボタンはポインターのイベントを出さないので、包んだ要素でツールチップを出す */}
      {disabled ? <Box w="full">{button}</Box> : button}
    </HintTooltip>
  );
}
