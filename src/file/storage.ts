import {
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
import { isObject } from '../util';
import { isLanguageSetting } from '../i18n/language';
import { fillPortNumbers } from '../circuit/module';
import { upgradeProject } from './upgrade';

const STORAGE_KEY = 'sazanka.project';

/** 保存データの形式の版。形式を変えたら上げて、古い版を変える処理を upgrade.ts に足す */
const STORAGE_VERSION = 3;

interface StoredData {
  version: number;
  project: Project;
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
    return readStored(localStorage.getItem(STORAGE_KEY));
  } catch {
    // localStorage を使えない環境では、保存データなしとして扱う
    return { project: emptyProject() };
  }
}

/** 保存されていた文字列を読み込む (localStorage に触らない部分) */
export function readStored(raw: string | null): LoadResult {
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
  const project = upgradeProject(data.project, data.version);
  if (checkProject(project) !== undefined) {
    return {
      project: emptyProject(),
      error: { code: 'BROKEN' },
    };
  }
  // 古いデータには ON/OFF が入っていることがあるが、使わない
  const loaded = withoutSwitchStates(project as Project);
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
    project: { ...unswitched, circuits: unswitched.circuits.map(withCircuitSheet) },
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
