import { useRef, useState } from 'react';
import trashIcon from '../assets/icons/trash.svg';
import { MAIN_ID, moveCircuit, type CircuitDef } from '../engine/project';
import { InlineInput } from './Dialogs';
import { classNames } from './classNames';
import { ToolIcon } from './Icons';
import styles from './TabBar.module.css';

interface TabBarProps {
  circuits: CircuitDef[];
  currentId: string;
  /** 名前を編集中のタブ */
  renamingId?: string;
  onOpen: (id: string) => void;
  onStartRename: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  /** 開いているモジュールを削除する */
  onDeleteCurrent: () => void;
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
export function TabBar({
  circuits,
  currentId,
  renamingId,
  onOpen,
  onStartRename,
  onRename,
  onCancelRename,
  onDeleteCurrent,
  onReorder,
}: TabBarProps) {
  const [drag, setDrag] = useState<TabDrag | null>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  /** ドラッグ中は、落とす位置に並べ替えて見せる */
  const shown = drag?.started ? moveCircuit({ circuits }, drag.id, drag.index).circuits : circuits;

  function onPointerDown(e: React.PointerEvent, id: string) {
    // メイン回路は先頭に固定なので動かさない
    if (id === MAIN_ID || e.button !== 0) return;
    setDrag({
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      started: false,
      index: circuits.findIndex((d) => d.id === id),
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.started && Math.abs(e.clientX - drag.startX) < DRAG_THRESHOLD) return;
    // 押した時点でキャプチャすると、ダブルクリック (名前の変更) が効かなくなるので、動き始めてから行う
    if (!drag.started) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    // ドラッグ中のタブ以外で、中央がポインターより左にあるモジュールのタブの数が、落とす位置
    const others = circuits.filter((d) => d.id !== drag.id && d.id !== MAIN_ID);
    const before = others.filter((d) => {
      const rect = tabRefs.current.get(d.id)?.getBoundingClientRect();
      return rect && rect.left + rect.width / 2 < e.clientX;
    }).length;
    setDrag({ ...drag, started: true, index: before + 1 });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    setDrag(null);
    if (drag.started && circuits.findIndex((d) => d.id === drag.id) !== drag.index) onReorder(drag.id, drag.index);
  }

  return (
    <div className={styles.tabbar}>
      <div
        className={styles.tabs}
        role="tablist"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
      >
        {shown.map((d) =>
          renamingId === d.id ? (
            <InlineInput
              key={d.id}
              className={styles.tabInput}
              initial={d.name}
              onCommit={(v) => onRename(d.id, v)}
              onCancel={onCancelRename}
            />
          ) : (
            <button
              key={d.id}
              ref={(el) => {
                if (el) tabRefs.current.set(d.id, el);
                else tabRefs.current.delete(d.id);
              }}
              role="tab"
              aria-selected={d.id === currentId}
              className={classNames(
                styles.tab,
                d.id === currentId && styles.active,
                drag?.started && drag.id === d.id && styles.dragging,
              )}
              onPointerDown={(e) => onPointerDown(e, d.id)}
              onClick={() => onOpen(d.id)}
              onDoubleClick={() => d.id !== MAIN_ID && onStartRename(d.id)}
              title={d.id !== MAIN_ID ? 'ダブルクリックで名前を変更、ドラッグで並べ替えできます。' : undefined}
            >
              {d.name}
            </button>
          ),
        )}
      </div>
      {currentId !== MAIN_ID && (
        <div className={styles.tabbarActions}>
          <button className={styles.tool} onClick={onDeleteCurrent}>
            <ToolIcon src={trashIcon} />
            モジュールを削除
          </button>
        </div>
      )}
    </div>
  );
}
