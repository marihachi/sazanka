import { Box, Flex, Tabs } from '@chakra-ui/react';
import { memo, useRef, useState } from 'react';
import plusIcon from '../assets/icons/plus.svg';
import { shallowEqual } from '../util';
import { MAIN_ID, moveCircuit, type CircuitDef } from '../engine/project';
import { InlineInput } from './InlineInput';
import { ToolButton } from './ToolButton';
import { HintTooltip } from './HintTooltip';

interface TabBarProps {
  circuits: CircuitDef[];
  currentId: string;
  /** 名前を編集中のタブ */
  renamingId?: string;
  onOpen: (id: string) => void;
  onStartRename: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  /** モジュールを追加する (タブの末尾の「+」) */
  onAddModule: () => void;
  /** モジュールのタブを、回路の一覧の index 番目に移した */
  onReorder: (id: string, index: number) => void;
}

/** タブのドラッグ。x は今のポインターの位置、index は落とす位置 (回路の一覧での番号) */
interface TabDrag {
  id: string;
  pointerId: number;
  startX: number;
  started: boolean;
  index: number;
}

/** 押した位置からこれ以上動いたらドラッグとみなす (px)。それまではクリックやダブルクリックとして扱う */
const DRAG_THRESHOLD = 4;

/** 回路を切り替えるタブ。モジュールのタブはダブルクリックで名前を変更でき、ドラッグで並べ替えられる */
export const TabBar = memo(function TabBar({
  circuits,
  currentId,
  renamingId,
  onOpen,
  onStartRename,
  onRename,
  onCancelRename,
  onAddModule,
  onReorder,
}: TabBarProps) {
  const [drag, setDrag] = useState<TabDrag | null>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  /** ドラッグ中は、落とす位置に並べ替えて見せる */
  const shown = drag?.started ? moveCircuit({ circuits }, drag.id, drag.index).circuits : circuits;

  function onPointerDown(e: React.PointerEvent, id: string) {
    // メイン回路は先頭に固定なので動かさない
    if (id === MAIN_ID || e.button !== 0) {
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
    // ドラッグ中のタブ以外で、中央がポインターより左にあるモジュールのタブの数が、落とす位置
    const others = circuits.filter((d) => d.id !== drag.id && d.id !== MAIN_ID);
    const before = others.filter((d) => {
      const rect = tabRefs.current.get(d.id)?.getBoundingClientRect();
      return rect && rect.left + rect.width / 2 < e.clientX;
    }).length;
    setDrag({ ...drag, started: true, index: before + 1 });
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
        value={currentId}
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
                    {d.name}
                  </Box>
                </Tabs.Trigger>
              </TabTooltip>
            ),
          )}
        </Tabs.List>
      </Tabs.Root>
      {/* タブの末尾の「+」。タブの文字とそろう高さに置く */}
      <Box flexShrink={0} pb="1">
        <ToolButton icon={plusIcon} label="モジュールを追加" onClick={onAddModule} iconOnly />
      </Box>
    </Flex>
  );
}, sameTabs);

/** モジュールのタブに付ける操作の説明。メイン回路と、ドラッグ中は出さない */
function TabTooltip({ show, children }: { show: boolean; children: React.ReactElement }) {
  if (!show) {
    return children;
  }
  return (
    <HintTooltip content="ダブルクリックで名前を変更、ドラッグで並べ替えできます。">
      {children}
    </HintTooltip>
  );
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
