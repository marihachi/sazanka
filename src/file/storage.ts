import {
  type CircuitDef,
  checkProject,
  emptyProject,
  withCircuitSheet,
  withoutSwitchStates,
  type Project,
} from '../circuit/project';
import {
  DEFAULT_PREFERENCES,
  isAccent,
  isTicksPerSecond,
  type Preferences,
} from '../preferences/preferences';
import { isView, type View } from '../geometry/view';
import { GRID, type Point } from '../geometry/layout';
import { isObject } from '../util';
import { isLanguageSetting } from '../i18n/language';
import { fillPortNumbers } from '../circuit/module';
import { newId } from '../circuit/circuit';
import { upgradeProject } from './upgrade';

const STORAGE_KEY = 'sazanka.project';

/** 保存データの形式の版。形式を変えたら上げて、古い版を変える処理を upgrade.ts に足す */
const STORAGE_VERSION = 4;

interface StoredData {
  version: number;
  project: StoredProject;
}

/**
 * 保存データと共有用 JSON の中の配線。アプリの中の配線 (Wire) とは違い、ID を持たず、種類 (kind) を持つ。
 * 配線の ID はどこからも参照されないので保存せず、読み込むたびに付ける。種類は今は普通の配線 (wire) だけ
 */
export interface StoredWire {
  kind: 'wire';
  points: Point[];
}

/**
 * 保存データと共有用 JSON の中のプロジェクトの形。アプリの中の形 (Project) とは、次のところが違う。
 * - 部品の位置と配線の点がマス単位 (アプリの中は px)。
 * - メイン回路は名前を持たない (アプリの中は空文字)。
 * - 配線は ID を持たず、種類を持つ (StoredWire)。
 */
export interface StoredProject {
  author?: string;
  circuits: (Omit<CircuitDef, 'name' | 'wires'> & { name?: string; wires: StoredWire[] })[];
}

/** 座標を持つもの (部品と配線の点) の x と y に scale を掛ける (px → マスは 1 / GRID、マス → px は GRID) */
function scalePoint<T extends Point>(p: T, scale: number): T {
  return { ...p, x: p.x * scale, y: p.y * scale };
}

/**
 * アプリの中のプロジェクトを、保存データと共有用 JSON の形にする。
 * 位置を px からマスに直し、メイン回路の名前と配線の ID を外し、配線に種類を書く。
 * アプリで置いた部品と引いた配線は GRID の倍数なので、割り切れる
 */
export function toStoredProject(project: Project): StoredProject {
  return {
    ...project,
    circuits: project.circuits.map(({ name, parts, wires, ...def }, i) => ({
      ...def,
      ...(i > 0 ? { name } : {}),
      parts: parts.map((c) => scalePoint(c, 1 / GRID)),
      wires: wires.map((w) => ({
        kind: 'wire',
        points: w.points.map((p) => scalePoint(p, 1 / GRID)),
      })),
    })),
  };
}

/**
 * 保存データと共有用 JSON の形のプロジェクトを、アプリの中の形にする。位置をマスから px に直す。
 * メイン回路の名前は、あっても捨てて空文字にする (画面に出す名前は表示言語の文言から引く)。
 * 配線には newId で新しい ID を付ける。データに ID があっても使わない
 */
export function fromStoredProject(project: StoredProject, newId: () => string): Project {
  return {
    ...project,
    circuits: project.circuits.map(({ name, parts, wires, ...def }, i) => ({
      ...def,
      name: i > 0 ? (name ?? '') : '',
      parts: parts.map((c) => scalePoint(c, GRID)),
      wires: wires.map((w) => ({ id: newId(), points: w.points.map((p) => scalePoint(p, GRID)) })),
    })),
  };
}

/** 保存データを読み込めなかった理由。BROKEN は形が壊れている、NEWER_VERSION は今より新しい版で保存された */
export type StoredError = { code: 'BROKEN' } | { code: 'NEWER_VERSION' };

export interface LoadResult {
  project: Project;
  /** 保存データを読み込めなかったときの理由。利用者に知らせる (文にするのは画面の側) */
  error?: StoredError;
}

/**
 * 保存したプロジェクトを読み込む。保存データがなければ空のプロジェクト。
 * 読み込めなければ空のプロジェクトで始め、理由を返す。
 * 壊れたデータをそのまま使うと、表示や計算の途中で例外が起きて画面が出なくなるため
 */
export function loadProject(): LoadResult {
  try {
    return readStored(localStorage.getItem(STORAGE_KEY), newId);
  } catch {
    // localStorage を使えない環境では、保存データなしとして扱う
    return { project: emptyProject() };
  }
}

/**
 * 保存されていた文字列を読み込む (localStorage に触らない部分)。
 * newId は、古い版の ID を付け直す変換 (upgradeV3) が使う
 */
export function readStored(raw: string | null, newId: () => string): LoadResult {
  if (!raw) {
    return { project: emptyProject() };
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {
      project: emptyProject(),
      error: { code: 'BROKEN' },
    };
  }
  if (!isObject(data) || typeof data.version !== 'number') {
    return {
      project: emptyProject(),
      error: { code: 'BROKEN' },
    };
  }
  if (data.version > STORAGE_VERSION) {
    return {
      project: emptyProject(),
      error: { code: 'NEWER_VERSION' },
    };
  }
  // 古い版は、今の版の形に変えてから確かめる
  const project = upgradeProject(data.project, data.version, newId);
  if (checkProject(project) !== undefined) {
    return {
      project: emptyProject(),
      error: { code: 'BROKEN' },
    };
  }
  // 古いデータには ON/OFF が入っていることがあるが、使わない
  const loaded = withoutSwitchStates(fromStoredProject(project as StoredProject, newId));
  // version 3 を公開する前の保存データには、ポート番号がない。シートの大きさを足す前のデータには、大きさがない
  return {
    project: {
      ...loaded,
      circuits: loaded.circuits.map((d) => withCircuitSheet(fillPortNumbers(d))),
    },
  };
}

export function saveProject(project: Project) {
  const unswitched = withoutSwitchStates(project);
  const data: StoredData = {
    version: STORAGE_VERSION,
    project: toStoredProject({
      ...unswitched,
      circuits: unswitched.circuits.map(withCircuitSheet),
    }),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 保存できない環境では無視
  }
}

const COLLAPSED_KEY = 'sazanka.paletteCollapsed';

/** パレットで折り畳んでいるグループの ID (Palette.tsx の GROUPS)。知らない ID は無視される */
export function loadCollapsedGroups(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function saveCollapsedGroups(ids: string[]) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(ids));
  } catch {
    // 保存できない環境では無視
  }
}

const VIEWS_KEY = 'sazanka.views';

/** 回路ごとの表示位置と倍率 (回路 ID → 表示)。読めないものは捨て、その回路は既定の表示で開く */
export function loadViews(): Record<string, View> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(VIEWS_KEY) ?? '{}');
    if (!isObject(value)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, View] => isView(entry[1])),
    );
  } catch {
    return {};
  }
}

export function saveViews(views: Record<string, View>) {
  try {
    localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  } catch {
    // 保存できない環境では無視
  }
}

const PREFERENCES_KEY = 'sazanka.preferences';

/** 利用者ごとの環境設定。読めない項目は既定値にする */
export function loadPreferences(): Preferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}');
    if (!isObject(value)) {
      return DEFAULT_PREFERENCES;
    }
    return {
      ticksPerSecond: readTicksPerSecond(value),
      showGrid: typeof value.showGrid === 'boolean' ? value.showGrid : DEFAULT_PREFERENCES.showGrid,
      roundWires:
        typeof value.roundWires === 'boolean' ? value.roundWires : DEFAULT_PREFERENCES.roundWires,
      accent: isAccent(value.accent) ? value.accent : DEFAULT_PREFERENCES.accent,
      language: isLanguageSetting(value.language) ? value.language : DEFAULT_PREFERENCES.language,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * 環境設定の 1 秒に進める tick 数。読めなければ既定値。
 * 古い版は、1 tick を進める間隔 (tickMs、1〜1000 の整数の ms) を保存していたので、1 秒あたりに直して読む
 */
export function readTicksPerSecond(value: Record<string, unknown>): number {
  if (isTicksPerSecond(value.ticksPerSecond)) {
    return value.ticksPerSecond;
  }
  const { tickMs } = value;
  if (typeof tickMs === 'number' && Number.isInteger(tickMs) && tickMs >= 1 && tickMs <= 1000) {
    // 1000 / 1〜1000 は 1〜1000 なので、丸めれば範囲に収まる (例: 3ms → 333)
    return Math.round(1000 / tickMs);
  }
  return DEFAULT_PREFERENCES.ticksPerSecond;
}

export function savePreferences(preferences: Preferences) {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // 保存できない環境では無視
  }
}
