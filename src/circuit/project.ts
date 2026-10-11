// プロジェクト (メイン回路と複数のモジュール) の構造と、外から来たデータの検証。
// モジュールのピンの決め方と回路同士の依存は module.ts にある

import { isPart } from './part';
import { isWire, type Circuit } from './circuit';
import { isObject } from '../util';

export const MAIN_ID = 'main';

export interface CircuitDef extends Circuit {
  id: string;
  /**
   * 回路の名前 (モジュールの名前)。メイン回路は空文字。
   * メイン回路の名前は表示言語の文言から引き (i18n/messages.ts の getCircuitName)、保存データにも書かない
   */
  name: string;
  /**
   * モジュールの形 (パッケージ)。モジュールの回路だけが持ち、メイン回路は持たない。
   * 読み込んだデータのモジュールには必ずある (checkProject で確かめる)。テストなどで作った、持たないモジュールは split として扱う
   */
  package?: Package;
  /**
   * シートの大きさ (マス)。読み込んだデータと、アプリで作った回路には必ずある (withCircuitSheet)。
   * 型で省略できるのは、テストで回路を手短に作れるようにするため。持たない回路は DEFAULT_SHEET として扱う
   */
  sheet?: CircuitSheet;
}

/** シートの大きさ (マス)。左上が回路の座標の原点で、右と下へ広がる */
export interface CircuitSheet {
  width: number;
  height: number;
}

/**
 * sheet を持たない回路の大きさ (横 300 マス、縦 200 マス)。
 * 形式の文書で、省略したときの大きさとして決めた値なので変えない。変えると、古いデータの回路の大きさが変わる
 */
export const DEFAULT_SHEET: CircuitSheet = { width: 300, height: 200 };

/** シートの 1 辺のマスの数の下限と上限 */
export const MIN_SHEET_CELLS = 20;
export const MAX_SHEET_CELLS = 1000;

/** シートの 1 辺のマスの数として使える値か。MIN_SHEET_CELLS〜MAX_SHEET_CELLS の整数 */
export function isSheetCells(v: unknown): v is number {
  return (
    Number.isInteger(v) && (v as number) >= MIN_SHEET_CELLS && (v as number) <= MAX_SHEET_CELLS
  );
}

/** シートの大きさとして使える値か。幅と高さのどちらも isSheetCells */
export function isCircuitSheet(s: unknown): s is CircuitSheet {
  return isObject(s) && isSheetCells(s.width) && isSheetCells(s.height);
}

export function getCircuitSheet(def: CircuitDef): CircuitSheet {
  return def.sheet ?? DEFAULT_SHEET;
}

/**
 * sheet を持たない回路に、DEFAULT_SHEET を書き込む。300×200 の回路も、保存データと共有用 JSON に必ず書くため (開発者の方針)。
 * JSON で parts の前に来るよう、parts と wires を後ろに置き直す
 */
export function withCircuitSheet(def: CircuitDef): CircuitDef {
  if (def.sheet) {
    return def;
  }
  const { parts, wires, ...rest } = def;
  return { ...rest, sheet: DEFAULT_SHEET, parts, wires };
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
    circuits: [{ id: MAIN_ID, name: '', sheet: DEFAULT_SHEET, parts: [], wires: [] }],
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
 * プロジェクトの形の問題。circuit は問題のある回路の名前、circuitId はその ID、id は重複している ID。
 * メイン回路は保存データに名前を持たないので、circuit は空文字 (画面の側が表示言語の名前にする)。
 * 利用者に見せる文は、言語ごとの文言の表 (i18n/) が作る
 */
export type ProjectError =
  | { code: 'NO_CIRCUITS' }
  | { code: 'AUTHOR_NOT_STRING' }
  | { code: 'NO_MAIN' }
  | { code: 'NO_CIRCUIT_ID_OR_NAME' }
  | { code: 'NO_PACKAGE'; circuit: string; circuitId: string }
  | { code: 'BAD_PACKAGE'; circuit: string; circuitId: string }
  | { code: 'BAD_SHEET'; circuit: string; circuitId: string }
  | { code: 'NO_PARTS_OR_WIRES'; circuit: string; circuitId: string }
  | { code: 'BAD_PART'; circuit: string; circuitId: string }
  | { code: 'BAD_WIRE'; circuit: string; circuitId: string }
  | { code: 'DUPLICATE_ID'; id: string }
  | { code: 'MISSING_MODULE'; circuit: string; circuitId: string };

/**
 * 回路 1 つの形を確かめる。isModule は、モジュールの回路 (回路の一覧の 2 つ目以降) か。
 * 名前はモジュールの回路だけが持つ。メイン回路の名前は見ない (あっても読み込むときに捨てる)
 */
function checkCircuit(def: unknown, isModule: boolean): ProjectError | undefined {
  if (!isObject(def) || typeof def.id !== 'string' || (isModule && typeof def.name !== 'string')) {
    return { code: 'NO_CIRCUIT_ID_OR_NAME' };
  }
  const at = { circuit: isModule ? (def.name as string) : '', circuitId: def.id };
  // 省略は許さない。既定値で補うと、あとで既定値を変えたときに、古いデータのモジュールのピンの位置が変わって配線が外れるため
  if (isModule && def.package === undefined) {
    return { code: 'NO_PACKAGE', ...at };
  }
  if (isModule && !isPackage(def.package)) {
    return { code: 'BAD_PACKAGE', ...at };
  }
  // 省略は許す。version 3 を公開したあとに足した項目で、それより前のデータにはないため
  if (def.sheet !== undefined && !isCircuitSheet(def.sheet)) {
    return { code: 'BAD_SHEET', ...at };
  }
  if (!Array.isArray(def.parts) || !Array.isArray(def.wires)) {
    return { code: 'NO_PARTS_OR_WIRES', ...at };
  }
  if (!(def.parts as unknown[]).every(isPart)) {
    return { code: 'BAD_PART', ...at };
  }
  if (!(def.wires as unknown[]).every(isWire)) {
    return { code: 'BAD_WIRE', ...at };
  }
  return undefined;
}

/**
 * 回路・部品・配線の ID で、ほかと重なるもの (最初に見つかったもの)。なければ undefined。
 * ID は種類をまたいで、プロジェクトの中で重ならない (形式の文書の「ID の付け方」)
 */
function findDuplicateId(circuits: readonly CircuitDef[]): string | undefined {
  const ids = new Set<string>();
  for (const def of circuits) {
    for (const id of [def.id, ...def.parts.map((c) => c.id), ...def.wires.map((w) => w.id)]) {
      if (ids.has(id)) {
        return id;
      }
      ids.add(id);
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
  for (const [i, def] of circuits.entries()) {
    const error = checkCircuit(def, i > 0);
    if (error) {
      return error;
    }
  }
  const defs = circuits as CircuitDef[];
  const duplicate = findDuplicateId(defs);
  if (duplicate !== undefined) {
    return { code: 'DUPLICATE_ID', id: duplicate };
  }
  const circuitIds = new Set(defs.map((d) => d.id));
  for (const [i, def] of defs.entries()) {
    if (def.parts.some((c) => c.kind === 'module' && !circuitIds.has(c.module ?? ''))) {
      return { code: 'MISSING_MODULE', circuit: i > 0 ? def.name : '', circuitId: def.id };
    }
  }
  return undefined;
}
