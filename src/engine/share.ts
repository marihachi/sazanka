// 共有用 JSON の書き出しと読み込み。形の検証は project.ts の checkProject を使う

import type { PinRef } from './circuit';
import {
  type CircuitDef,
  type Project,
  checkProject,
  withoutSwitchStates,
} from './project';
import { isObject } from './util';

/** 共有用 JSON の形式の版。形式を変えたら上げて、古い版も読み込めるようにする */
const SHARE_VERSION = 1;

interface ShareData {
  /** sazanka の共有データであることの目印 */
  app: 'sazanka';
  version: number;
  project: Project;
}

/**
 * 回路の部品と配線の ID を付け直し、配線がつなぐ部品の ID も合わせて直す。
 * 新しい ID は partId / wireId で作る (引数は、その部品や配線が何番目か)。
 * 書き出すときは、JSON を読みやすくするため、回路ごとに part-1、wire-1 からの連番にする。
 * 読み込むときは、アプリの中と同じランダムな ID にそろえる。
 * ID は回路の中で重ならなければよい。回路の ID はモジュールの参照に使っているので変えない
 */
function renameIds(
  def: CircuitDef,
  partId: (index: number) => string,
  wireId: (index: number) => string,
): CircuitDef {
  const ids = new Map(def.components.map((c, i) => [c.id, partId(i)]));
  const ref = (p: PinRef): PinRef => ({
    comp: ids.get(p.comp) ?? p.comp,
    pin: p.pin,
  });
  return {
    ...def,
    components: def.components.map((c) => ({ ...c, id: ids.get(c.id)! })),
    wires: def.wires.map((w, i) => ({
      ...w,
      id: wireId(i),
      from: ref(w.from),
      to: ref(w.to),
    })),
  };
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
      circuits: withoutSwitchStates(project).circuits.map((d) =>
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

export type ParseResult =
  { ok: true; project: Project } | { ok: false; error: string };

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
  if (!isObject(data) || data.app !== 'sazanka') {
    return { ok: false, error: 'sazanka の回路データではありません' };
  }
  if (typeof data.version !== 'number' || data.version > SHARE_VERSION) {
    return {
      ok: false,
      error: '新しい版の sazanka で作られたデータのため読み込めません',
    };
  }
  const error = checkProject(data.project);
  if (error) {
    return { ok: false, error: `回路データが壊れています (${error})` };
  }
  // 古いデータには ON/OFF が入っていることがあるが、使わない
  const project = withoutSwitchStates(data.project as Project);
  return {
    ok: true,
    project: {
      ...project,
      circuits: project.circuits.map((d) => renameIds(d, newId, newId)),
    },
  };
}
