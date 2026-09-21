import { checkProject, emptyProject, withoutSwitchStates, type Project } from '../engine/project';
import { isView, type View } from '../components/view';
import { isObject } from '../engine/util';

const STORAGE_KEY = 'sazanka.project';

/** 保存データの形式の版。形式を変えたら上げて、古い版を読み込む分岐を readStored に足す */
const STORAGE_VERSION = 1;

interface StoredData {
  version: number;
  project: Project;
}

export interface LoadResult {
  project: Project;
  /** 保存データを読み込めなかったときの理由。利用者に知らせる */
  error?: string;
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
  if (!raw) return { project: emptyProject() };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { project: emptyProject(), error: '保存データが壊れていたため読み込めませんでした。' };
  }
  if (!isObject(data) || typeof data.version !== 'number') {
    return { project: emptyProject(), error: '保存データが壊れていたため読み込めませんでした。' };
  }
  if (data.version > STORAGE_VERSION) {
    return { project: emptyProject(), error: '新しい版の sazanka で保存されたデータのため読み込めませんでした。' };
  }
  const { project } = data as unknown as StoredData;
  if (checkProject(project) !== undefined) {
    return { project: emptyProject(), error: '保存データが壊れていたため読み込めませんでした。' };
  }
  // 古いデータには ON/OFF が入っていることがあるが、使わない
  return { project: withoutSwitchStates(project as Project) };
}

export function saveProject(project: Project) {
  const data: StoredData = { version: STORAGE_VERSION, project: withoutSwitchStates(project) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 保存できない環境では無視
  }
}

const COLLAPSED_KEY = 'sazanka.paletteCollapsed';

/** パレットで折り畳んでいるグループの見出し */
export function loadCollapsedGroups(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function saveCollapsedGroups(titles: string[]) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(titles));
  } catch {
    // 保存できない環境では無視
  }
}

const VIEWS_KEY = 'sazanka.views';

/** 回路ごとの表示位置と倍率 (回路 ID → 表示)。読めないものは捨て、その回路は既定の表示で開く */
export function loadViews(): Record<string, View> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(VIEWS_KEY) ?? '{}');
    if (!isObject(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, View] => isView(entry[1])));
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
