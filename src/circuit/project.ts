// プロジェクト (メイン回路と複数のモジュール) の構造と、外から来たデータの検証。
// モジュールのピンの決め方と回路同士の依存は module.ts にある

import { isPart } from './part';
import { isWire, type Circuit } from './circuit';
import { isObject } from '../util';

export const MAIN_ID = 'main';

export interface CircuitDef extends Circuit {
  id: string;
  name: string;
  /**
   * モジュールの形 (パッケージ)。モジュールの回路だけが持ち、メイン回路は持たない。
   * 読み込んだデータのモジュールには必ずある (checkProject で確かめる)。テストなどで作った、持たないモジュールは split として扱う
   */
  package?: Package;
}

/**
 * モジュールの形 (パッケージ)。形の種類 (kind) とピンの数 (pins) で、本体の大きさと、外側のピンを置ける辺と位置が決まる。
 * dip は左右の 2 辺、qfp は 4 辺にピンを置く。split は入力を左、出力を右に置く (version 2 までの形)。
 * どのピンにどのポートをつなぐか (割り当て) は、中の INPUT / OUTPUT の pinNumber で決まる
 */
export type Package =
  | { kind: 'dip'; pins: number }
  | { kind: 'qfp'; pins: number }
  | { kind: 'split' };

/** パッケージのピンの数の上限 */
export const MAX_PACKAGE_PINS = 256;

/** パッケージとして正しい形か。dip のピンは 4 以上の偶数、qfp は 8 以上の 4 の倍数で、どちらも上限以下 */
export function isPackage(f: unknown): f is Package {
  if (!isObject(f)) {
    return false;
  }
  const pins = f.pins;
  const inRange = (min: number, step: number) =>
    Number.isInteger(pins) &&
    (pins as number) >= min &&
    (pins as number) <= MAX_PACKAGE_PINS &&
    (pins as number) % step === 0;
  switch (f.kind) {
    case 'dip':
      return inRange(4, 2);
    case 'qfp':
      return inRange(8, 4);
    case 'split':
      return true;
    default:
      return false;
  }
}

export interface Project {
  /** 先頭はメイン回路 (id = MAIN_ID) */
  circuits: CircuitDef[];
  /** 書き出すときに付ける作者名。入力されていなければ無い */
  author?: string;
}

export function emptyProject(): Project {
  return {
    circuits: [{ id: MAIN_ID, name: 'メイン', parts: [], wires: [] }],
  };
}

export function findDef(project: Project, id: string | undefined): CircuitDef | undefined {
  return project.circuits.find((d) => d.id === id);
}

/**
 * モジュールの回路を、回路の一覧の index 番目に移す (タブの並べ替え)。
 * メイン回路は先頭に固定なので、メイン回路は動かさず、メイン回路より前にも置かない
 */
export function moveCircuit(project: Project, id: string, index: number): Project {
  const moving = project.circuits.find((d) => d.id === id);
  if (!moving || id === MAIN_ID) {
    return project;
  }
  const rest = project.circuits.filter((d) => d.id !== id);
  const at = Math.min(Math.max(index, 1), rest.length);
  return {
    ...project,
    circuits: [...rest.slice(0, at), moving, ...rest.slice(at)],
  };
}

/**
 * INPUT / CLOCK の ON/OFF (部品の on) を外す。保存と共有には含めない (開発者の方針)。
 * フリップフロップの状態など、動かしている間のほかの状態も保存しないので、開き直すと回路はすべて初めの状態から動く
 */
export function withoutSwitchStates(project: Project): Project {
  return {
    ...project,
    circuits: project.circuits.map((d) => ({
      ...d,
      parts: d.parts.map(({ on: _, ...c }) => c),
    })),
  };
}

/**
 * プロジェクトの形の問題。circuit は問題のある回路の名前、id は重複している ID。
 * 利用者に見せる文は、言語ごとの文言の表 (i18n/) が作る
 */
export type ProjectError =
  | { code: 'NO_CIRCUITS' }
  | { code: 'AUTHOR_NOT_STRING' }
  | { code: 'NO_MAIN' }
  | { code: 'NO_CIRCUIT_ID_OR_NAME' }
  | { code: 'NO_PACKAGE'; circuit: string }
  | { code: 'BAD_PACKAGE'; circuit: string }
  | { code: 'NO_PARTS_OR_WIRES'; circuit: string }
  | { code: 'BAD_PART'; circuit: string }
  | { code: 'DUPLICATE_PART_ID'; circuit: string; id: string }
  | { code: 'BAD_WIRE'; circuit: string }
  | { code: 'DUPLICATE_CIRCUIT_ID'; id: string }
  | { code: 'MISSING_MODULE'; circuit: string };

/** isModule は、モジュールの回路 (回路の一覧の 2 つ目以降) か */
function checkCircuit(def: unknown, isModule: boolean): ProjectError | undefined {
  if (!isObject(def) || typeof def.id !== 'string' || typeof def.name !== 'string') {
    return { code: 'NO_CIRCUIT_ID_OR_NAME' };
  }
  // 省略は許さない。既定値で補うと、あとで既定値を変えたときに、古いデータのモジュールのピンの位置が変わって配線が外れるため
  if (isModule && def.package === undefined) {
    return { code: 'NO_PACKAGE', circuit: def.name };
  }
  if (isModule && !isPackage(def.package)) {
    return { code: 'BAD_PACKAGE', circuit: def.name };
  }
  if (!Array.isArray(def.parts) || !Array.isArray(def.wires)) {
    return { code: 'NO_PARTS_OR_WIRES', circuit: def.name };
  }
  const compIds = new Set<string>();
  for (const c of def.parts as unknown[]) {
    if (!isPart(c)) {
      return { code: 'BAD_PART', circuit: def.name };
    }
    if (compIds.has(c.id)) {
      return { code: 'DUPLICATE_PART_ID', circuit: def.name, id: c.id };
    }
    compIds.add(c.id);
  }
  for (const w of def.wires as unknown[]) {
    if (!isWire(w)) {
      return { code: 'BAD_WIRE', circuit: def.name };
    }
  }
  return undefined;
}

/**
 * プロジェクトとして正しい形かを確かめ、問題があればその内容を返す (文にするのは画面の側)。
 * 共有された JSON のほか、localStorage の保存データを読み込むときにも使う
 */
export function checkProject(project: unknown): ProjectError | undefined {
  if (!isObject(project) || !Array.isArray(project.circuits)) {
    return { code: 'NO_CIRCUITS' };
  }
  if (project.author !== undefined && typeof project.author !== 'string') {
    return { code: 'AUTHOR_NOT_STRING' };
  }
  const circuits = project.circuits as unknown[];
  if (!isObject(circuits[0]) || circuits[0].id !== MAIN_ID) {
    return { code: 'NO_MAIN' };
  }
  const ids = new Set<string>();
  for (const [i, def] of circuits.entries()) {
    const error = checkCircuit(def, i > 0);
    if (error) {
      return error;
    }
    const { id } = def as CircuitDef;
    if (ids.has(id)) {
      return { code: 'DUPLICATE_CIRCUIT_ID', id };
    }
    ids.add(id);
  }
  for (const def of circuits as CircuitDef[]) {
    for (const c of def.parts) {
      if (c.kind === 'module' && !ids.has(c.module ?? '')) {
        return { code: 'MISSING_MODULE', circuit: def.name };
      }
    }
  }
  return undefined;
}
