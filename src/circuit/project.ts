// プロジェクト (メイン回路とほかの回路) の構造と、外から来たデータの検証。
// 回路をモジュールとして置いたときのピンの決め方と、回路同士の依存は module.ts にある

import { isPart } from './part';
import { isWire, type Circuit } from './circuit';
import { isObject } from '../util';

export const MAIN_ID = 'main';

export interface CircuitDef extends Circuit {
  id: string;
  /**
   * 回路の名前。メイン回路は空文字。
   * メイン回路の名前は表示言語の文言から引き (i18n/messages.ts の getCircuitName)、保存データにも書かない
   */
  name: string;
  /**
   * モジュールとして置いたときの形 (パッケージ)。メイン回路も持つ (メイン回路のピンはどこにもつながらない)。
   * 読み込んだデータと、アプリで作った回路には必ずある (checkProject で確かめる)。
   * 型で省略できるのは、テストで回路を手短に作れるようにするため。持たない回路は split として扱う
   */
  package?: Package;
  /**
   * 回路を置くフォルダのパス。フォルダに入れないものは空文字。
   * 型で省略できるのは、テストで回路を手短に作れるようにするため。持たない回路は空文字 (フォルダなし) として扱う
   */
  path?: string;
  /**
   * 作者名。入れていなければ空文字。
   * 型で省略できるのは、テストで回路を手短に作れるようにするため。持たない回路は空文字として扱う
   */
  author?: string;
  /**
   * シートの大きさ (マス)。読み込んだデータと、アプリで作った回路には必ずある (保存データでは省略できない)。
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
 * 新しく作る回路と、sheet を持たない回路 (テストで作ったもの) の大きさ (横 300 マス、縦 200 マス)。
 * 保存データでは sheet を省略できないので、この値を変えても古いデータの回路の大きさは変わらない
 * (一体の形式の、省略したときの大きさは、変換 (file/upgrade/circuit/v1.ts) が持つ)
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
 * 回路をモジュールとして置いたときの形 (パッケージ)。形の種類 (kind) とピンの数 (pins) で、本体の大きさと、外側のピンを置ける辺と位置が決まる。
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
  /**
   * 回路の並び (プロジェクトパネルの並び)。メイン回路 (id = MAIN_ID) が必ず 1 つある。
   * アプリで作ったプロジェクトでは先頭がメイン回路だが、読み込んだデータでは、どこにあってもよい
   */
  circuits: CircuitDef[];
  /**
   * フォルダのパスの一覧 (プロジェクトパネルの並び)。入れ子のフォルダは親も並べる。
   * 型で省略できるのは、テストでプロジェクトを手短に作れるようにするため。持たないプロジェクトは空として扱う
   */
  folders?: string[];
}

export function emptyProject(): Project {
  return {
    folders: [],
    circuits: [
      {
        id: MAIN_ID,
        name: '',
        path: '',
        author: '',
        package: { kind: 'split' },
        sheet: DEFAULT_SHEET,
        parts: [],
        wires: [],
      },
    ],
  };
}

export function findDef(project: Project, id: string | undefined): CircuitDef | undefined {
  return project.circuits.find((d) => d.id === id);
}

/**
 * 回路の名前 name (前後の空白を除いたもの) が使えない理由。使えれば undefined。
 * 空の名前は 'EMPTY'。ほかの回路 (exceptId の回路を除く) と同じ名前と、メイン回路の表示名 mainName は 'TAKEN'
 * (タブで見分けられなくなるため。保存データの検証も、同じフォルダに同じ名前の回路があると断る)。
 * 回路の追加、タブでの改名、回路設定で使う
 */
export function checkCircuitName(
  project: Project,
  name: string,
  mainName: string,
  exceptId?: string,
): 'EMPTY' | 'TAKEN' | undefined {
  if (!name) {
    return 'EMPTY';
  }
  if (name === mainName || project.circuits.some((d) => d.id !== exceptId && d.name === name)) {
    return 'TAKEN';
  }
  return undefined;
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
 * フォルダのパスとして正しい形か。区切りは `/` で、空の部分、`.`、`..` は使えない (先頭と末尾の `/` も空の部分になる)。
 * 空文字 (フォルダに入れない) は、フォルダのパスではないので false
 */
export function isFolderPath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    path !== '' &&
    path.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
  );
}

/** フォルダのパスの親 (最後の `/` より前)。いちばん上のフォルダなら undefined */
function parentFolder(path: string): string | undefined {
  const at = path.lastIndexOf('/');
  return at < 0 ? undefined : path.slice(0, at);
}

/**
 * プロジェクトの形の問題。circuit は問題のある回路の名前、circuitId はその ID、id は重複している ID、folder はフォルダのパス。
 * メイン回路は保存データに名前を持たないので、circuit は空文字 (画面の側が表示言語の名前にする)。
 * 利用者に見せる文は、言語ごとの文言の表 (i18n/) が作る
 */
export type ProjectError =
  | { code: 'NOT_PROJECT' }
  | { code: 'NO_FOLDERS' }
  | { code: 'BAD_FOLDER'; folder: string }
  | { code: 'NO_CIRCUITS' }
  | { code: 'BAD_ENTRY' }
  | { code: 'MISSING_FOLDER'; folder: string }
  | { code: 'NO_CIRCUIT_ID_OR_NAME' }
  | { code: 'NOT_CIRCUIT'; circuit: string; circuitId: string }
  | { code: 'EMPTY_NAME'; circuit: string; circuitId: string }
  | { code: 'AUTHOR_NOT_STRING'; circuit: string; circuitId: string }
  | { code: 'NO_PACKAGE'; circuit: string; circuitId: string }
  | { code: 'BAD_PACKAGE'; circuit: string; circuitId: string }
  | { code: 'BAD_SHEET'; circuit: string; circuitId: string }
  | { code: 'NO_ELEMENTS'; circuit: string; circuitId: string }
  | { code: 'BAD_ELEMENT'; circuit: string; circuitId: string }
  | { code: 'DUPLICATE_PORT_NUMBER'; circuit: string; circuitId: string }
  | { code: 'NO_MAIN' }
  | { code: 'DUPLICATE_ID'; id: string }
  | { code: 'DUPLICATE_NAME'; name: string; folder: string };

/** 版の番号として正しい形か (1 以上の整数)。今の版以下かは、読み込みの入口 (file/upgrade/index.ts) が確かめる */
function isVersion(v: unknown): boolean {
  return Number.isInteger(v) && (v as number) >= 1;
}

/** INPUT / OUTPUT のポート番号が、入力どうし・出力どうしで重なるか */
function hasDuplicatePortNumber(elements: readonly Record<string, unknown>[]): boolean {
  for (const kind of ['input', 'output']) {
    const seen = new Set<unknown>();
    for (const e of elements) {
      if (e.kind !== kind) {
        continue;
      }
      if (seen.has(e.portNumber)) {
        return true;
      }
      seen.add(e.portNumber);
    }
  }
  return false;
}

/**
 * 回路 (回路の形式のデータ) 1 つの形を確かめる。メイン回路は id が MAIN_ID のもの。
 * 名前はメイン回路以外が持ち、空にできない。メイン回路の名前は見ない (あっても読み込むときに捨てる)
 */
function checkCircuit(def: unknown): ProjectError | undefined {
  if (!isObject(def) || typeof def.id !== 'string') {
    return { code: 'NO_CIRCUIT_ID_OR_NAME' };
  }
  const isMain = def.id === MAIN_ID;
  if (!isMain && typeof def.name !== 'string') {
    return { code: 'NO_CIRCUIT_ID_OR_NAME' };
  }
  const at = { circuit: isMain ? '' : (def.name as string), circuitId: def.id };
  if (def.format !== 'sazanka-circuit' || !isVersion(def.version)) {
    return { code: 'NOT_CIRCUIT', ...at };
  }
  if (!isMain && (def.name as string).trim() === '') {
    return { code: 'EMPTY_NAME', ...at };
  }
  if (typeof def.author !== 'string') {
    return { code: 'AUTHOR_NOT_STRING', ...at };
  }
  // 省略は許さない。既定値で補うと、あとで既定値を変えたときに、古いデータのモジュールのピンの位置が変わって配線が外れるため
  if (def.package === undefined) {
    return { code: 'NO_PACKAGE', ...at };
  }
  if (!isPackage(def.package)) {
    return { code: 'BAD_PACKAGE', ...at };
  }
  if (!isCircuitSheet(def.sheet)) {
    return { code: 'BAD_SHEET', ...at };
  }
  if (!Array.isArray(def.elements)) {
    return { code: 'NO_ELEMENTS', ...at };
  }
  // 要素は種類で見分ける。配線の種類 (wire) なら配線の形、それ以外は部品の形で確かめる (知らない種類は部品の種類にもないので断る)。
  // エラーは部品と配線で分けない (どちらも要素の問題として知らせる)
  const isElement = (e: unknown) => (isObject(e) && e.kind === 'wire' ? isWire(e) : isPart(e));
  if (!(def.elements as unknown[]).every(isElement)) {
    return { code: 'BAD_ELEMENT', ...at };
  }
  if (hasDuplicatePortNumber(def.elements as Record<string, unknown>[])) {
    return { code: 'DUPLICATE_PORT_NUMBER', ...at };
  }
  return undefined;
}

/** フォルダの一覧を確かめる。どれも正しいパスで、重ならず、入れ子のフォルダの親も一覧にあること */
function checkFolders(folders: unknown): ProjectError | undefined {
  if (!Array.isArray(folders) || !folders.every((f) => typeof f === 'string')) {
    return { code: 'NO_FOLDERS' };
  }
  const seen = new Set<string>();
  for (const folder of folders as string[]) {
    if (!isFolderPath(folder) || seen.has(folder)) {
      return { code: 'BAD_FOLDER', folder };
    }
    seen.add(folder);
  }
  for (const folder of folders as string[]) {
    const parent = parentFolder(folder);
    if (parent !== undefined && !seen.has(parent)) {
      return { code: 'BAD_FOLDER', folder };
    }
  }
  return undefined;
}

/** 保存データの回路のうち、検証のあとに見るところ (checkCircuit で形を確かめたもの) */
interface CheckedCircuit {
  id: string;
  name?: string;
  elements: { kind: string; circuitId?: string }[];
}

/**
 * 回路の ID で、ほかと重なるもの (最初に見つかったもの)。なければ undefined。
 * 保存する ID は回路の ID だけ (部品と配線の ID は読み込むときに付ける。形式の文書の「ID の付け方」)
 */
function findDuplicateId(circuits: readonly { id: string }[]): string | undefined {
  const ids = new Set<string>();
  for (const { id } of circuits) {
    if (ids.has(id)) {
      return id;
    }
    ids.add(id);
  }
  return undefined;
}

/**
 * プロジェクトの形式のデータとして正しい形かを確かめ、問題があればその内容を返す (文にするのは画面の側)。
 * プロジェクトファイルのほか、localStorage の保存データを読み込むときにも使う。
 * 一体の形式のデータや古い版は、先に読み込みの入口 (file/upgrade/index.ts) で今の版の形にしておく
 */
export function checkProject(project: unknown): ProjectError | undefined {
  if (!isObject(project) || project.format !== 'sazanka-project' || !isVersion(project.version)) {
    return { code: 'NOT_PROJECT' };
  }
  const folderError = checkFolders(project.folders);
  if (folderError) {
    return folderError;
  }
  const folders = new Set(project.folders as string[]);
  if (!Array.isArray(project.circuits)) {
    return { code: 'NO_CIRCUITS' };
  }
  const entries = project.circuits as unknown[];
  for (const entry of entries) {
    if (!isObject(entry) || typeof entry.path !== 'string') {
      return { code: 'BAD_ENTRY' };
    }
    if (entry.path !== '' && !folders.has(entry.path)) {
      return { code: 'MISSING_FOLDER', folder: entry.path };
    }
    const error = checkCircuit(entry.circuit);
    if (error) {
      return error;
    }
  }
  const placed = entries as { path: string; circuit: CheckedCircuit }[];
  const defs = placed.map((e) => e.circuit);
  if (!defs.some((d) => d.id === MAIN_ID)) {
    return { code: 'NO_MAIN' };
  }
  // メイン回路が 2 つあるときも、ID の重なりとして断る
  const duplicate = findDuplicateId(defs);
  if (duplicate !== undefined) {
    return { code: 'DUPLICATE_ID', id: duplicate };
  }
  // 同じフォルダの中で名前が重なるものを断る (大文字と小文字は区別する)。メイン回路は名前を持たないので比べない
  const names = new Map<string, Set<string>>();
  for (const { path, circuit } of placed) {
    if (circuit.id === MAIN_ID) {
      continue;
    }
    const inFolder = names.get(path) ?? new Set<string>();
    const name = circuit.name ?? '';
    if (inFolder.has(name)) {
      return { code: 'DUPLICATE_NAME', name, folder: path };
    }
    inFolder.add(name);
    names.set(path, inFolder);
  }
  return undefined;
}
