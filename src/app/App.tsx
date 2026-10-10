import { Flex } from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet, type SheetSize, type DragMode } from '../sheet/Sheet';
import type { Selection } from '../editing/edit';
import { Header } from './Header';
import { Palette } from '../palette/Palette';
import { PropertyPanel } from './PropertyPanel';
import { StatusBar } from '../hints/StatusBar';
import { TabBar } from '../modules/TabBar';
import { SheetToolbar, type Tool } from '../simulation/SheetToolbar';
import { overview, toWorld } from '../geometry/view';
import * as edit from '../editing/edit';
import {
  clampPosition,
  GRID,
  type Point,
  simplifyWire,
  snap,
  type WireEnd,
} from '../geometry/layout';
import type { Part, PartKind } from '../circuit/part';
import { newId, type Wire } from '../circuit/circuit';
import {
  findDef,
  getCircuitSheet,
  MAIN_ID,
  moveCircuit,
  type CircuitDef,
  type Project,
} from '../circuit/project';
import {
  applyModuleSettings,
  assignPinNumbers,
  assignPortNumbers,
  getPinout,
  findUnexposedPorts,
  usesPinNumbers,
} from '../circuit/module';
import { statusHints } from '../hints/hints';
import { computeNets, isConflict, mergeWiresAt, pinTipsOf, wireEndsOf } from '../geometry/net';
import {
  loadCollapsedGroups,
  loadProject,
  loadPreferences,
  loadViews,
  saveCollapsedGroups,
  saveProject,
  savePreferences,
  saveViews,
} from '../file/storage';
import { useClipboard } from '../editing/useClipboard';
import { useDialogs } from './useDialogs';
import { useModules } from '../modules/useModules';
import { useProjectFile } from '../file/useProjectFile';
import { useSimulation } from '../simulation/useSimulation';
import { useProjectHistory } from '../editing/useProjectHistory';
import { useShortcuts } from '../editing/useShortcuts';
import { useStableCallbacks } from './useStableCallbacks';
import { describeStoredError, getMessages } from '../i18n/messages';
import { LanguageContext } from '../i18n/useMessages';
import { resolveLanguage } from '../i18n/language';

/** その場で編集中の名前 (タブのモジュール名) */
type Editing = { type: 'tab'; id: string } | null;

/**
 * 画面全体の組み立てと、状態のつなぎ役。
 * まとまった操作は別のフックにある (ダイアログ: useDialogs、コピー・貼り付け: useClipboard、
 * 新規作成・書き出し・読み込み: useProjectFile、モジュールの管理: useModules)。ここには回路の編集と、画面の組み立てを置く
 */
export function App() {
  const [preferences, setPreferences] = useState(loadPreferences);
  // 言語は Context で子へ渡す。App 自身と、App で呼ぶフックは Provider の外なので、表を直接引く
  const lang = resolveLanguage(preferences.language, navigator.languages);
  const m = getMessages(lang);
  const [loaded] = useState(loadProject);
  const history = useProjectHistory(() => loaded.project);
  const project = history.project;
  /** 元に戻せる編集としてプロジェクトを更新する */
  const setProject = history.commit;
  const [currentId, setCurrentId] = useState(MAIN_ID);
  const [selection, setSelection] = useState<Selection>(null);
  const [tool, setTool] = useState<Tool>('select');
  /** 配線中に置いた点 (始点から順に)。配線中でなければ null */
  const [pending, setPending] = useState<Point[] | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  /** クリックで部品を追加するとき、表示している範囲の真ん中に置くために使う */
  const [sheetSize, setSheetSize] = useState<SheetSize>({
    width: 0,
    height: 0,
  });
  /** 回路ごとの表示位置と倍率。元に戻す対象にはしない */
  const [views, setViews] = useState(loadViews);
  const [editing, setEditing] = useState<Editing>(null);
  const [collapsedGroups, setCollapsedGroups] = useState(loadCollapsedGroups);
  const circuit = findDef(project, currentId) ?? project.circuits[0];
  // 表示を保存していない回路は、回路全体が見える表示で開く
  const view = views[circuit.id] ?? overview(circuit, project, sheetSize.width, sheetSize.height);

  const dialogs = useDialogs({
    initialMessage: loaded.error
      ? m.file.openedEmpty(describeStoredError(m, loaded.error))
      : undefined,
    preferences,
    onPreferencesChange: setPreferences,
    project,
    // 設定はモジュールのタブを開いている間だけ開けるので、開いている回路に当てはめる
    onApplyModuleSettings: (id, pkg, numbers, labels) =>
      history.commit((p) => ({
        circuits: p.circuits.map((d) =>
          d.id === id ? applyModuleSettings(d, pkg, numbers, labels) : d,
        ),
      })),
  });

  /** 開いている回路を更新する。record を false にすると元に戻す対象にしない */
  function setCircuit(update: (c: CircuitDef) => CircuitDef, record = true) {
    const id = circuit.id;
    (record ? history.commit : history.replace)((p) => ({
      circuits: p.circuits.map((d) => (d.id === id ? update(d) : d)),
    }));
  }

  const { simStore, unstable, running, toggleRunning, stepOnce, stepBack, canStepBack, forget } =
    useSimulation(project, circuit.id, preferences.tickMs);
  useEffect(() => saveProject(project), [project]);
  useEffect(() => saveCollapsedGroups(collapsedGroups), [collapsedGroups]);
  useEffect(() => saveViews(views), [views]);
  useEffect(() => savePreferences(preferences), [preferences]);
  // アクセントカラーは、ページ全体の色の変数を差し替えて反映する
  useEffect(
    () => document.documentElement.style.setProperty('--accent', preferences.accent),
    [preferences.accent],
  );
  // ページの言語 (読み上げや翻訳に使われる) を、画面に出す言語に合わせる
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  // 表示を保存していない回路は、開いた時点の表示をすぐに保存して固定する。
  // 固定しないと、部品を置くたびに「回路全体が見える表示」が計算し直され、画面が勝手に動いてしまう
  const viewSaved = circuit.id in views;
  const sheetReady = sheetSize.width > 0 && sheetSize.height > 0;
  useEffect(() => {
    if (!viewSaved && sheetReady) {
      setViews((vs) => ({ ...vs, [circuit.id]: view }));
    }
  }, [viewSaved, sheetReady, circuit.id, view]);

  /** 部品と配線を動かし始めたときの回路。動かしてから削除エリアで消したときに、元の位置を知るために使う */
  const moveOriginRef = useRef<CircuitDef | null>(null);

  function startMove() {
    moveOriginRef.current = circuit;
    history.checkpoint();
  }

  /** 選んでいる部品と配線を削除する。record が false なのは、動かしてから削除エリアで離したとき */
  function deleteSelection(record = true) {
    if (!selection) {
      return;
    }
    const { comps, wires } = selection;
    // 動かしてから消したときは、動かす前の位置で結合を調べる (今の位置は、削除エリアへ運ぶ途中の位置のため)
    const origin = record ? null : moveOriginRef.current;
    setCircuit((cur) => {
      // 消した配線の端と、消した部品のピンの先があった点で、1 本に見えるようになった配線を結合する
      const before = origin ?? cur;
      const wireSet = new Set(wires);
      const compSet = new Set(comps);
      const points = [
        ...wireEndsOf(before.wires.filter((w) => wireSet.has(w.id))),
        ...pinTipsOf(
          before.parts.filter((c) => compSet.has(c.id)),
          project,
        ),
      ];
      return mergeWiresAt(edit.removeParts(cur, comps, wires), project, points).circuit;
    }, record);
    setSelection(null);
  }

  const clipboard = useClipboard({
    m,
    project,
    circuit,
    selection,
    onSelect: setSelection,
    onPendingChange: setPending,
    setCircuit,
    deleteSelection,
    showConfirm: dialogs.showConfirm,
  });

  function openCircuit(id: string) {
    clipboard.cancelPaste();
    setCurrentId(id);
    setSelection(null);
    setPending(null);
  }

  const modules = useModules({
    m,
    project,
    circuit,
    setProject,
    openCircuit,
    onDeleted: (id) => {
      forget(id);
      setViews(({ [id]: _, ...rest }) => rest);
    },
    showConfirm: dialogs.showConfirm,
    showPrompt: dialogs.showPrompt,
  });

  const file = useProjectFile({
    m,
    project,
    replaceProject: (next: Project) => {
      setProject(() => next);
      forget();
      // 回路の ID が同じでも中身は別物なので、表示は初めから
      setViews({});
      openCircuit(MAIN_ID);
      setEditing(null);
    },
    setProjectWithoutHistory: history.replace,
    showConfirm: dialogs.showConfirm,
    showText: dialogs.showText,
  });

  /** 部品を追加する。位置を省略すると、表示している範囲の真ん中あたりに、重ならないよう少しずつずらして置く */
  function addPart(kind: PartKind, module?: string, at?: Point) {
    const n = circuit.parts.length;
    const center = toWorld(view, {
      x: sheetSize.width / 2,
      y: sheetSize.height / 2,
    });
    // 置くたびに 1 マスずつ右下へずらす。10 個ごとに元の位置へ戻る
    const base = at ?? {
      x: center.x - GRID * 2 + (n % 10) * GRID,
      y: center.y - GRID * 2 + (n % 10) * GRID,
    };
    const c: Part = {
      id: newId(),
      kind,
      x: snap(base.x),
      y: snap(base.y),
    };
    // ON/OFF を持つ部品は OFF から始める。CLOCK の実際の ON/OFF はシミュレーションの中で持つ (useSimulation.ts)
    if (kind === 'input' || kind === 'clock') {
      c.on = false;
    }
    if (module) {
      c.module = module;
    }
    Object.assign(c, clampPosition(c, getPinout(c, project), c, getCircuitSheet(circuit)));
    // モジュールの中に置いた INPUT / OUTPUT には、ピン番号も割り当てる (置く操作と一緒に元に戻せる)
    setCircuit((cur) => {
      const added = new Set([c.id]);
      return assignPortNumbers(assignPinNumbers(edit.addPart(cur, c), added), added);
    });
    setSelection({ comps: [c.id], wires: [] });
  }

  /** 選択モード・配線モード・分割モードにする。モードが変わるときは、配線中の線を取り消す */
  function changeTool(next: Tool) {
    if (next !== tool) {
      setPending(null);
    }
    setTool(next);
  }

  useShortcuts({
    enabled: !dialogs.anyOpen,
    onUndo: undoEdit,
    onRedo: redoEdit,
    onDelete: () => deleteSelection(),
    onCopy: clipboard.copy,
    onCut: clipboard.cut,
    onPaste: clipboard.startPaste,
    onSelectAll: () => {
      setPending(null);
      setSelection(
        edit.selectionOf(
          circuit.parts.map((c) => c.id),
          circuit.wires.map((w) => w.id),
        ),
      );
    },
    onEscape: () => {
      clipboard.cancelPaste();
      setSelection(null);
      // 配線の途中なら、描いている配線を取り消すだけで、配線モードのまま (引き直せるように)。
      // 配線の途中でなければ、選択モードに戻る
      if (pending) {
        setPending(null);
      } else {
        setTool('select');
      }
    },
    onSelectTool: () => changeTool('select'),
    onWireTool: () => changeTool('wire'),
    onSplitTool: () => changeTool('split'),
  });

  /** 選択や編集中の状態は、戻した先に存在しないことがあるので解除する */
  function resetInteraction() {
    setSelection(null);
    setPending(null);
    setEditing(null);
  }

  function undoEdit() {
    // ドラッグ中は、ドラッグの開始時点との整合が崩れるので受け付けない
    if (dragMode !== 'none') {
      return;
    }
    history.undo();
    resetInteraction();
  }

  function redoEdit() {
    if (dragMode !== 'none') {
      return;
    }
    history.redo();
    resetInteraction();
  }

  function onCompDoubleClick(c: Part) {
    if (c.kind === 'module' && c.module && findDef(project, c.module)) {
      openCircuit(c.module);
    }
  }

  function moveParts(comps: Map<string, Point>, wires: Map<string, Point[]>) {
    // ドラッグ中の移動は履歴に積まない。ドラッグの開始時に積んだ1回分で元に戻す
    setCircuit((cur) => edit.moveParts(cur, comps, wires), false);
  }

  /**
   * 配線の端のドラッグを終えた。ドラッグの途中は回路を変えていない (Sheet.tsx が仮の形で描くだけ) ので、
   * ここで形を確定する。折れる点まで縮めて長さ 0 になった区間を除き、動かした端で、ほかの配線と 1 本に見える所を結合する。
   * 形の確定と結合を、まとめて元に戻す 1 回の操作にする
   */
  function finishReshapeWire(id: string, end: WireEnd, points: Point[]) {
    const simplified = simplifyWire(points);
    const tip = end === 'start' ? simplified[0] : simplified[simplified.length - 1];
    const merged = mergeWiresAt(edit.setWirePoints(circuit, id, simplified), project, [tip]);
    setCircuit(() => merged.circuit);
    setSelection((s) => edit.remapSelection(s, merged.replaced));
  }

  /** 分割モードで、配線を点 at で 2 本に分ける。選択は変えない (元の配線を選んでいたら、元の ID を引き継いだ前の方が選ばれたまま) */
  function splitWireAt(id: string, at: Point) {
    setCircuit((cur) => edit.splitWire(cur, id, at, newId));
  }

  function toggleInput(id: string) {
    // スイッチ操作は回路の編集ではないので、元に戻す対象にしない
    setCircuit((cur) => edit.toggleSwitch(cur, id), false);
  }

  function addWire(points: Point[]) {
    const wire: Wire = { id: newId(), points };
    // 描いた配線の両端で、ほかの配線と 1 本に見える所を結合する。
    // 結合で消えた配線を選んでいたら、選択を結合後の配線に移すので、結果をここで求めてから渡す
    const merged = mergeWiresAt(edit.addWire(circuit, wire), project, wireEndsOf([wire]));
    setCircuit(() => merged.circuit);
    setSelection((s) => edit.remapSelection(s, merged.replaced));
  }

  /** 1つだけ選んでいる部品 (配線は選んでいない)。プロパティ欄とヒントに使う */
  const selectedPart =
    selection?.comps.length === 1 && selection.wires.length === 0
      ? circuit.parts.find((c) => c.id === selection.comps[0])
      : undefined;

  // 開いている回路の配線のつながり。描画 (Sheet) と、出力のぶつかりの警告に使う
  const nets = useMemo(() => computeNets(circuit, project), [circuit, project]);
  const conflict = nets.nets.some(isConflict);
  // 開いているモジュールの、外側のピンに出せないポート (ピン番号がない・範囲外・重なり)
  const problems = useMemo(() => findUnexposedPorts(circuit), [circuit]);

  const hints = statusHints(
    {
      dragMode,
      wireTool: tool === 'wire',
      splitTool: tool === 'split',
      wiring: !!pending,
      placing: !!clipboard.placing,
      editing: !!editing,
      wireSelected: selection?.comps.length === 0 && selection.wires.length === 1,
      selectedPart,
      multipleSelected: !!selection && selection.comps.length + selection.wires.length > 1,
      unstable,
      conflict,
      inModule: circuit.id !== MAIN_ID,
      numberedModule: usesPinNumbers(circuit.package),
      selectedPortProblem: selectedPart && problems.get(selectedPart.id),
      unexposedPorts: problems.size > 0,
      tickMs: preferences.tickMs,
    },
    lang,
  );

  // 子の部品へ渡す関数。ドラッグの一歩ごとに App は描き直されるが、ドラッグで中身の変わらない部品
  // (ヘッダー、タブバー、ツールバー、パレット、プロパティ欄) は描き直さないよう、同じ関数を渡し続ける
  const on = useStableCallbacks({
    newProject: file.newProject,
    exportProject: file.exportProject,
    importProject: file.importProject,
    undoEdit,
    redoEdit,
    openPreferences: dialogs.openPreferences,
    openAbout: dialogs.openAbout,
    openCircuit,
    startRename: (id: string) => setEditing({ type: 'tab', id }),
    renameCircuit: (id: string, value: string) => {
      setEditing(null);
      modules.renameCircuit(id, value);
    },
    cancelRename: () => setEditing(null),
    createModule: modules.createModule,
    // タブの並びは保存データの回路の順なので、元に戻す対象にする
    reorder: (id: string, index: number) => setProject((p) => moveCircuit(p, id, index)),
    toggleRunning,
    stepOnce,
    stepBack,
    deleteCircuit: modules.deleteCircuit,
    openModuleSettings: () => dialogs.openModuleSettings(circuit.id),
    changeTool,
    addFromPalette: (kind: PartKind, module?: string) => addPart(kind, module),
    // 入力中の変更は履歴に積まない。最初の変更の直前に積んだ1回分で元に戻す
    setClockPeriod: (id: string, period: number) =>
      setCircuit((cur) => edit.setClockPeriod(cur, id, period), false),
    setLabel: (id: string, label: string) =>
      setCircuit((cur) => edit.setLabel(cur, id, label), false),
  });

  return (
    <LanguageContext.Provider value={lang}>
      <Flex direction="column" h="full">
        <Header
          onNew={on.newProject}
          onExport={on.exportProject}
          onImport={on.importProject}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onUndo={on.undoEdit}
          onRedo={on.redoEdit}
          onPreferences={on.openPreferences}
          onAbout={on.openAbout}
        />
        <TabBar
          circuits={project.circuits}
          currentId={circuit.id}
          renamingId={editing?.type === 'tab' ? editing.id : undefined}
          onOpen={on.openCircuit}
          onStartRename={on.startRename}
          onRename={on.renameCircuit}
          onCancelRename={on.cancelRename}
          onAddModule={on.createModule}
          onReorder={on.reorder}
        />
        <SheetToolbar
          tool={tool}
          onToolChange={on.changeTool}
          running={running}
          onToggleRunning={on.toggleRunning}
          onStep={on.stepOnce}
          onStepBack={on.stepBack}
          canStepBack={canStepBack}
          onModuleSettings={circuit.id !== MAIN_ID ? on.openModuleSettings : undefined}
          onDeleteModule={circuit.id !== MAIN_ID ? on.deleteCircuit : undefined}
        />
        <Flex flex="1" minH="0">
          <Palette
            modules={modules.paletteModules}
            collapsed={collapsedGroups}
            onCollapsedChange={setCollapsedGroups}
            onAdd={on.addFromPalette}
          />
          <Sheet
            project={project}
            circuit={circuit}
            nets={nets}
            tool={tool}
            simStore={simStore}
            selection={selection}
            onSelect={setSelection}
            pending={pending}
            onPendingChange={setPending}
            dragMode={dragMode}
            onDragModeChange={setDragMode}
            onResize={setSheetSize}
            view={view}
            showGrid={preferences.showGrid}
            roundWires={preferences.roundWires}
            onViewChange={(v) => setViews((vs) => ({ ...vs, [circuit.id]: v }))}
            onAdd={addPart}
            onMoveStart={startMove}
            onMove={moveParts}
            onWireReshapeEnd={finishReshapeWire}
            onSplitWire={splitWireAt}
            // 移動してから削除エリアに来た場合は、移動と削除をまとめて1回の操作にする
            onDropOnTrash={(moved) => deleteSelection(!moved)}
            onToggle={toggleInput}
            onAddWire={addWire}
            onPartDoubleClick={onCompDoubleClick}
            placing={clipboard.placing}
            onPlace={clipboard.paste}
          />
          <PropertyPanel
            part={selectedPart}
            moduleName={
              selectedPart?.kind === 'module'
                ? findDef(project, selectedPart.module)?.name
                : undefined
            }
            inModule={circuit.id !== MAIN_ID}
            otherLabels={circuit.parts
              .filter(
                (c) =>
                  (c.kind === 'input' || c.kind === 'output') &&
                  c.id !== selectedPart?.id &&
                  c.label !== undefined,
              )
              .map((c) => c.label)
              .join('\n')}
            tickMs={preferences.tickMs}
            onEditStart={history.checkpoint}
            onClockPeriodChange={on.setClockPeriod}
            onLabelChange={on.setLabel}
          />
        </Flex>
        <StatusBar
          hints={hints}
          unstable={unstable}
          conflict={conflict}
          unexposedPorts={problems.size > 0}
        />
        {dialogs.element}
      </Flex>
    </LanguageContext.Provider>
  );
}
