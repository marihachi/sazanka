// 共有用 JSON の書き出しと読み込み。形の検証は project.ts の checkProject を使う

import {
  type CircuitDef,
  type Project,
  type ProjectError,
  checkProject,
  withCircuitSheet,
  withoutSwitchStates,
} from '../circuit/project';
import { fillPortNumbers } from '../circuit/module';
import { isObject } from '../util';
import { upgradeProject } from './upgrade';

/** 共有用 JSON の形式の版。形式を変えたら上げて、古い版を変える処理を upgrade.ts に足す */
const SHARE_VERSION = 3;

interface ShareData {
  /** sazanka の共有データであることの目印 */
  app: 'sazanka';
  version: number;
  project: Project;
}

/**
 * 回路の部品と配線の ID を付け直す。
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
  return {
    ...def,
    parts: def.parts.map((c, i) => ({ ...c, id: partId(i) })),
    wires: def.wires.map((w, i) => ({ ...w, id: wireId(i) })),
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
          withCircuitSheet(d),
          (i) => `part-${i + 1}`,
          (i) => `wire-${i + 1}`,
        ),
      ),
    },
  };
  return JSON.stringify(data);
}

/** 共有用 JSON を読み込めなかった理由。BROKEN の detail は、検証で見つかった問題 */
export type ShareError =
  | { code: 'NOT_JSON' }
  | { code: 'NOT_SAZANKA' }
  | { code: 'NEWER_VERSION' }
  | { code: 'BROKEN'; detail: ProjectError };

export type ParseResult = { ok: true; project: Project } | { ok: false; error: ShareError };

/**
 * 共有用の JSON を読み込む。部品と配線の ID は newId で付け直す。
 * 他人から受け取った文字列なので、形が正しいかをひととおり確かめ、問題があれば理由を返す
 */
export function parseProject(text: string, newId: () => string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: { code: 'NOT_JSON' } };
  }
  if (!isObject(data) || data.app !== 'sazanka') {
    return { ok: false, error: { code: 'NOT_SAZANKA' } };
  }
  if (typeof data.version !== 'number' || data.version > SHARE_VERSION) {
    return { ok: false, error: { code: 'NEWER_VERSION' } };
  }
  // 古い版は、今の版の形に変えてから確かめる
  const raw = upgradeProject(data.project, data.version);
  const error = checkProject(raw);
  if (error) {
    return { ok: false, error: { code: 'BROKEN', detail: error } };
  }
  // 古いデータには ON/OFF が入っていることがあるが、使わない。ポート番号は、ないものや重なるものを付け直す。
  // シートの大きさがない回路は 300×200 にする
  const project = withoutSwitchStates(raw as Project);
  return {
    ok: true,
    project: {
      ...project,
      circuits: project.circuits.map((d) =>
        withCircuitSheet(fillPortNumbers(renameIds(d, newId, newId))),
      ),
    },
  };
}
