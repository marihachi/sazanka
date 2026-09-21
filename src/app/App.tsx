import { useEffect, useRef, useState } from 'react';
import { Sheet, type SheetSize, type DragMode, type Selection } from '../components/Sheet';
import {
  AboutDialog,
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
import { clampPosition, GRID, Point, snap } from '../engine/layout';
import { newId, type Component, type PinRef, type ComponentKind } from '../engine/circuit';
import {
  portsOf,
  circuitsUsing,
  dependsOn,
  emptyProject,
  findDef,
  MAIN_ID,
  type CircuitDef,
  type Project,
} from '../engine/project';
import { parseProject, serializeProject } from '../engine/share';

import { statusHints } from './hints';
import { loadCollapsedGroups, loadProject, saveCollapsedGroups, saveProject } from './storage';
import { useSimulation } from './useSimulation';
import { useProjectHistory } from './useProjectHistory';
import { useShortcuts } from './useShortcuts';

/** その場で編集中の名前。tab はモジュール名、label は INPUT / OUTPUT のラベル */
type Editing = { type: 'tab' | 'label'; id: string } | null;

export function App() {
  const [loaded] = useState(loadProject);
  const history = useProjectHistory(() => loaded.project);
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
  const [dialog, setDialog] = useState<DialogRequest | null>(() =>
    loaded.error ? { message: `${loaded.error}空のプロジェクトで開きます。` } : null,
  );
  const [promptDialog, setPromptDialog] = useState<PromptRequest | null>(null);
  const [textDialog, setTextDialog] = useState<TextRequest | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(loadCollapsedGroups);
  const circuit = findDef(project, currentId) ?? project.circuits[0];

  /** 開いている回路を更新する。record を false にすると元に戻す対象にしない */
  function setCircuit(update: (c: CircuitDef) => CircuitDef, record = true) {
    const id = circuit.id;
    (record ? history.commit : history.replace)((p) => ({
      circuits: p.circuits.map((d) => (d.id === id ? update(d) : d)),
    }));
  }

  const { sim, running, toggleRunning, stepOnce, stepBack, canStepBack, forget } = useSimulation(
    project,
    circuit.id,
    history.replace,
  );
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
  function addComponent(kind: ComponentKind, custom?: string, at?: Point) {
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
    setSelection({ type: 'comp', ids: [c.id] });
  }

  /** 部品と、それらにつながる配線を削除する */
  function deleteComponents(ids: string[], record = true) {
    setCircuit((cur) => edit.removeComponents(cur, ids), record);
    setSelection(null);
  }

  function deleteSelection() {
    if (!selection) return;
    if (selection.type === 'comp') {
      deleteComponents(selection.ids);
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
        forget(id);
        openCircuit(MAIN_ID);
      },
    });
  }

  function setLabel(id: string, value: string) {
    setEditing(null);
    setCircuit((cur) => edit.setLabel(cur, id, value));
  }

  useShortcuts({
    enabled: !dialog && !promptDialog && !textDialog && !aboutOpen,
    onUndo: undoEdit,
    onRedo: redoEdit,
    onDelete: deleteSelection,
    onSelectAll: () => {
      setPending(null);
      const ids = circuit.components.map((c) => c.id);
      setSelection(ids.length > 0 ? { type: 'comp', ids } : null);
    },
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

  function moveComponents(positions: Map<string, Point>) {
    // ドラッグ中の移動は履歴に積まない。ドラッグの開始時に積んだ1回分で元に戻す
    setCircuit((cur) => edit.moveComponents(cur, positions), false);
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

  /** プロジェクト全体を置き換える (新規作成、読み込み)。元に戻すで戻せる */
  function replaceProject(next: Project) {
    setProject(() => next);
    forget();
    openCircuit(MAIN_ID);
    setEditing(null);
  }

  function newProject() {
    setDialog({
      message:
        '新しいプロジェクトを作成しますか？今のプロジェクト (メイン回路とすべてのモジュール) は消えます (元に戻すで戻せます)。',
      confirmLabel: '新規作成',
      danger: true,
      onConfirm: () => replaceProject(emptyProject()),
    });
  }

  function exportProject() {
    setTextDialog({
      title: '書き出し',
      message: 'プロジェクト全体の書き出しができます。書き出したデータは「読み込み」画面に貼り付けてください。',
      initial: serializeProject(project),
      readOnly: true,
      field: {
        label: '作者名 (省略可)',
        initial: project.author ?? '',
        onChange: (value) => {
          // 作者名は回路の編集ではないので、元に戻す対象にしない
          const next: Project = { ...project, author: value };
          history.replace(next);
          return serializeProject(next);
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
        replaceProject(result.project);
        if (result.project.author) setDialog({ message: `「${result.project.author}」さんの回路を読み込みました。` });
        return undefined;
      },
    });
  }

  const hints = statusHints({
    dragMode,
    wiring: !!pending,
    editing: !!editing,
    wireSelected: selection?.type === 'wire',
    selectedComponent:
      selection?.type === 'comp' && selection.ids.length === 1
        ? circuit.components.find((c) => c.id === selection.ids[0])
        : undefined,
    multipleSelected: selection?.type === 'comp' && selection.ids.length > 1,
    unstable: sim.unstable,
    inModule: circuit.id !== MAIN_ID,
  });

  return (
    <div className="app">
      <Header onAbout={() => setAboutOpen(true)} />
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
        onNew={newProject}
        onExport={exportProject}
        onImport={importProject}
        running={running}
        onToggleRunning={toggleRunning}
        onStep={stepOnce}
        onStepBack={stepBack}
        canStepBack={canStepBack}
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
          onMove={moveComponents}
          // 移動してから削除エリアに来た場合は、移動と削除をまとめて1回の操作にする
          onDropOnTrash={(ids, moved) => deleteComponents(ids, !moved)}
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
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
    </div>
  );
}
