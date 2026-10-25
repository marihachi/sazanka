// 回路ファイルの書き出しと読み込み。形の検証は project.ts の checkCircuitsFile を使う

import {
  type CircuitDef,
  checkCircuitsFile,
  type Project,
  type ProjectError,
  withoutSwitchStates,
} from '../circuit/project';
import { isObject } from '../util';
import { dateStamp } from './localFile';
import { fromStoredCircuit, type StoredCircuit, toStoredCircuit } from './storage';
import { CIRCUIT_FORMAT_VERSION, CIRCUITS_FILE_FORMAT_VERSION, upgradeCircuit } from './upgrade';

/** 回路ファイルの形。中の回路は、回路の形式のデータそのもの (プロジェクトの中の回路と同じ形)。フォルダは持たない */
export interface StoredCircuits {
  format: 'sazanka-circuits';
  version: number;
  circuits: StoredCircuit[];
}

/**
 * プロジェクトの回路のうち、ID が ids にあるものを回路ファイルにする。並びはプロジェクトの並びの順。
 * 依存する回路を含めるかは、呼ぶ側が ids で決める (project/exchange.ts の withDependencies)。
 * モジュールの部品には、指す回路の名前と大きさの写しを書く (持ち込み先に指す回路がなければ、見つからないモジュールとして描くため)
 */
export function serializeCircuits(project: Project, ids: Iterable<string>): string {
  const target = withoutSwitchStates(project);
  const chosen = new Set(ids);
  const data: StoredCircuits = {
    format: 'sazanka-circuits',
    version: CIRCUITS_FILE_FORMAT_VERSION,
    circuits: target.circuits
      .filter((d) => chosen.has(d.id))
      .map((d) => toStoredCircuit(d, target)),
  };
  return JSON.stringify(data);
}

/**
 * 回路ファイルを読み込めなかった理由。BROKEN の detail は、検証で見つかった問題。
 * PROJECT_FILE はプロジェクトファイル (一体の形式のものを含む) を、SINGLE_CIRCUIT は回路の形式だけのデータを選んだ
 */
export type CircuitsFileError =
  | { code: 'NOT_JSON' }
  | { code: 'NOT_SAZANKA' }
  | { code: 'NEWER_VERSION' }
  | { code: 'PROJECT_FILE' }
  | { code: 'SINGLE_CIRCUIT' }
  | { code: 'BROKEN'; detail: ProjectError };

export type CircuitsParseResult =
  | { ok: true; circuits: CircuitDef[] }
  | { ok: false; error: CircuitsFileError };

/**
 * 回路ファイルを読み込む。回路の ID は付け直さない。フォルダは持たないので、どの回路もフォルダなし (path は空文字)。
 * モジュールの部品は、どれも名前と大きさの写しを残す (指す回路があるかは、持ち込み先が決まってから分かる。
 * 持ち込むとき (project/exchange.ts の importCircuits) に、指す回路がある部品の写しを捨てる)。
 * 他人から受け取った文字列なので、形が正しいかをひととおり確かめ、問題があれば理由を返す
 */
export function parseCircuits(text: string, newId: () => string): CircuitsParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: { code: 'NOT_JSON' } };
  }
  if (!isObject(data)) {
    return { ok: false, error: { code: 'NOT_SAZANKA' } };
  }
  // 一体の形式のプロジェクトファイルは、format がなく、いちばん外に version と project を持つ
  if (
    data.format === 'sazanka-project' ||
    (data.format === undefined && 'version' in data && 'project' in data)
  ) {
    return { ok: false, error: { code: 'PROJECT_FILE' } };
  }
  if (data.format === 'sazanka-circuit') {
    return { ok: false, error: { code: 'SINGLE_CIRCUIT' } };
  }
  if (data.format !== 'sazanka-circuits') {
    return { ok: false, error: { code: 'NOT_SAZANKA' } };
  }
  if (isNewer(data)) {
    return { ok: false, error: { code: 'NEWER_VERSION' } };
  }
  if (Array.isArray(data.circuits)) {
    data = { ...data, circuits: data.circuits.map(upgradeCircuit) };
  }
  const error = checkCircuitsFile(data);
  if (error) {
    return { ok: false, error: { code: 'BROKEN', detail: error } };
  }
  const circuits = (data as unknown as StoredCircuits).circuits.map((c) =>
    fromStoredCircuit(c, '', () => true, newId),
  );
  // 古いデータには ON/OFF が入っていることがあるが、使わない (プロジェクトファイルと同じ)
  return { ok: true, circuits: withoutSwitchStates({ circuits }).circuits };
}

/**
 * 回路ファイルか、その中の回路に、今より新しい版のものがあるか。
 * 版が数でないものは新しいとはみなさない (検証で断る)
 */
function isNewer(data: Record<string, unknown>): boolean {
  if (typeof data.version === 'number' && data.version > CIRCUITS_FILE_FORMAT_VERSION) {
    return true;
  }
  if (!Array.isArray(data.circuits)) {
    return false;
  }
  return data.circuits.some(
    (c) => isObject(c) && typeof c.version === 'number' && c.version > CIRCUIT_FORMAT_VERSION,
  );
}

/**
 * 書き出す回路ファイルの名前。回路が 1 つならその名前 (例: 全加算器.sazanka.json)、
 * 2 つ以上なら日付の名前 (例: circuits-2026-10-23.sazanka.json。日付は端末の時刻) (開発者が決めた)。
 * ファイル名に使えない文字 (Windows で使えないもの、制御文字) は「_」にする。名前が使えなければ日付の名前にする
 */
export function getCircuitsFileName(circuits: readonly CircuitDef[], date: Date): string {
  if (circuits.length === 1) {
    const name = circuits[0].name
      // biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字をファイル名から除くため
      .replace(/[/\\:*?"<>|\u0000-\u001f]/g, '_')
      .trim()
      // 末尾の点は Windows で消されるので外す
      .replace(/\.+$/, '');
    if (name !== '') {
      return `${name}.sazanka.json`;
    }
  }
  return `circuits-${dateStamp(date)}.sazanka.json`;
}
