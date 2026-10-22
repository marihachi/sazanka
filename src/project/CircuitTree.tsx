import { Box, Flex, Text } from '@chakra-ui/react';
import chevronIcon from '../assets/icons/chevron.svg';
import starIcon from '../assets/icons/star.svg';
import { MAIN_ID } from '../circuit/project';
import { getCircuitName } from '../i18n/messages';
import { useMessages } from '../i18n/useMessages';
import { MaskIcon } from '../ui/Icons';
import type { TreeRow } from './folders';

/** 行を見分ける値。フォルダは "folder:パス"、回路は "circuit:ID" */
export function rowKey(row: TreeRow): string {
  return row.kind === 'folder' ? `folder:${row.path}` : `circuit:${row.def.id}`;
}

/**
 * フォルダと回路の木。プロジェクトパネルで使う (あとでフォルダを選ぶダイアログでも使う)。
 * 行を押すと選び (onSelect)、ダブルクリックか Enter で開く (onActivate。フォルダは開閉)。
 * フォルダの矢印を押すと開閉する
 */
export function CircuitTree({
  rows,
  selected,
  collapsed,
  onSelect,
  onActivate,
  onToggleFolder,
}: {
  rows: TreeRow[];
  /** 選んでいる行 (rowKey) */
  selected: string | undefined;
  /** 折り畳んでいるフォルダのパス */
  collapsed: ReadonlySet<string>;
  onSelect: (row: TreeRow) => void;
  onActivate: (row: TreeRow) => void;
  onToggleFolder: (path: string) => void;
}) {
  const m = useMessages();
  return (
    <Box as="ul" role="tree" py="1">
      {rows.map((row) => {
        const key = rowKey(row);
        const isSelected = key === selected;
        const isFolder = row.kind === 'folder';
        const open = isFolder && !collapsed.has(row.path);
        const name = isFolder ? row.name : getCircuitName(row.def, m);
        return (
          <Box
            as="li"
            key={key}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-selected={isSelected}
            aria-expanded={isFolder && row.hasChildren ? open : undefined}
            tabIndex={isSelected ? 0 : -1}
            listStyleType="none"
            display="flex"
            alignItems="center"
            gap="1"
            ps={`${8 + row.depth * 14}px`}
            pe="2"
            py="1"
            textStyle="sm"
            cursor="pointer"
            userSelect="none"
            bg={isSelected ? 'bg.emphasized' : undefined}
            _hover={{ bg: isSelected ? 'bg.emphasized' : 'bg.muted' }}
            onClick={() => onSelect(row)}
            onDoubleClick={() => onActivate(row)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onActivate(row);
              }
            }}
          >
            {isFolder ? (
              // 開閉の矢印。行を押すのとは別に、矢印だけでも開閉できる
              <Flex
                as="button"
                align="center"
                justify="center"
                boxSize="4"
                flexShrink={0}
                visibility={row.hasChildren ? undefined : 'hidden'}
                aria-label={open ? m.project.collapse(name) : m.project.expand(name)}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFolder(row.path);
                }}
              >
                <MaskIcon
                  src={chevronIcon}
                  boxSize="3"
                  transition="transform 0.15s"
                  transform={open ? undefined : 'rotate(-90deg)'}
                />
              </Flex>
            ) : (
              <Box boxSize="4" flexShrink={0} />
            )}
            <Text as="span" truncate fontWeight={isFolder ? 'medium' : undefined}>
              {name}
            </Text>
            {row.kind === 'circuit' && row.def.id === MAIN_ID && (
              <MaskIcon
                src={starIcon}
                boxSize="3"
                color="fg.warning"
                flexShrink={0}
                role="img"
                aria-label={m.project.main}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}
