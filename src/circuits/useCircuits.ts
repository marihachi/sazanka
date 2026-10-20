import { useMemo } from 'react';
import type { ConfirmRequest } from '../ui/ConfirmDialog';
import type { PromptRequest } from '../ui/PromptDialog';
import type { PaletteModule } from '../palette/Palette';
import { newId } from '../circuit/circuit';
import { circuitsUsing, dependsOn } from '../circuit/module';
import {
  type CircuitDef,
  checkCircuitName,
  DEFAULT_SHEET,
  MAIN_ID,
  type Project,
} from '../circuit/project';
import { getCircuitName, type Messages } from '../i18n/messages';

/** 回路の追加・改名・削除と、パレットに並べるモジュールの一覧 */
export function useCircuits({
  project,
  circuit,
  setProject,
  openCircuit,
  onDeleted,
  showConfirm,
  showPrompt,
  m,
}: {
  /** 文言の表。このフックは言語を渡す側 (App) で呼ぶので、Context ではなく引数で受け取る */
  m: Messages;
  project: Project;
  /** 開いている回路 */
  circuit: CircuitDef;
  /** 元に戻せる編集としてプロジェクトを更新する */
  setProject: (update: (p: Project) => Project) => void;
  openCircuit: (id: string) => void;
  /** 回路を削除した。その回路について覚えているもの (シミュレーションの結果、表示) を捨てる */
  onDeleted: (id: string) => void;
  showConfirm: (request: ConfirmRequest) => void;
  showPrompt: (request: PromptRequest) => void;
}) {
  /**
   * パネルに並べるモジュール。今の回路に置けないもの (循環するもの) は理由付き。
   * 部品を動かしただけでは変わらないので、回路の名前と、どの回路にどのモジュールを置いているかが変わったときだけ作り直す
   * (作り直すとパレットが描き直され、ドラッグが重くなるため)
   */
  const modulesKey = [
    circuit.id,
    ...project.circuits.map(
      (d) =>
        `${d.id}:${d.name}:${d.parts
          .filter((c) => c.kind === 'module')
          .map((c) => c.circuitId)
          .join(',')}`,
    ),
  ].join('|');
  // biome-ignore lint/correctness/useExhaustiveDependencies: 上の理由で、modulesKey が変わったときだけ作り直す
  const paletteModules: PaletteModule[] = useMemo(
    () =>
      project.circuits
        .filter((d) => d.id !== MAIN_ID)
        .map((d) => ({
          def: d,
          blocked:
            d.id === circuit.id
              ? m.palette.selfModule
              : dependsOn(project, d.id, circuit.id)
                ? m.palette.containsThis(d.name)
                : undefined,
        })),
    [modulesKey, m],
  );

  /** 名前を入力するウィンドウを開き、確定したら回路を作成して開く */
  function createCircuit() {
    // 既定の名前は、ほかの回路の名前とメイン回路の表示名を避ける
    const names = new Set([...project.circuits.map((d) => d.name), m.common.mainCircuit]);
    // 既定の名前の番号は、メイン回路以外の回路の数 + 1 から (回路の数にはメイン回路も入っている)。使われていれば次の番号にする
    let n = project.circuits.length;
    while (names.has(m.circuits.defaultName(n))) {
      n++;
    }
    showPrompt({
      title: m.circuits.addTitle,
      label: m.circuits.name,
      initial: m.circuits.defaultName(n),
      confirmLabel: m.circuits.add,
      validate: (name) =>
        describeNameProblem(checkCircuitName(project, name, m.common.mainCircuit), m),
      onSubmit: (name) => {
        const def: CircuitDef = {
          id: newId(),
          name,
          path: '',
          author: '',
          package: { kind: 'dip', pins: 8 },
          sheet: DEFAULT_SHEET,
          parts: [],
          wires: [],
        };
        setProject((p) => ({ ...p, circuits: [...p.circuits, def] }));
        openCircuit(def.id);
      },
    });
  }

  /**
   * 名前を変える。空の名前なら変えない。ほかの回路と同じ名前なら、変えずにそのことを知らせる
   * (同じフォルダに同じ名前の回路があると、保存データが検証を通らず、次に開くときに読み込めなくなるため)
   */
  function renameCircuit(id: string, value: string) {
    const name = value.trim();
    const problem = checkCircuitName(project, name, m.common.mainCircuit, id);
    if (problem === 'EMPTY') {
      return;
    }
    if (problem === 'TAKEN') {
      showConfirm({ message: m.circuits.nameTaken });
      return;
    }
    setProject((p) => ({
      ...p,
      circuits: p.circuits.map((d) => (d.id === id ? { ...d, name } : d)),
    }));
  }

  /** 開いている回路を削除する。ほかの回路で使われていれば断る */
  function deleteCircuit() {
    const users = circuitsUsing(project, circuit.id);
    if (users.length > 0) {
      showConfirm({
        message: m.circuits.inUse(
          circuit.name,
          users.map((d) => getCircuitName(d, m)),
        ),
      });
      return;
    }
    const id = circuit.id;
    showConfirm({
      message: m.circuits.confirmDelete(circuit.name),
      confirmLabel: m.circuits.delete,
      danger: true,
      onConfirm: () => {
        setProject((p) => ({
          ...p,
          circuits: p.circuits.filter((d) => d.id !== id),
        }));
        onDeleted(id);
        openCircuit(MAIN_ID);
      },
    });
  }

  return { paletteModules, createCircuit, renameCircuit, deleteCircuit };
}

/** 回路の名前が使えない理由 (checkCircuitName) を、欄の下に出す文にする */
export function describeNameProblem(
  problem: ReturnType<typeof checkCircuitName>,
  m: Messages,
): string | undefined {
  return problem === 'EMPTY'
    ? m.circuits.nameRequired
    : problem === 'TAKEN'
      ? m.circuits.nameTaken
      : undefined;
}
