// 問題パネルに出す問題を集める計算。文は言語ごとの文言の表 (i18n/) の problems にある
import { findUnexposedPortsToWarn } from '../circuit/module';
import { type CircuitDef, getCircuitSheet, type Project } from '../circuit/project';
import { isConflict, type Nets } from '../geometry/net';
import { findOutsideSheet } from '../geometry/view';

/**
 * 問題の種類。文言の表の problems.messages のキーと同じ。
 * - UNSTABLE: 発振している (値が決まらない)
 * - CONFLICT: 1 つのネットに出力ピンが 2 つ以上ある
 * - UNEXPOSED_PORTS: 外側のピンに出せないポートがある (メイン回路では出さない)
 * - OUTSIDE_SHEET: シートの外に部品か配線がある
 * - MISSING_CIRCUIT: 指す回路がプロジェクトにないモジュール (未解決のモジュール) がある。プロジェクト全体の問題で、見つからない回路ごとに 1 つ
 */
export type ProblemCode =
  | 'UNSTABLE'
  | 'CONFLICT'
  | 'UNEXPOSED_PORTS'
  | 'OUTSIDE_SHEET'
  | 'MISSING_CIRCUIT';

/** エラーは回路が正しく動かないもの、警告は動くが直した方がよいもの */
export type ProblemSeverity = 'error' | 'warning';

export interface Problem {
  code: ProblemCode;
  severity: ProblemSeverity;
  /** 起きているか所の数。数えられないもの (発振) は undefined */
  count?: number;
  /** 見つからない回路の ID と名前の写し (MISSING_CIRCUIT だけ)。名前が分からなければ空文字 */
  circuitId?: string;
  name?: string;
  /** 元になっている部品と配線の ID。行を押したときに選ぶ。どちらも空なら、押しても何もしない */
  parts: string[];
  wires: string[];
}

/** 問題の種類ごとの、エラーか警告か */
export const PROBLEM_SEVERITY: Record<ProblemCode, ProblemSeverity> = {
  UNSTABLE: 'error',
  CONFLICT: 'error',
  UNEXPOSED_PORTS: 'warning',
  OUTSIDE_SHEET: 'warning',
  MISSING_CIRCUIT: 'error',
};

/**
 * 開いている回路 circuit の問題と、プロジェクト全体の問題 (見つからない回路) を集める。エラーを先に、そのあとに警告を並べる。
 * プロジェクト全体の問題を先に置く。
 * nets は開いている回路のネット (画面の描画と同じものを渡し、計算し直さない)。
 * unstable は、開いている回路のシミュレーションが発振しているか (シミュレーションでしか分からないため、呼ぶ側が渡す)
 */
export function collectProblems(
  circuit: CircuitDef,
  project: Project,
  nets: Nets,
  unstable: boolean,
): Problem[] {
  const problems: Problem[] = [...findMissingCircuits(circuit, project)];
  const add = (code: ProblemCode, parts: string[], wires: string[], count?: number) => {
    problems.push({ code, severity: PROBLEM_SEVERITY[code], count, parts, wires });
  };

  if (unstable) {
    // どの部品が発振しているかは分からないので、か所の数も選ぶものもない
    add('UNSTABLE', [], []);
  }

  const conflicts = nets.nets.filter(isConflict);
  if (conflicts.length > 0) {
    // ぶつかっている出力ピンの部品と、そのネットの配線を選ぶ。か所はネットの数
    const parts = [...new Set(conflicts.flatMap((n) => n.outputs.map((p) => p.comp)))];
    add(
      'CONFLICT',
      parts,
      conflicts.flatMap((n) => n.wires),
      conflicts.length,
    );
  }

  const unexposed = [...findUnexposedPortsToWarn(circuit).keys()];
  if (unexposed.length > 0) {
    add('UNEXPOSED_PORTS', unexposed, [], unexposed.length);
  }

  const outside = findOutsideSheet(circuit, project, getCircuitSheet(circuit));
  const outsideCount = outside.parts.length + outside.wires.length;
  if (outsideCount > 0) {
    add('OUTSIDE_SHEET', outside.parts, outside.wires, outsideCount);
  }

  // エラーを先に並べる (add を呼ぶ順で決まっているが、種類を足したときに崩れないよう並べ直す)
  return problems.sort(
    (a, b) => Number(a.severity === 'warning') - Number(b.severity === 'warning'),
  );
}

/**
 * 見つからない回路 (未解決のモジュールが指している、プロジェクトにない回路)。見つからない回路ごとに 1 つ。
 * か所の数は、すべての回路に置いている数。選ぶのは、開いている回路 circuit に置いている部品だけ (なければ押せない)。
 * 名前は、部品が持つ写しのうち、空でない最初のもの
 */
function findMissingCircuits(circuit: CircuitDef, project: Project): Problem[] {
  const ids = new Set(project.circuits.map((d) => d.id));
  const found = new Map<string, Problem>();
  for (const def of project.circuits) {
    for (const c of def.parts) {
      if (c.kind !== 'module' || ids.has(c.circuitId ?? '')) {
        continue;
      }
      const id = c.circuitId ?? '';
      const p = found.get(id) ?? {
        code: 'MISSING_CIRCUIT',
        severity: PROBLEM_SEVERITY.MISSING_CIRCUIT,
        count: 0,
        circuitId: id,
        name: '',
        parts: [],
        wires: [],
      };
      p.count = (p.count ?? 0) + 1;
      p.name ||= c.circuitName ?? '';
      if (def.id === circuit.id) {
        p.parts.push(c.id);
      }
      found.set(id, p);
    }
  }
  return [...found.values()];
}

/** 問題の数をエラーと警告に分けて数える (タブに出す数) */
export function countProblems(problems: readonly Problem[]): { errors: number; warnings: number } {
  const errors = problems.filter((p) => p.severity === 'error').length;
  return { errors, warnings: problems.length - errors };
}
