import { emptyProject, type Project } from '../engine/project';
import { checkProject } from '../engine/share';
import type { Circuit } from '../engine/sim';

const STORAGE_KEY = 'sazanka.project';
/** 旧形式 (回路1つ) の保存キー */
const LEGACY_STORAGE_KEY = 'sazanka.circuit';

export interface LoadResult {
  project: Project;
  /** 保存データはあったが、壊れていて読み込めなかった */
  broken: boolean;
}

/**
 * 保存したプロジェクトを読み込む。保存データがなければ空のプロジェクト。
 * 保存データが壊れていたら空のプロジェクトで始め、broken で知らせる。
 * 壊れたデータをそのまま使うと、表示や計算の途中で例外が起きて画面が出なくなるため
 */
export function loadProject(): LoadResult {
  let raw: string | null = null;
  let legacy: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    legacy = raw ? null : localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    // localStorage を使えない環境では、保存データなしとして扱う
  }
  if (!raw && !legacy) return { project: emptyProject(), broken: false };
  try {
    let project: unknown;
    if (raw) {
      project = JSON.parse(raw);
    } else {
      const p = emptyProject();
      Object.assign(p.circuits[0], JSON.parse(legacy!) as Circuit);
      project = p;
    }
    if (checkProject(project) === undefined) return { project: project as Project, broken: false };
  } catch {
    // JSON として読めない
  }
  return { project: emptyProject(), broken: true };
}

export function saveProject(project: Project) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // 保存できない環境では無視
  }
}

const AUTHOR_KEY = 'sazanka.author';

/** 前回書き出したときの作者名。次に書き出すときの初期値にする */
export function loadAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveAuthor(author: string) {
  try {
    localStorage.setItem(AUTHOR_KEY, author);
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
