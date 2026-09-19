import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet, type SheetSize, type DragMode, type Selection } from '../components/Sheet';
import {
  Dialog,
  PromptDialog,
  TextDialog,
  type DialogRequest,
  type PromptRequest,
  type TextRequest,
} from '../components/Dialogs';
import { Header } from '../components/Header';
import { Palette, type PaletteModule } from '../components/Palette';
import { StatusBar } from '../components/StatusBar';
import { TabBar } from '../components/TabBar';
import { Toolbar } from '../components/Toolbar';
import * as edit from '../engine/edit';
import { clampPosition, GRID, snap, type Point } from '../engine/layout';
import {
  dependsOn,
  findDef,
  MAIN_ID,
  portsOf,
  simulateCircuit,
  circuitsUsing,
  type CircuitDef,
} from '../engine/project';
import { parseProject, serializeProject } from '../engine/share';
import type { Component, Kind, PinRef, SimResult } from '../engine/sim';
import { statusHints } from './hints';
import { loadAuthor, loadCollapsedGroups, loadProject, saveAuthor, saveCollapsedGroups, saveProject } from './storage';
import { useClock } from './useClock';
import { useProjectHistory } from './useProjectHistory';
import { useShortcuts } from './useShortcuts';

/** その場で編集中の名前。tab はモジュール名、label は INPUT / OUTPUT のラベル */
type Editing = { type: 'tab' | 'label'; id: string } | null;

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function App() {
  const history = useProjectHistory(loadProject);
  const project = history.project;
  /** 元に戻せる編集としてプロジェクトを更新する */
  const setProject = history.commit;
  const [currentId, setCurrentId] = useState(MAIN_ID);
  const [selection, setSelection] = useState<Selection>(null);
  const [pending, setPending] = useState<PinRef | null>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  /** クリックで部品を追加するとき、はみ出さない位置に置くために使う */
  const [sheetSize, setSheetSize] = useState<SheetSize>({ width: Infinity, height: Infinity });
  const [editing, setEditing] = useState<Editing>(null);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [promptDialog, setPromptDialog] = useState<PromptRequest | null>(null);
  const [textDialog, setTextDialog] = useState<TextRequest | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState(loadCollapsedGroups);
  /** 回路ごとの前回のシミュレーション結果 */
  const prevResults = useRef(new Map<string, SimResult>());

  const circuit = findDef(project, currentId) ?? project.circuits[0];

  /** 開いている回路を更新する。record を false にすると元に戻す対象にしない */
  function setCircuit(update: (c: CircuitDef) => CircuitDef, record = true) {
    const id = circuit.id;
    (record ? history.commit : history.replace)((p) => ({
      circuits: p.circuits.map((d) => (d.id === id ? update(d) : d)),
    }));
  }

  const sim = useMemo(
    () => simulateCircuit(project, circuit.id, prevResults.current.get(circuit.id)),
    [project, circuit.id],
  );
  useEffect(() => {
    prevResults.current.set(circuit.id, sim);
  }, [sim, circuit.id]);

  useClock(project, history.replace);
  useEffect(() => saveProject(project), [project]);
  useEffect(() => saveCollapsedGroups(collapsedGroups), [collapsedGroups]);

  /** パネルに並べるモジュール。今の回路に置けないもの (循環するもの) は理由付き */
  const paletteModules: PaletteModule[] = project.circuits
    .filter((d) => d.id !== MAIN_ID)
    .map((d) => ({
      def: d,
      blocked:
        d.id === circuit.id
          ? 'モジュールの中に自分自身は置けません'
          : dependsOn(project, d.id, circuit.id)
            ? `「${d.name}」はこの回路を含んでいるため置けません`
            : undefined,
    }));

  function openCircuit(id: string) {
    setCurrentId(id);
    setSelection(null);
    setPending(null);
  }

  /** 部品を追加する。位置を省略すると少しずつずらして置く */
  function addComponent(kind: Kind, custom?: string, at?: Point) {
    const n = circuit.components.length;
    const c: Component = {
      id: newId(),
      kind,
      x: at ? snap(at.x) : 100 + (n % 10) * GRID,
      y: at ? snap(at.y) : 80 + (n % 10) * GRID,
    };
    if (kind === 'INPUT' || kind === 'CLOCK') c.on = false;
    if (custom) c.custom = custom;
    Object.assign(c, clampPosition(c, portsOf(c, project), c, sheetSize.width, sheetSize.height));
    setCircuit((cur) => edit.addComponent(cur, c));
    setSelection({ type: 'comp', id: c.id });
  }

  /** 部品と、それにつながる配線を削除する */
  function deleteComponent(id: string, record = true) {
    setCircuit((cur) => edit.removeComponent(cur, id), record);
    setSelection(null);
  }

  function deleteSelection() {
    if (!selection) return;
    if (selection.type === 'comp') {
      deleteComponent(selection.id);
      return;
    }
    const id = selection.id;
    setCircuit((cur) => edit.removeWire(cur, id));
    setSelection(null);
  }

  /** 名前を入力するウィンドウを開き、確定したらモジュールを作成して開く */
  function createModule() {
    const names = new Set(project.circuits.map((d) => d.name));
    let n = project.circuits.length;
    while (names.has(`モジュール${n}`)) n++;
    setPromptDialog({
      title: 'モジュールを追加',
      label: '名前',
      initial: `モジュール${n}`,
      confirmLabel: '追加',
      validate: (name) =>
        !name ? '名前を入力してください' : names.has(name) ? '同じ名前の回路がすでにあります' : undefined,
      onSubmit: (name) => {
        const def: CircuitDef = { id: newId(), name, components: [], wires: [] };
        setProject((p) => ({ circuits: [...p.circuits, def] }));
        openCircuit(def.id);
      },
    });
  }

  function renameCircuit(id: string, value: string) {
    const name = value.trim();
    setEditing(null);
    if (!name) return;
    setProject((p) => ({ circuits: p.circuits.map((d) => (d.id === id ? { ...d, name } : d)) }));
  }

  function deleteCircuit() {
    const users = circuitsUsing(project, circuit.id);
    if (users.length > 0) {
      setDialog({
        message: `「${circuit.name}」は次の回路で使われているため削除できません: ${users.map((d) => d.name).join(', ')}`,
      });
      return;
    }
    const id = circuit.id;
    setDialog({
      message: `モジュール「${circuit.name}」を削除しますか？`,
      confirmLabel: '削除',
      danger: true,
      onConfirm: () => {
        setProject((p) => ({ circuits: p.circuits.filter((d) => d.id !== id) }));
        prevResults.current.delete(id);
        openCircuit(MAIN_ID);
      },
    });
  }

  function setLabel(id: string, value: string) {
    setEditing(null);
    setCircuit((cur) => edit.setLabel(cur, id, value));
  }

  useShortcuts({
    enabled: !dialog && !promptDialog && !textDialog,
    onUndo: undoEdit,
    onRedo: redoEdit,
    onDelete: deleteSelection,
    onEscape: () => {
      setPending(null);
      setSelection(null);
    },
  });

  /** 選択や編集中の状態は、戻した先に存在しないことがあるので解除する */
  function resetInteraction() {
    setSelection(null);
    setPending(null);
    setEditing(null);
  }

  function undoEdit() {
    // ドラッグ中は、ドラッグの開始時点との整合が崩れるので受け付けない
    if (dragMode !== 'none') return;
    history.undo();
    resetInteraction();
  }

  function redoEdit() {
    if (dragMode !== 'none') return;
    history.redo();
    resetInteraction();
  }

  function onCompDoubleClick(c: Component) {
    if (c.kind === 'CUSTOM' && c.custom && findDef(project, c.custom)) {
      openCircuit(c.custom);
    } else if (c.kind === 'INPUT' || c.kind === 'OUTPUT') {
      setEditing({ type: 'label', id: c.id });
    }
  }

  function moveComponent(id: string, position: Point) {
    // ドラッグ中の移動は履歴に積まない。ドラッグの開始時に積んだ1回分で元に戻す
    setCircuit((cur) => edit.moveComponent(cur, id, position), false);
  }

  function toggleInput(id: string) {
    // スイッチ操作は回路の編集ではないので、元に戻す対象にしない
    setCircuit((cur) => edit.toggleSwitch(cur, id), false);
  }

  function connect(from: PinRef, to: PinRef) {
    const id = newId();
    setCircuit((cur) => edit.connect(cur, id, from, to));
  }

  function disconnect(to: PinRef) {
    setCircuit((cur) => edit.disconnect(cur, to));
  }

  function clearAll() {
    setDialog({
      message: 'この回路をすべて消去しますか？',
      confirmLabel: '消去',
      danger: true,
      onConfirm: () => {
        setCircuit(edit.clearCircuit);
        setSelection(null);
        setPending(null);
      },
    });
  }

  function exportProject() {
    const author = loadAuthor();
    setTextDialog({
      title: '書き出し',
      message: 'プロジェクト全体の書き出しができます。書き出したデータは「読み込み」画面に貼り付けてください。',
      initial: serializeProject(project, author),
      readOnly: true,
      field: {
        label: '作者名 (省略可)',
        initial: author,
        onChange: (value) => {
          saveAuthor(value);
          return serializeProject(project, value);
        },
      },
      confirmLabel: 'コピー',
      doneMessage: 'コピーしました',
      onSubmit: async (text) => {
        try {
          await navigator.clipboard.writeText(text);
          return undefined;
        } catch {
          // 安全でない接続 (http) などでは、クリップボードに書き込めない
          return 'コピーできませんでした。上の文字列を選択して、手動でコピーしてください';
        }
      },
    });
  }

  function importProject() {
    setTextDialog({
      title: '読み込み',
      message: '書き出したデータを貼り付けてください。今のプロジェクトは置き換わりますが、元に戻すこともできます。',
      initial: '',
      confirmLabel: '読み込む',
      onSubmit: (text) => {
        const result = parseProject(text.trim(), newId);
        if (!result.ok) return result.error;
        setProject(() => result.project);
        prevResults.current.clear();
        openCircuit(MAIN_ID);
        setEditing(null);
        if (result.author) setDialog({ message: `「${result.author}」さんの回路を読み込みました。` });
        return undefined;
      },
    });
  }

  const hints = statusHints({
    dragMode,
    wiring: !!pending,
    editing: !!editing,
    wireSelected: selection?.type === 'wire',
    selectedComponent: selection?.type === 'comp' ? circuit.components.find((c) => c.id === selection.id) : undefined,
    unstable: sim.unstable,
    inModule: circuit.id !== MAIN_ID,
  });

  return (
    <div className="app">
      <Header />
      <TabBar
        circuits={project.circuits}
        currentId={circuit.id}
        renamingId={editing?.type === 'tab' ? editing.id : undefined}
        onOpen={openCircuit}
        onStartRename={(id) => setEditing({ type: 'tab', id })}
        onRename={renameCircuit}
        onCancelRename={() => setEditing(null)}
        onDeleteCurrent={deleteCircuit}
      />
      <Toolbar
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={undoEdit}
        onRedo={redoEdit}
        onAddModule={createModule}
        onClear={clearAll}
        onExport={exportProject}
        onImport={importProject}
      />
      <div className="workspace">
        <Palette
          modules={paletteModules}
          dragMode={dragMode}
          trashRef={trashRef}
          collapsed={collapsedGroups}
          onCollapsedChange={setCollapsedGroups}
          onAdd={(kind, custom) => addComponent(kind, custom)}
        />
        <Sheet
          project={project}
          circuit={circuit}
          sim={sim}
          selection={selection}
          onSelect={setSelection}
          pending={pending}
          onPendingChange={setPending}
          dragMode={dragMode}
          onDragModeChange={setDragMode}
          labelEditingId={editing?.type === 'label' ? editing.id : undefined}
          trashRef={trashRef}
          onResize={setSheetSize}
          onAdd={addComponent}
          onMoveStart={history.checkpoint}
          onMove={moveComponent}
          // 移動してから削除エリアに来た場合は、移動と削除をまとめて1回の操作にする
          onDropOnTrash={(id, moved) => deleteComponent(id, !moved)}
          onToggle={toggleInput}
          onConnect={connect}
          onDisconnect={disconnect}
          onComponentDoubleClick={onCompDoubleClick}
          onLabelCommit={setLabel}
          onLabelCancel={() => setEditing(null)}
        />
      </div>
      <StatusBar hints={hints} unstable={sim.unstable} />
      {dialog && <Dialog request={dialog} onClose={() => setDialog(null)} />}
      {promptDialog && <PromptDialog request={promptDialog} onClose={() => setPromptDialog(null)} />}
      {textDialog && <TextDialog request={textDialog} onClose={() => setTextDialog(null)} />}
    </div>
  );
}
