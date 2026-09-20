import { type CircuitDef, type Project, type PinRef, checkProject } from './project';
import { isObject } from './util';

/** 共有用 JSON の形式の版。形式を変えたら上げて、古い版も読み込めるようにする */
const SHARE_VERSION = 1;

interface ShareData {
  /** sazanka の共有データであることの目印 */
  app: 'sazanka';
  version: number;
  project: Project;
}

/** プロジェクト全体を共有用の JSON にする */
export function serializeProject(project: Project): string {
  const author = project.author?.trim();
  const data: ShareData = {
    app: 'sazanka',
    version: SHARE_VERSION,
    project: {
      // 作者名は、入力されていなければ含めない
      ...(author && { author }),
      circuits: project.circuits.map((d) =>
        renameIds(
          d,
          (i) => `part-${i + 1}`,
          (i) => `wire-${i + 1}`,
        ),
      ),
    },
  };
  return JSON.stringify(data);
}

/**
 * 回路の部品と配線の ID を、partId / wireId (引数は何番目か) で付け直し、配線の接続先も合わせる。
 * 書き出すときは、読みやすいよう回路ごとに part-1、wire-1 からの連番にする。
 * 読み込むときは、アプリ内の ID の付け方 (ランダム) にそろえる。
 * ID は回路の中でだけ一意であればよい。回路の ID はモジュールの参照に使うので変えない
 */
function renameIds(def: CircuitDef, partId: (index: number) => string, wireId: (index: number) => string): CircuitDef {
  const ids = new Map(def.components.map((c, i) => [c.id, partId(i)]));
  const ref = (p: PinRef): PinRef => ({ comp: ids.get(p.comp) ?? p.comp, pin: p.pin });
  return {
    ...def,
    components: def.components.map((c) => ({ ...c, id: ids.get(c.id)! })),
    wires: def.wires.map((w, i) => ({ id: wireId(i), from: ref(w.from), to: ref(w.to) })),
  };
}

export type ParseResult = { ok: true; project: Project } | { ok: false; error: string };

/**
 * 共有用の JSON を読み込む。部品と配線の ID は newId で付け直す。
 * 他人から受け取った文字列なので、形が正しいかをひととおり確かめ、問題があれば理由を返す
 */
export function parseProject(text: string, newId: () => string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON として読み取れません' };
  }
  if (!isObject(data) || data.app !== 'sazanka') return { ok: false, error: 'sazanka の回路データではありません' };
  if (typeof data.version !== 'number' || data.version > SHARE_VERSION) {
    return { ok: false, error: '新しい版の sazanka で作られたデータのため読み込めません' };
  }
  const error = checkProject(data.project);
  if (error) return { ok: false, error: `回路データが壊れています (${error})` };
  const project = data.project as Project;
  return { ok: true, project: { ...project, circuits: project.circuits.map((d) => renameIds(d, newId, newId)) } };
}
