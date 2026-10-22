import { Box, CloseButton, Flex, Tabs } from '@chakra-ui/react';
import { memo, useRef, useState } from 'react';
import plusIcon from '../assets/icons/plus.svg';
import { shallowEqual } from '../util';
import { MAIN_ID, type CircuitDef } from '../circuit/project';
import { InlineInput } from '../ui/InlineInput';
import { ToolButton } from '../ui/ToolButton';
import { HintTooltip } from '../ui/HintTooltip';
import { useMessages } from '../i18n/useMessages';
import { getCircuitName } from '../i18n/messages';

interface TabBarProps {
  /** 開いている回路 (タブの並び) */
  circuits: CircuitDef[];
  /** 選んでいるタブ。タブがなければ undefined */
  currentId: string | undefined;
  /** 名前を編集中のタブ */
  renamingId?: string;
  onOpen: (id: string) => void;
  /** タブを閉じる (タブの「×」) */
  onClose: (id: string) => void;
  onStartRename: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  /** 回路を追加する (タブの末尾の「+」) */
  onAddCircuit: () => void;
  /** タブを、タブの並びの index 番目に移した */
  onReorder: (id: string, index: number) => void;
}

/** タブのドラッグ。index は落とす位置 (タブの並びでの番号) */
interface TabDrag {
  id: string;
  pointerId: number;
  startX: number;
  started: boolean;
  index: number;
}

/** 押した位置からこれ以上動いたらドラッグとみなす (px)。それまではクリックやダブルクリックとして扱う */
const DRAG_THRESHOLD = 4;

/**
 * 開いている回路のタブ。タブを押すとその回路に切り替え、「×」で閉じる。ドラッグで並べ替えられる (タブの並びは画面の状態で、
 * 回路の並びとは別)。メイン回路以外のタブはダブルクリックで名前を変更できる
 */
export const TabBar = memo(function TabBar({
  circuits,
  currentId,
  renamingId,
  onOpen,
  onClose,
  onStartRename,
  onRename,
  onCancelRename,
  onAddCircuit,
  onReorder,
}: TabBarProps) {
  const m = useMessages();
  const [drag, setDrag] = useState<TabDrag | null>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  /** ドラッグ中は、落とす位置に並べ替えて見せる */
  const shown = drag?.started ? moveItem(circuits, drag.id, drag.index) : circuits;

  function onPointerDown(e: React.PointerEvent, id: string) {
    if (e.button !== 0) {
      return;
    }
    setDrag({
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      started: false,
      index: circuits.findIndex((d) => d.id === id),
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) {
      return;
    }
    if (!drag.started && Math.abs(e.clientX - drag.startX) < DRAG_THRESHOLD) {
      return;
    }
    // 押した時点でキャプチャすると、ダブルクリック (名前の変更) が効かなくなるので、動き始めてから行う
    if (!drag.started) {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    // ドラッグ中のタブ以外で、中央がポインターより左にあるタブの数が、落とす位置
    const before = circuits
      .filter((d) => d.id !== drag.id)
      .filter((d) => {
        const rect = tabRefs.current.get(d.id)?.getBoundingClientRect();
        return rect && rect.left + rect.width / 2 < e.clientX;
      }).length;
    setDrag({ ...drag, started: true, index: before });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) {
      return;
    }
    setDrag(null);
    if (drag.started && circuits.findIndex((d) => d.id === drag.id) !== drag.index) {
      onReorder(drag.id, drag.index);
    }
  }

  return (
    <Flex align="flex-end" gap="2" px="2" pt="1.5">
      {/* 選択中のタブは、下のシートのツールバーと同じ色にしてつながって見せる (SheetToolbar.tsx) */}
      <Tabs.Root
        value={currentId ?? ''}
        onValueChange={(e) => onOpen(e.value)}
        variant="outline"
        size="sm"
        minW="0"
      >
        <Tabs.List
          // タブが増えたら横にスクロールする。縦は出さない
          overflowX="auto"
          overflowY="hidden"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
        >
          {shown.map((d) =>
            renamingId === d.id ? (
              <Box key={d.id} w="140px" mb="1">
                <InlineInput
                  initial={d.name}
                  onCommit={(v) => onRename(d.id, v)}
                  onCancel={onCancelRename}
                />
              </Box>
            ) : (
              <TabTooltip key={d.id} show={d.id !== MAIN_ID && !drag?.started}>
                {/* 閉じるボタンはタブ (ボタン) の中に入れられないので、タブに重ねて右端に置く */}
                <Box position="relative" flexShrink={0}>
                  <Tabs.Trigger
                    value={d.id}
                    ref={(el) => {
                      if (el) {
                        tabRefs.current.set(d.id, el);
                      } else {
                        tabRefs.current.delete(d.id);
                      }
                    }}
                    flexShrink={0}
                    maxW="200px"
                    pe="7"
                    _selected={{ bg: 'bg.panel' }}
                    // ドラッグして並べ替えている最中のタブ
                    {...(drag?.started &&
                      drag.id === d.id && {
                        outline: '1px dashed',
                        outlineColor: 'accent.solid',
                        outlineOffset: '-2px',
                        cursor: 'grabbing',
                      })}
                    onPointerDown={(e) => onPointerDown(e, d.id)}
                    onDoubleClick={() => d.id !== MAIN_ID && onStartRename(d.id)}
                  >
                    <Box as="span" truncate>
                      {getCircuitName(d, m)}
                    </Box>
                  </Tabs.Trigger>
                  <CloseButton
                    size="2xs"
                    variant="ghost"
                    colorPalette="gray"
                    position="absolute"
                    right="1"
                    top="50%"
                    transform="translateY(-50%)"
                    aria-label={m.tabs.close(getCircuitName(d, m))}
                    onClick={() => onClose(d.id)}
                  />
                </Box>
              </TabTooltip>
            ),
          )}
        </Tabs.List>
      </Tabs.Root>
      {/* タブの末尾の「+」。タブの文字とそろう高さに置く */}
      <Box flexShrink={0} pb="1">
        <ToolButton icon={plusIcon} label={m.tabs.addCircuit} onClick={onAddCircuit} iconOnly />
      </Box>
    </Flex>
  );
}, sameTabs);

/** メイン回路以外のタブに付ける操作の説明。メイン回路と、ドラッグ中は出さない */
function TabTooltip({ show, children }: { show: boolean; children: React.ReactElement }) {
  const m = useMessages();
  if (!show) {
    return children;
  }
  return <HintTooltip content={m.tabs.circuitTabTooltip}>{children}</HintTooltip>;
}

/**
 * 描き直すかの判定。タブに出すのは回路の ID と名前だけなので、部品を動かしただけ (回路の中身が変わっただけ) では描き直さない。
 * そのほかの props は、そのまま比べる (App は同じ関数を渡し続ける)
 */
function sameTabs(a: TabBarProps, b: TabBarProps): boolean {
  const { circuits: ca, ...ra } = a;
  const { circuits: cb, ...rb } = b;
  return (
    ca.length === cb.length &&
    ca.every((d, i) => d.id === cb[i].id && d.name === cb[i].name) &&
    shallowEqual(ra, rb)
  );
}

/** 並び items の id のものを、index 番目に移した並び (タブのドラッグ中の見せ方) */
function moveItem(items: CircuitDef[], id: string, index: number): CircuitDef[] {
  const moving = items.find((d) => d.id === id);
  if (!moving) {
    return items;
  }
  const rest = items.filter((d) => d.id !== id);
  const at = Math.min(Math.max(index, 0), rest.length);
  return [...rest.slice(0, at), moving, ...rest.slice(at)];
}
