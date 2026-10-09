import { memo } from 'react';
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import chevronIcon from '../assets/icons/chevron.svg';
import collapseAllIcon from '../assets/icons/collapse-all.svg';
import expandAllIcon from '../assets/icons/expand-all.svg';
import type { PartKind } from '../circuit/part';
import type { CircuitDef } from '../circuit/project';
import { PartIcon } from '../parts/PartIcon';
import { labelOf, PART_VIEWS, type PaletteGroupId, partViewOf } from '../parts/views';
import { MaskIcon } from '../ui/Icons';
import { ToolButton } from '../ui/ToolButton';
import { HintTooltip } from '../ui/HintTooltip';
import { useLanguage, useMessages } from '../i18n/useMessages';
import { DRAG_MIME, type PaletteDrag } from './drag';

/**
 * 部品のグループの ID の並び。ID は折り畳みの状態の保存に使うので、一度決めたら変えない。
 * 変えると、利用者が折り畳んでいた状態が失われる (見出しは言語ごとの文言の表 (i18n/) にあり、変えてよい)。
 * グループには、parts/ の見せ方でそのグループを選んだ種類が、PART_VIEWS の順に並ぶ
 */
const GROUPS: PaletteGroupId[] = [
  // INPUT / OUTPUT はモジュールのピンにもなる。自分で信号を出す CLOCK / HIGH は「信号源」に分ける
  'io',
  'source',
  'gate',
  'latch',
  'flipflop',
  'device',
];

/** グループに並べる部品の種類 */
function kindsOf(group: PaletteGroupId): PartKind[] {
  return (Object.keys(PART_VIEWS) as (keyof typeof PART_VIEWS)[]).filter(
    (k) => PART_VIEWS[k].group === group,
  );
}

/** モジュールのグループの ID。部品のグループと同じく、変えない */
const MODULE_GROUP = 'module';
const GROUP_IDS: string[] = [...GROUPS, MODULE_GROUP];

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
  onAdd: (kind: PartKind, module?: string) => void;
}

/** 左側のパネル。置ける部品の一覧 (削除エリアはシートの右下、TrashZone.tsx) */
export const Palette = memo(function Palette({
  modules,
  collapsed,
  onCollapsedChange,
  onAdd,
}: PaletteProps) {
  const lang = useLanguage();
  const m = useMessages();
  const allCollapsed = GROUP_IDS.every((id) => collapsed.includes(id));
  const toggleLabel = allCollapsed ? m.palette.expandAll : m.palette.collapseAll;
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
            key={group}
            id={group}
            title={m.palette.groups[group]}
            collapsed={collapsed}
            onToggle={onToggleGroup}
          >
            {kindsOf(group).map((k) => (
              <PaletteItem key={k} label={labelOf(k, lang)} kind={k} onAdd={() => onAdd(k)} />
            ))}
          </PaletteGroup>
        ))}
        <PaletteGroup
          id={MODULE_GROUP}
          title={m.palette.groups[MODULE_GROUP]}
          collapsed={collapsed}
          onToggle={onToggleGroup}
        >
          {modules.map(({ def, blocked }) => (
            <PaletteItem
              key={def.id}
              label={def.name}
              kind="module"
              module={def.id}
              disabledReason={blocked}
              onAdd={() => onAdd('module', def.id)}
            />
          ))}
          {modules.length === 0 && (
            <Text textStyle="xs" color="fg.subtle">
              {m.palette.noModules}
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
  kind: PartKind;
  module?: string;
  /** 置けない場合の理由。あればグレーアウトし、理由をツールチップに出す */
  disabledReason?: string;
  onAdd: () => void;
}

/** クリックで追加、シートへドラッグで好きな位置に追加 */
function PaletteItem({ label, kind, module, disabledReason, onAdd }: PaletteItemProps) {
  const lang = useLanguage();
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
      borderStyle={kind === 'module' ? 'dashed' : 'solid'}
      _hover={{ borderColor: 'accent.solid' }}
      disabled={disabled}
      draggable={!disabled}
      onClick={onAdd}
      onDragStart={(e) => {
        const data: PaletteDrag = { kind, module };
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
    <HintTooltip content={disabledReason ?? partViewOf(kind)?.description[lang]}>
      {/* 押せないボタンはポインターのイベントを出さないので、包んだ要素でツールチップを出す */}
      {disabled ? <Box w="full">{button}</Box> : button}
    </HintTooltip>
  );
}
