import { Box, Flex, IconButton, Text } from '@chakra-ui/react';
import { useRef } from 'react';
import chevronIcon from '../assets/icons/chevron.svg';
import moreIcon from '../assets/icons/more.svg';
import starIcon from '../assets/icons/star.svg';
import { MAIN_ID } from '../circuit/project';
import { getCircuitName } from '../i18n/messages';
import { useMessages } from '../i18n/useMessages';
import { MaskIcon } from '../ui/Icons';
import { InlineInput } from '../ui/InlineInput';
import type { TreeRow } from './folders';

/** 行を見分ける値。フォルダは "folder:パス"、回路は "circuit:ID" */
export function rowKey(row: TreeRow): string {
  return row.kind === 'folder' ? `folder:${row.path}` : `circuit:${row.def.id}`;
}

/** 画面の上の位置 (メニューを出す所) */
export interface MenuPoint {
  x: number;
  y: number;
}

/** 長押しでメニューを出すまでの時間 (ms)。スマホのブラウザの長押しと同じくらい */
const LONG_PRESS_MS = 500;
/** 長押しの間にこれ以上動いたら、長押しをやめる (px)。スクロールやドラッグと区別するため */
const LONG_PRESS_SLOP = 8;

/**
 * フォルダと回路の木。プロジェクトパネルで使う (あとでフォルダを選ぶダイアログでも使う)。
 * 行を押すと選び (onSelect)、ダブルクリックか Enter で開く (onActivate。フォルダは開閉)。F2 で名前を変え始める。
 * フォルダの矢印を押すと開閉する。行の操作のメニューは、右クリック、長押し (タッチ)、行の「⋯」で出す (onMenu)
 */
export function CircuitTree({
  rows,
  selected,
  collapsed,
  renaming,
  hasMenu,
  onSelect,
  onActivate,
  onToggleFolder,
  onMenu,
  onStartRename,
  onRename,
  onCancelRename,
}: {
  rows: TreeRow[];
  /** 選んでいる行 (rowKey) */
  selected: string | undefined;
  /** 折り畳んでいるフォルダのパス */
  collapsed: ReadonlySet<string>;
  /** 名前を変えている行 (rowKey) */
  renaming?: string;
  /** 行に操作のメニューがあるか (なければ「⋯」を出さず、右クリックと長押しでも出さない) */
  hasMenu: (row: TreeRow) => boolean;
  onSelect: (row: TreeRow) => void;
  onActivate: (row: TreeRow) => void;
  onToggleFolder: (path: string) => void;
  onMenu: (row: TreeRow, at: MenuPoint) => void;
  /** F2 で名前を変え始める。変えられない行 (メイン回路) なら何もしない */
  onStartRename: (row: TreeRow) => void;
  onRename: (row: TreeRow, name: string) => void;
  onCancelRename: () => void;
}) {
  const m = useMessages();
  const press = useRef<{ x: number; y: number; timer: number } | null>(null);
  const cancelPress = () => {
    if (press.current) {
      window.clearTimeout(press.current.timer);
      press.current = null;
    }
  };

  return (
    <Box as="ul" role="tree" py="1">
      {rows.map((row) => {
        const key = rowKey(row);
        const isSelected = key === selected;
        const isFolder = row.kind === 'folder';
        const open = isFolder && !collapsed.has(row.path);
        const name = isFolder ? row.name : getCircuitName(row.def, m);
        const menu = hasMenu(row);
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
            pe="1"
            h="7"
            textStyle="sm"
            cursor="pointer"
            userSelect="none"
            // 長押しで、ブラウザの文字の選択やメニューを出さない
            css={{ WebkitTouchCallout: 'none' }}
            bg={isSelected ? 'bg.emphasized' : undefined}
            className="group"
            _hover={{ bg: isSelected ? 'bg.emphasized' : 'bg.muted' }}
            onClick={() => onSelect(row)}
            onDoubleClick={() => onActivate(row)}
            onKeyDown={(e) => {
              if (renaming === key) {
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                onActivate(row);
              } else if (e.key === 'F2') {
                e.preventDefault();
                onStartRename(row);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (menu) {
                onSelect(row);
                onMenu(row, { x: e.clientX, y: e.clientY });
              }
            }}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' || !menu) {
                return;
              }
              const at = { x: e.clientX, y: e.clientY };
              press.current = {
                ...at,
                timer: window.setTimeout(() => {
                  press.current = null;
                  onSelect(row);
                  onMenu(row, at);
                }, LONG_PRESS_MS),
              };
            }}
            onPointerMove={(e) => {
              const p = press.current;
              if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > LONG_PRESS_SLOP) {
                cancelPress();
              }
            }}
            onPointerUp={cancelPress}
            onPointerCancel={cancelPress}
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
            {renaming === key ? (
              <Box flex="1" minW="0" onClick={(e) => e.stopPropagation()}>
                <InlineInput
                  initial={name}
                  onCommit={(v) => onRename(row, v)}
                  onCancel={onCancelRename}
                />
              </Box>
            ) : (
              <>
                <Text as="span" truncate flex="1" fontWeight={isFolder ? 'medium' : undefined}>
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
                {menu && (
                  // 行の「⋯」。ポインターを載せたときと、選んでいる行にだけ見せる (開発者が決めた)
                  <IconButton
                    size="2xs"
                    variant="ghost"
                    colorPalette="gray"
                    flexShrink={0}
                    opacity={isSelected ? 1 : 0}
                    _groupHover={{ opacity: 1 }}
                    _focusVisible={{ opacity: 1 }}
                    aria-label={m.project.rowMenu(name)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(row);
                      const r = e.currentTarget.getBoundingClientRect();
                      onMenu(row, { x: r.left, y: r.bottom });
                    }}
                  >
                    <MaskIcon src={moreIcon} boxSize="3.5" />
                  </IconButton>
                )}
              </>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
