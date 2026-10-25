import { useMemo } from 'react';
import type { ConfirmRequest } from '../ui/ConfirmDialog';
import type { PaletteModule } from '../palette/Palette';
import { newId } from '../circuit/circuit';
import type { Part } from '../circuit/part';
import { moduleSizeOf } from '../geometry/layout';
import { circuitsUsing, dependsOn } from '../circuit/module';
import {
  DEFAULT_SPLIT_PACKAGE,
  type CircuitDef,
  checkCircuitName,
  DEFAULT_SHEET,
  MAIN_ID,
  type Project,
} from '../circuit/project';
import { getCircuitName, type Messages } from '../i18n/messages';

/** 回路の追加・改名・削除と、パレットに並べるモジュールの一覧。追加のダイアログ (フォルダを選ぶ) は project/useFolders.ts にある */
export function useCircuits({
  project,
  circuit,
  setProject,
  openCircuit,
  onDeleted,
  showConfirm,
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
  /** 回路を削除した。その回路のタブを閉じ、その回路について覚えているもの (シミュレーションの結果、表示) を捨てる */
  onDeleted: (id: string) => void;
  showConfirm: (request: ConfirmRequest) => void;
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

  /**
   * フォルダ folder に置く回路の、既定の名前 (「回路<n>」)。同じフォルダの回路の名前とメイン回路の表示名を避ける。
   * 番号は、メイン回路以外の回路の数 + 1 から (回路の数にはメイン回路も入っている)。使われていれば次の番号にする
   */
  function defaultCircuitName(folder: string): string {
    let n = project.circuits.length;
    while (checkCircuitName(project, m.circuits.defaultName(n), m.common.mainCircuit, folder)) {
      n++;
    }
    return m.circuits.defaultName(n);
  }

  /** フォルダ folder に、名前 name の空の回路を作り、開く (名前は呼ぶ側が確かめる) */
  function addCircuit(name: string, folder: string) {
    const def: CircuitDef = {
      id: newId(),
      name,
      path: folder,
      author: '',
      package: DEFAULT_SPLIT_PACKAGE,
      sheet: DEFAULT_SHEET,
      parts: [],
      wires: [],
    };
    setProject((p) => ({ ...p, circuits: [...p.circuits, def] }));
    openCircuit(def.id);
  }

  /**
   * 名前を変える。空の名前なら変えない。同じフォルダのほかの回路と同じ名前なら、変えずにそのことを知らせる
   * (同じフォルダに同じ名前の回路があると、保存データが検証を通らず、次に開くときに読み込めなくなるため)
   */
  function renameCircuit(id: string, value: string) {
    const name = value.trim();
    const folder = project.circuits.find((d) => d.id === id)?.path ?? '';
    const problem = checkCircuitName(project, name, m.common.mainCircuit, folder, id);
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

  /**
   * 回路 id をプロジェクトから削除する (確認を出してから)。メイン回路は削除できない。ほかの回路に置かれていても削除できる。
   * 置いている部品は残り、指す回路がなくなるので見つからないモジュールになる。何が足りないかを見せるため、
   * その部品に今の名前の写し (circuitName) を持たせる。元に戻す 1 回で、回路も部品も戻る
   */
  function removeCircuit(id: string) {
    const target = project.circuits.find((d) => d.id === id);
    if (!target || id === MAIN_ID) {
      return;
    }
    const users = circuitsUsing(project, id);
    const name = target.name;
    const placed = project.circuits
      .flatMap((d) => d.parts)
      .filter((c) => c.kind === 'module' && c.circuitId === id).length;
    showConfirm({
      message:
        users.length > 0
          ? m.circuits.confirmRemoveUsed(name, getCircuitName(users[0], m), users.length, placed)
          : m.circuits.confirmRemove(name),
      confirmLabel: m.circuits.remove,
      danger: true,
      onConfirm: () => {
        setProject((p) => removeCircuitFrom(p, id, name));
        // 削除した回路のタブは、onDeleted で閉じる (メイン回路は開かない)
        onDeleted(id);
      },
    });
  }

  return { paletteModules, defaultCircuitName, addCircuit, renameCircuit, removeCircuit };
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

/**
 * 回路 id をプロジェクトから削除したプロジェクト。id を指していた部品は残し、名前の写し name と、削除する前の本体の大きさの写しを
 * 持たせる (見つからないモジュールになり、元と同じ大きさの箱で描かれる)。
 * 部品を書き換えない回路は、同じものを使う
 */
export function removeCircuitFrom(project: Project, id: string, name: string): Project {
  const points = (c: Part) => c.kind === 'module' && c.circuitId === id;
  return {
    ...project,
    circuits: project.circuits
      .filter((d) => d.id !== id)
      .map((d) =>
        d.parts.some(points)
          ? {
              ...d,
              parts: d.parts.map((c) =>
                points(c) ? { ...c, circuitName: name, circuitSize: moduleSizeOf(c, project) } : c,
              ),
            }
          : d,
      ),
  };
}
