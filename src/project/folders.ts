// プロジェクトパネルの木: フォルダと回路を、木の形に組み立てる計算
import type { CircuitDef, Project } from '../circuit/project';

/** 木の 1 行 */
export type TreeRow =
  | {
      kind: 'folder';
      /** フォルダのパス (例: "lib/gates") */
      path: string;
      /** パスの最後の部分 (例: "gates") */
      name: string;
      /** 深さ (いちばん上が 0) */
      depth: number;
      /** 中に回路か子のフォルダがあるか */
      hasChildren: boolean;
    }
  | { kind: 'circuit'; def: CircuitDef; depth: number };

/** フォルダのパスの親 (最後の `/` より前)。いちばん上のフォルダなら空文字 */
export function parentOf(path: string): string {
  const at = path.lastIndexOf('/');
  return at < 0 ? '' : path.slice(0, at);
}

/** フォルダのパスの最後の部分 */
export function folderName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/**
 * プロジェクトパネルに並べる行。フォルダ parent の中を、子のフォルダを先に (folders の順)、そのあとに回路を (回路の並びの順)、
 * 深さ優先で並べる。折り畳んでいるフォルダ (collapsed) の中は並べない
 */
export function treeRows(project: Project, collapsed: ReadonlySet<string> = new Set()): TreeRow[] {
  const folders = project.folders ?? [];
  const rows: TreeRow[] = [];
  const walk = (parent: string, depth: number) => {
    for (const path of folders.filter((f) => parentOf(f) === parent)) {
      const hasChildren =
        folders.some((f) => parentOf(f) === path) ||
        project.circuits.some((d) => (d.path ?? '') === path);
      rows.push({ kind: 'folder', path, name: folderName(path), depth, hasChildren });
      if (!collapsed.has(path)) {
        walk(path, depth + 1);
      }
    }
    for (const def of project.circuits.filter((d) => (d.path ?? '') === parent)) {
      rows.push({ kind: 'circuit', def, depth });
    }
  };
  walk('', 0);
  return rows;
}

/**
 * 回路 id を置いている回路と、そこに置いている数 (プロジェクトパネルの「使われている所」)。回路の並びの順
 */
export function usagesOf(project: Project, id: string): { def: CircuitDef; count: number }[] {
  return project.circuits
    .map((def) => ({
      def,
      count: def.parts.filter((c) => c.kind === 'module' && c.circuitId === id).length,
    }))
    .filter((u) => u.count > 0);
}
