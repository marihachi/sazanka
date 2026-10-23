// プロジェクトパネルの木: フォルダと回路を、木の形に組み立てる計算
import { type CircuitDef, MAIN_ID, type Project } from '../circuit/project';

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

/** パス parent の中のフォルダ name のパス。parent が空ならいちばん上 */
export function joinPath(parent: string, name: string): string {
  return parent === '' ? name : `${parent}/${name}`;
}

/** path が folder そのものか、その中 (入れ子を含む) にあるか */
export function isInside(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}

/** フォルダの名前として使えない理由。空は 'EMPTY'、`/` を含むか `.` / `..` は 'BAD'、同じフォルダの中に同じ名前があれば 'TAKEN' */
export function checkFolderName(
  project: Project,
  parent: string,
  name: string,
  exceptPath?: string,
): 'EMPTY' | 'BAD' | 'TAKEN' | undefined {
  if (!name) {
    return 'EMPTY';
  }
  if (name.includes('/') || name === '.' || name === '..') {
    return 'BAD';
  }
  const path = joinPath(parent, name);
  return (project.folders ?? []).some((f) => f === path && f !== exceptPath) ? 'TAKEN' : undefined;
}

/** フォルダ parent の中に、空のフォルダ name を足したプロジェクト。同じ親の中では末尾に並べる */
export function addFolder(project: Project, parent: string, name: string): Project {
  const folders = project.folders ?? [];
  const path = joinPath(parent, name);
  // 同じ親のフォルダの並びの末尾 (親の子孫の最後のフォルダのあと) に入れる
  const last = folders.reduce(
    (at, f, i) => (parent === '' || isInside(f, parent) ? i : at),
    parent === '' ? folders.length - 1 : folders.indexOf(parent),
  );
  return { ...project, folders: [...folders.slice(0, last + 1), path, ...folders.slice(last + 1)] };
}

/**
 * フォルダ path の名前を name にしたプロジェクト。中の入れ子のフォルダと回路のパスもまとめて変える
 */
export function renameFolder(project: Project, path: string, name: string): Project {
  const next = joinPath(parentOf(path), name);
  const move = (p: string) => (isInside(p, path) ? next + p.slice(path.length) : p);
  return {
    ...project,
    folders: (project.folders ?? []).map(move),
    circuits: project.circuits.map((d) => {
      const p = d.path ?? '';
      return p !== '' && isInside(p, path) ? { ...d, path: move(p) } : d;
    }),
  };
}

/** フォルダ path が空か (入れ子のフォルダも回路もない)。空のフォルダだけ削除できる */
export function isEmptyFolder(project: Project, path: string): boolean {
  return (
    !(project.folders ?? []).some((f) => f !== path && isInside(f, path)) &&
    !project.circuits.some((d) => isInside(d.path ?? '', path))
  );
}

/** 空のフォルダ path を消したプロジェクト */
export function removeFolder(project: Project, path: string): Project {
  return { ...project, folders: (project.folders ?? []).filter((f) => f !== path) };
}

/**
 * フォルダ folder の中で、ほかの回路 (exceptId を除く) と重ならない名前。
 * 重なれば ` (2)`、` (3)` などを付ける (追加・フォルダの移動・持ち込みで使う。改名では断る)
 */
export function uniqueCircuitName(
  project: Project,
  folder: string,
  name: string,
  exceptId?: string,
): string {
  const taken = new Set(
    project.circuits
      .filter((d) => d.id !== exceptId && (d.path ?? '') === folder)
      .map((d) => d.name),
  );
  return uniqueName(taken, name);
}

/** taken に重ならない名前。重なれば「 (2)」「 (3)」…を付ける */
export function uniqueName(taken: ReadonlySet<string>, name: string): string {
  if (!taken.has(name)) {
    return name;
  }
  let n = 2;
  while (taken.has(`${name} (${n})`)) {
    n++;
  }
  return `${name} (${n})`;
}

/**
 * 回路 id を、フォルダ folder の中の、同じフォルダの回路の並びで index 番目 (省略すると末尾) に移したプロジェクト。
 * 回路の並び (プロジェクトの要素の並び) の中で、移した先のフォルダの回路の位置に入れる。
 * 移した先に同じ名前の回路があれば ` (2)` などを付ける (メイン回路は名前を持たないので付けない)
 */
export function moveCircuitTo(
  project: Project,
  id: string,
  folder: string,
  index?: number,
): Project {
  const moving = project.circuits.find((d) => d.id === id);
  if (!moving) {
    return project;
  }
  const rest = project.circuits.filter((d) => d.id !== id);
  const siblings = rest.filter((d) => (d.path ?? '') === folder);
  const at = Math.min(Math.max(index ?? siblings.length, 0), siblings.length);
  const name =
    moving.id === MAIN_ID || (moving.path ?? '') === folder
      ? moving.name
      : uniqueCircuitName(project, folder, moving.name, id);
  const moved: CircuitDef = { ...moving, path: folder, name };
  // 同じフォルダの at 番目の回路の前に入れる。末尾なら、同じフォルダの最後の回路のあと (なければ並びの末尾)
  const before = siblings[at];
  const pos = before
    ? rest.indexOf(before)
    : siblings.length > 0
      ? rest.indexOf(siblings[siblings.length - 1]) + 1
      : rest.length;
  return { ...project, circuits: [...rest.slice(0, pos), moved, ...rest.slice(pos)] };
}

/**
 * フォルダ path (中身ごと) を、フォルダ parent の中の、同じ親のフォルダの並びで index 番目 (省略すると末尾) に移したプロジェクト。
 * 親が変われば、中の入れ子のフォルダと回路のパスも変える。移した先に同じ名前のフォルダがあれば、移さない (undefined)。
 * 自分自身や自分の中へは移せない (undefined)
 */
export function moveFolderTo(
  project: Project,
  path: string,
  parent: string,
  index?: number,
): Project | undefined {
  if (isInside(parent, path)) {
    return undefined;
  }
  const name = folderName(path);
  const next = joinPath(parent, name);
  if (next !== path && (project.folders ?? []).includes(next)) {
    return undefined;
  }
  const folders = project.folders ?? [];
  // 移すフォルダとその子孫 (並びの順を保つ)
  const subtree = folders.filter((f) => isInside(f, path));
  const rest = folders.filter((f) => !isInside(f, path));
  const siblings = rest.filter((f) => parentOf(f) === parent);
  const at = Math.min(Math.max(index ?? siblings.length, 0), siblings.length);
  const move = (p: string) => (isInside(p, path) ? next + p.slice(path.length) : p);
  const before = siblings[at];
  // 同じ親の at 番目のフォルダの前に入れる。末尾なら、親の子孫の最後のフォルダのあと
  const pos = before
    ? rest.indexOf(before)
    : rest.reduce(
        (last, f, i) => (parent === '' || isInside(f, parent) ? i + 1 : last),
        parent === '' ? rest.length : rest.indexOf(parent) + 1,
      );
  return {
    ...project,
    folders: [...rest.slice(0, pos), ...subtree.map(move), ...rest.slice(pos)],
    circuits:
      next === path
        ? project.circuits
        : project.circuits.map((d) => {
            const p = d.path ?? '';
            return p !== '' && isInside(p, path) ? { ...d, path: move(p) } : d;
          }),
  };
}

/** ドラッグで落とす先。回路はフォルダ folder の中の index 番目へ、フォルダは親 parent の中の index 番目へ (index がなければ末尾) */
export type DropTarget =
  | { kind: 'circuit'; folder: string; index?: number }
  | { kind: 'folder'; parent: string; index?: number };

/**
 * パネルの行のドラッグで、行 over (rows の番号) の zone に落としたときの落とす先。落とせなければ undefined。
 * - into: フォルダの行の上。そのフォルダの中の末尾へ (フォルダはフォルダの中へ)。
 * - before / after: 行と行の間。回路は回路どうし、フォルダはフォルダどうしの間に並べる (フォルダの中は、子のフォルダが先、回路があと)。
 *   開いているフォルダの行のすぐ下は、そのフォルダの中の先頭。
 * 自分自身と、フォルダを自分の中へは落とせない。
 * over が rows.length (いちばん下の行より下の、何もない所) なら、いちばん上の階層 (フォルダなし) の末尾へ
 */
export function dropTarget(
  project: Project,
  rows: readonly TreeRow[],
  dragged: TreeRow,
  over: number,
  zone: 'before' | 'into' | 'after',
): DropTarget | undefined {
  const isFolder = dragged.kind === 'folder';
  if (over === rows.length) {
    return isFolder ? { kind: 'folder', parent: '' } : { kind: 'circuit', folder: '' };
  }
  const target = rows[over];
  if (!target) {
    return undefined;
  }
  const draggedPath = dragged.kind === 'folder' ? dragged.path : undefined;
  // フォルダを、自分自身か自分の中へは動かせない
  const insideDragged = (path: string) => draggedPath !== undefined && isInside(path, draggedPath);
  // 回路の、同じフォルダの中での番号 (動かす回路は数えない)
  const circuitIndex = (row: TreeRow & { kind: 'circuit' }) =>
    project.circuits
      .filter((d) => d !== (dragged.kind === 'circuit' ? dragged.def : undefined))
      .filter((d) => (d.path ?? '') === (row.def.path ?? ''))
      .indexOf(row.def);
  // フォルダの、同じ親の中での番号 (動かすフォルダは数えない)
  const folderIndex = (path: string) =>
    (project.folders ?? [])
      .filter((f) => f !== draggedPath && parentOf(f) === parentOf(path))
      .indexOf(path);

  if (zone === 'into') {
    if (target.kind !== 'folder' || insideDragged(target.path)) {
      return undefined;
    }
    return isFolder
      ? { kind: 'folder', parent: target.path }
      : { kind: 'circuit', folder: target.path };
  }
  // 行の上半分 (before) か下半分 (after)。ポインターの載っている行で決める (行と行の間だけでは、深さの違う行のどちらの
  // フォルダに入れるかが決まらないため)
  const next = rows[over + 1];
  // 開いていて中のあるフォルダの行の下半分は、そのフォルダの中の先頭
  const intoOpen =
    target.kind === 'folder' && zone === 'after' && next !== undefined && next.depth > target.depth;
  if (target.kind === 'folder') {
    if (insideDragged(target.path)) {
      return undefined;
    }
    if (intoOpen) {
      return isFolder
        ? { kind: 'folder', parent: target.path, index: 0 }
        : { kind: 'circuit', folder: target.path, index: 0 };
    }
    // 回路は、フォルダの行の前後には並べられない (フォルダの中は、子のフォルダが先、回路があと)。
    // そのフォルダと同じ階層の回路の先頭へ入れる (フォルダの外へ出せるように。いちばん上の階層に回路がないときも)
    if (!isFolder) {
      return { kind: 'circuit', folder: parentOf(target.path), index: 0 };
    }
    const index = folderIndex(target.path);
    return {
      kind: 'folder',
      parent: parentOf(target.path),
      index: zone === 'before' ? index : index + 1,
    };
  }
  // 回路の行の前後。フォルダは回路の間には並べられない。動かす回路そのものの前後なら、動かさない
  if (isFolder || (dragged.kind === 'circuit' && dragged.def === target.def)) {
    return undefined;
  }
  const index = circuitIndex(target);
  return {
    kind: 'circuit',
    folder: target.def.path ?? '',
    index: zone === 'before' ? index : index + 1,
  };
}
