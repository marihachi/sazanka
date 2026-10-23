import { Box, Flex, IconButton, Text } from '@chakra-ui/react';
import { useRef, useState } from 'react';
import chevronIcon from '../assets/icons/chevron.svg';
import moreIcon from '../assets/icons/more.svg';
import starIcon from '../assets/icons/star.svg';
import { MAIN_ID } from '../circuit/project';
import { getCircuitName } from '../i18n/messages';
import { useMessages } from '../i18n/useMessages';
import { MaskIcon } from '../ui/Icons';
import { InlineInput } from '../ui/InlineInput';
import type { DropTarget, TreeRow } from './folders';

/** 行を見分ける値。フォルダは "folder:パス"、回路は "circuit:ID" */
export function rowKey(row: TreeRow): string {
  return row.kind === 'folder' ? `folder:${row.path}` : `circuit:${row.def.id}`;
}

/** 画面の上の位置 (メニューを出す所) */
export interface MenuPoint {
  x: number;
  y: number;
}

/**
 * 選んでいる行をもう一度押してから、名前の変更を始めるまでの時間 (ms)。ダブルクリック (開く) と区別するため、
 * ブラウザのダブルクリックの間隔 (多くの環境で 500ms ほど) より長くする
 */
const SLOW_CLICK_MS = 600;
/** 長押しでメニューを出すまでの時間 (ms)。スマホのブラウザの長押しと同じくらい */
const LONG_PRESS_MS = 500;
/** 長押しの間にこれ以上動いたら、長押しをやめる (px)。スクロールやドラッグと区別するため */
const LONG_PRESS_SLOP = 8;
/** 押した位置からこれ以上動いたら、行のドラッグとみなす (px)。タッチは長押しと区別するため大きめにする */
const DRAG_THRESHOLD = { mouse: 4, touch: LONG_PRESS_SLOP } as const;

/** 行のドラッグ。over はポインターの載っている行 (rows の番号)、zone はその行のどこか */
interface RowDrag {
  row: TreeRow;
  pointerId: number;
  x: number;
  y: number;
  touch: boolean;
  started: boolean;
  over?: number;
  zone?: 'before' | 'into' | 'after';
  target?: DropTarget;
}

/**
 * フォルダと回路の木。プロジェクトパネルで使う (あとでフォルダを選ぶダイアログでも使う)。
 * 行を押すと選び (onSelect)、ダブルクリックか Enter で開く (onActivate。フォルダは開閉)。F2 で名前を変え始める。
 * フォルダの矢印を押すと開閉する。行の操作のメニューは、右クリック、長押し (タッチ)、行の「⋯」で出す (onMenu)。
 * 行をドラッグすると、フォルダの中へ移したり並べ替えたりできる (落とす先は dropTargetOf が決める)
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
  dropTargetOf,
  onDrop,
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
  /** 行 dragged を、行 over の zone に落としたときの落とす先。落とせなければ undefined */
  dropTargetOf?: (
    dragged: TreeRow,
    over: number,
    zone: 'before' | 'into' | 'after',
  ) => DropTarget | undefined;
  onDrop?: (dragged: TreeRow, target: DropTarget) => void;
}) {
  const m = useMessages();
  const [drag, setDrag] = useState<RowDrag | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  /** ドラッグを終えた直後のクリック (同じ押し離しで起きる) で、行を選び直さないための印 */
  const justDragged = useRef(false);
  /** ゆっくり 2 回押したときに名前の変更を始めるタイマー。押したときにその行を選んでいたかも覚える */
  const slowClick = useRef<{ timer: number } | null>(null);
  const wasSelected = useRef(false);
  const cancelSlowClick = () => {
    if (slowClick.current) {
      window.clearTimeout(slowClick.current.timer);
      slowClick.current = null;
    }
  };

  /**
   * 画面の高さ y にある行と、その行のどこか (フォルダは上 1/4・真ん中・下 1/4、回路は上半分・下半分)。
   * いちばん下の行より下 (何もない所) なら、over は rows.length (いちばん上の階層の末尾へ落とす)
   */
  function hitTest(y: number): { over: number; zone: 'before' | 'into' | 'after' } | undefined {
    const last = rows.length > 0 && rowRefs.current.get(rowKey(rows[rows.length - 1]));
    if (last && y >= last.getBoundingClientRect().bottom) {
      return { over: rows.length, zone: 'after' };
    }
    for (let i = 0; i < rows.length; i++) {
      const rect = rowRefs.current.get(rowKey(rows[i]))?.getBoundingClientRect();
      if (!rect || y < rect.top || y >= rect.bottom) {
        continue;
      }
      const t = (y - rect.top) / rect.height;
      if (rows[i].kind === 'folder') {
        return { over: i, zone: t < 0.25 ? 'before' : t > 0.75 ? 'after' : 'into' };
      }
      return { over: i, zone: t < 0.5 ? 'before' : 'after' };
    }
    return undefined;
  }
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
        // 落とす先の印。フォルダの中へなら行に色を付け、行の間なら線を引く
        const index = rows.indexOf(row);
        // いちばん下より下に落とすときは、いちばん下の行の下に、いちばん上の階層の線を引く
        const atEnd =
          drag?.started && drag.target && drag.over === rows.length && index === rows.length - 1;
        const here = drag?.started && drag.target && drag.over === index;
        const dropInto = here && drag?.zone === 'into';
        const dropLine = atEnd ? 'after' : here && drag?.zone !== 'into' ? drag?.zone : undefined;
        const lineDepth = atEnd ? 0 : row.depth;
        return (
          <Box
            as="li"
            key={key}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-selected={isSelected}
            aria-expanded={isFolder && row.hasChildren ? open : undefined}
            tabIndex={isSelected ? 0 : -1}
            ref={(el: HTMLElement | null) => {
              if (el) {
                rowRefs.current.set(key, el);
              } else {
                rowRefs.current.delete(key);
              }
            }}
            listStyleType="none"
            position="relative"
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
            bg={dropInto ? 'accent.subtle' : isSelected ? 'bg.emphasized' : undefined}
            opacity={drag?.started && rowKey(drag.row) === key ? 0.5 : undefined}
            // タッチでは、縦の動きはパネルのスクロールに使い、横に動かし始めたらドラッグにする
            touchAction="pan-y"
            className="group"
            _hover={{ bg: isSelected ? 'bg.emphasized' : 'bg.muted' }}
            onClick={() => {
              if (justDragged.current) {
                justDragged.current = false;
                return;
              }
              onSelect(row);
              // 選んでいる行をもう一度 (ゆっくり) 押したら、少し待って名前の変更を始める。
              // 待つ間にダブルクリックになったら、開く方にする (onDoubleClick で取り消す)
              cancelSlowClick();
              if (wasSelected.current && renaming !== key) {
                slowClick.current = {
                  timer: window.setTimeout(() => {
                    slowClick.current = null;
                    onStartRename(row);
                  }, SLOW_CLICK_MS),
                };
              }
            }}
            onDoubleClick={() => {
              cancelSlowClick();
              onActivate(row);
            }}
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
              // 押したときに、この行をもう選んでいたか (ゆっくり 2 回押して名前を変える操作に使う)
              wasSelected.current = isSelected;
              if (renaming === key || (e.pointerType === 'mouse' && e.button !== 0)) {
                return;
              }
              if (dropTargetOf) {
                setDrag({
                  row,
                  pointerId: e.pointerId,
                  x: e.clientX,
                  y: e.clientY,
                  touch: e.pointerType !== 'mouse',
                  started: false,
                });
              }
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
              if (!drag || e.pointerId !== drag.pointerId || !dropTargetOf) {
                return;
              }
              const moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
              if (!drag.started && moved < DRAG_THRESHOLD[drag.touch ? 'touch' : 'mouse']) {
                return;
              }
              // 押した時点でキャプチャすると、クリックとダブルクリックが行に届かなくなるので、動き始めてから行う
              if (!drag.started) {
                e.currentTarget.setPointerCapture(e.pointerId);
              }
              const hit = hitTest(e.clientY);
              const target = hit && dropTargetOf(drag.row, hit.over, hit.zone);
              setDrag({ ...drag, started: true, over: hit?.over, zone: hit?.zone, target });
            }}
            onPointerUp={(e) => {
              cancelPress();
              if (drag && e.pointerId === drag.pointerId) {
                if (drag.started) {
                  justDragged.current = true;
                  if (drag.target) {
                    onDrop?.(drag.row, drag.target);
                  }
                }
                setDrag(null);
              }
            }}
            onPointerCancel={() => {
              cancelPress();
              setDrag(null);
            }}
          >
            {dropLine && (
              <Box
                position="absolute"
                insetX="0"
                ms={`${8 + lineDepth * 14}px`}
                h="2px"
                bg="accent.solid"
                pointerEvents="none"
                {...(dropLine === 'before' ? { top: '-1px' } : { bottom: '-1px' })}
              />
            )}
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
