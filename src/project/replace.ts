// 別のモジュールに差し替える計算: 回路を置いている部品を、すべて別の回路を指すようにする
import { circuitsUsing, dependsOn, getPinout, type Pinout } from '../circuit/module';
import type { Part } from '../circuit/part';
import { type CircuitDef, MAIN_ID, type Project } from '../circuit/project';

/**
 * 回路 sourceId を置いている部品の差し替え先にできる回路 (回路の並びの順)。
 * 自分自身とメイン回路 (ほかの回路に置けない) は除く。差し替えると循環する回路 (source を置いている回路を、
 * 中に含む回路。その回路自身も) も除く
 */
export function replaceTargets(project: Project, sourceId: string): CircuitDef[] {
  const users = circuitsUsing(project, sourceId);
  return project.circuits.filter(
    (d) =>
      d.id !== sourceId &&
      d.id !== MAIN_ID &&
      users.every((u) => u.id !== d.id && !dependsOn(project, d.id, u.id)),
  );
}

/**
 * 回路 sourceId を置いている部品を、すべて回路 targetId を指すようにしたプロジェクト。
 * 部品の名前と大きさの写し (見つからないモジュールのためのもの) は捨てる (差し替え先の回路があるため)。
 * removeSource なら、差し替えたあと元の回路をプロジェクトから削除する (置いている部品はもうない)
 */
export function replaceCircuit(
  project: Project,
  sourceId: string,
  targetId: string,
  removeSource: boolean,
): Project {
  const points = (c: Part) => c.kind === 'module' && c.circuitId === sourceId;
  const circuits = project.circuits
    .filter((d) => !(removeSource && d.id === sourceId))
    .map((d) =>
      d.parts.some(points)
        ? {
            ...d,
            parts: d.parts.map((c) => {
              if (!points(c)) {
                return c;
              }
              const { circuitName: _, circuitSize: __, ...rest } = c;
              return { ...rest, circuitId: targetId };
            }),
          }
        : d,
    );
  return { ...project, circuits };
}

/**
 * 回路 a と b を置いたときの外側のピンが同じか (パッケージ、入力と出力の数、ピン番号)。
 * 違えば、差し替えると置いている所の配線が外れたり、別のピンにつながったりすることがある
 */
export function samePins(project: Project, a: string, b: string): boolean {
  const pinout = (id: string) =>
    getPinout({ id: '', kind: 'module', x: 0, y: 0, circuitId: id }, project);
  return samePinout(pinout(a), pinout(b));
}

/** 2 つの外側のピン (getPinout) が同じか (パッケージ、入力と出力の数、ピン番号) */
export function samePinout(p: Pinout, q: Pinout): boolean {
  return (
    JSON.stringify(p.package) === JSON.stringify(q.package) &&
    p.inputs.length === q.inputs.length &&
    p.outputs.length === q.outputs.length &&
    JSON.stringify(p.pinNumbers) === JSON.stringify(q.pinNumbers)
  );
}
