import { emptyProject, type Project } from '../engine/project';
import type { Circuit } from '../engine/sim';

const STORAGE_KEY = 'sazanka.project';
/** 旧形式 (回路1つ) の保存キー */
const LEGACY_STORAGE_KEY = 'sazanka.circuit';

export function loadProject(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Project;
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const project = emptyProject();
      Object.assign(project.circuits[0], JSON.parse(legacy) as Circuit);
      return project;
    }
  } catch {
    // 読み込めなければ空のプロジェクトから始める
  }
  return emptyProject();
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
