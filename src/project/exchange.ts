// 回路ファイルとのやりとりの計算: 書き出すときに依存する回路をたどる、持ち込むときのぶつかりを見つけてプロジェクトに反映する
import { dependsOn, getPinout, type Pinout } from '../circuit/module';
import type { Part } from '../circuit/part';
import { type CircuitDef, findDef, MAIN_ID, type Project } from '../circuit/project';
import { uniqueName } from './folders';
import { samePinout } from './replace';

/**
 * 回路 ids と、それらが (入れ子も含めて) モジュールとして置いている回路の ID。並びはプロジェクトの並びの順。
 * メイン回路は含めない (ほかの回路に置けず、書き出せないため)。プロジェクトにない回路 (見つからないモジュール) はたどらない
 */
export function withDependencies(project: Project, ids: Iterable<string>): string[] {
  const found = new Set<string>();
  const visit = (id: string) => {
    if (found.has(id) || id === MAIN_ID) {
      return;
    }
    const def = findDef(project, id);
    if (!def) {
      return;
    }
    found.add(id);
    for (const c of def.parts) {
      if (c.kind === 'module' && c.circuitId !== undefined) {
        visit(c.circuitId);
      }
    }
  };
  for (const id of ids) {
    visit(id);
  }
  return project.circuits.filter((d) => found.has(d.id)).map((d) => d.id);
}

/**
 * 持ち込む回路ごとの扱い。add はプロジェクトに足す (読み込み先のフォルダに同じ名前があれば名前を変える)、
 * replace は同じ ID の回路の中身を置き換える (フォルダと名前はそのまま)、skip は読み込まない
 */
export type ImportAction = 'add' | 'replace' | 'skip';

/** 読み込みのダイアログの「読み込む回路」の一覧の 1 行 */
export interface ImportRow {
  /** 回路ファイルの中の回路 */
  def: CircuitDef;
  /** プロジェクトにある、同じ ID の回路 (同じ回路の別の版)。なければ undefined */
  existing?: CircuitDef;
  /** 選べる扱い。同じ ID の回路があれば replace と skip、なければ add と skip */
  choices: ImportAction[];
  /** 選んでいる扱い */
  action: ImportAction;
  /** 足すと名前が変わるか (読み込み先のフォルダに同じ名前がある)。skip を選んでいても、足したときの名前で見る */
  nameTaken: boolean;
  /** 読み込んだあとのプロジェクトでの名前。skip なら undefined */
  projectName?: string;
  /** 置き換えると外側のピンが変わるか (置いている所の配線が外れたり、別のピンにつながったりする) */
  pinsChange: boolean;
  /**
   * 読み込まないと見つからないモジュールになるとき、その回路を使っている回路 (読み込むもの) の名前。
   * skip を選んでいて、プロジェクトにも同じ ID の回路がないときだけ。なければ空
   */
  missingUsers: string[];
  /** 読み込むと、モジュールの置き方が循環する (自分を中に含む) か。循環があるうちは読み込めない */
  cycle: boolean;
}

/** 扱いの既定。同じ ID の回路があれば置き換える (改版を持ち込むことが多いため。開発者が決めた)、なければ足す */
export function defaultImportActions(
  project: Project,
  defs: readonly CircuitDef[],
): Map<string, ImportAction> {
  return new Map(defs.map((d) => [d.id, findDef(project, d.id) ? 'replace' : 'add']));
}

/** 回路 def の扱い。actions にあっても、選べない扱い (同じ ID の回路がないのに replace など) なら既定にする */
function actionFor(
  def: CircuitDef,
  existing: CircuitDef | undefined,
  actions: ReadonlyMap<string, ImportAction>,
): ImportAction {
  const chosen = actions.get(def.id);
  return chosen !== undefined && choicesFor(existing).includes(chosen)
    ? chosen
    : existing
      ? 'replace'
      : 'add';
}

/** 選べる扱い。同じ ID の回路があれば replace と skip、なければ add と skip */
function choicesFor(existing: CircuitDef | undefined): ImportAction[] {
  return existing ? ['replace', 'skip'] : ['add', 'skip'];
}

/** 回路を置いたときの外側のピン */
function pinoutOf(def: CircuitDef): Pinout {
  return getPinout({ id: '', kind: 'module', x: 0, y: 0, circuitId: def.id }, { circuits: [def] });
}

/** 回路 user が、回路 id をモジュールとして直接置いているか */
function places(user: CircuitDef, id: string): boolean {
  return user.parts.some((c) => c.kind === 'module' && c.circuitId === id);
}

/**
 * 回路ファイルの回路 defs を、扱い actions (ID → 扱い。ないものは既定) でフォルダ folder に読み込むときの一覧。
 * 判定は、同じ ID を先に見る。同じ ID の回路があれば、名前やフォルダが違っても同じ回路として、置き換えるか読み込まないかを選ぶ。
 * 名前を見るのは、同じ ID の回路がないときだけ。足す回路の名前は、ファイルの並びの順に、フォルダの中で重ならないように決める
 */
export function planImport(
  project: Project,
  defs: readonly CircuitDef[],
  folder: string,
  actions: ReadonlyMap<string, ImportAction>,
): ImportRow[] {
  const taken = new Set(
    project.circuits.filter((d) => (d.path ?? '') === folder).map((d) => d.name),
  );
  const rows: ImportRow[] = defs.map((def) => {
    const existing = findDef(project, def.id);
    const choices = choicesFor(existing);
    const action = actionFor(def, existing, actions);
    const name = existing ? existing.name : uniqueName(taken, def.name);
    if (!existing && action === 'add') {
      taken.add(name);
    }
    return {
      def,
      existing,
      choices,
      action,
      nameTaken: !existing && name !== def.name,
      projectName: action === 'skip' ? undefined : name,
      pinsChange:
        existing !== undefined &&
        action === 'replace' &&
        !samePinout(pinoutOf(existing), pinoutOf(def)),
      missingUsers: [],
      cycle: false,
    };
  });
  const imported = rows.filter((r) => r.action !== 'skip');
  const result = importCircuits(project, defs, folder, actions);
  for (const row of rows) {
    if (row.action === 'skip' && !row.existing) {
      row.missingUsers = imported.filter((r) => places(r.def, row.def.id)).map((r) => r.def.name);
    }
    if (row.action !== 'skip') {
      row.cycle = dependsOn(result, row.def.id, row.def.id);
    }
  }
  return rows;
}

/** モジュールの部品のうち、指す回路がプロジェクトにあるものから、名前と大きさの写しを外す (回路から引くため) */
function dropResolvedCopies(project: Project): Project {
  const resolved = (c: Part) =>
    c.kind === 'module' &&
    (c.circuitName !== undefined || c.circuitSize !== undefined) &&
    findDef(project, c.circuitId) !== undefined;
  return {
    ...project,
    circuits: project.circuits.map((d) =>
      d.parts.some(resolved)
        ? {
            ...d,
            parts: d.parts.map((c) => {
              if (!resolved(c)) {
                return c;
              }
              const { circuitName: _, circuitSize: __, ...rest } = c;
              return rest;
            }),
          }
        : d,
    ),
  };
}

/**
 * 回路ファイルの回路 defs を、扱い actions でフォルダ folder に読み込んだプロジェクト (まとめて 1 回の編集にする)。
 * 足す回路は、プロジェクトの並びの末尾に、ファイルの並びの順で、フォルダ folder に入れる (名前は planImport のもの)。
 * 置き換える回路は、今の回路のフォルダと名前と並びの位置のまま、中身 (部品、配線、パッケージ、シート、作者名) だけを置き換える。
 * 回路の ID は付け直さない。読み込んだあと、指す回路があるモジュールの部品からは、名前と大きさの写しを外す
 * (今まで見つからなかったモジュールが、読み込んだ回路で見つかることもある)。folder はプロジェクトにあるものを渡す
 */
export function importCircuits(
  project: Project,
  defs: readonly CircuitDef[],
  folder: string,
  actions: ReadonlyMap<string, ImportAction>,
): Project {
  const taken = new Set(
    project.circuits.filter((d) => (d.path ?? '') === folder).map((d) => d.name),
  );
  const replaced = new Map<string, CircuitDef>();
  const added: CircuitDef[] = [];
  for (const def of defs) {
    const existing = findDef(project, def.id);
    const action = actionFor(def, existing, actions);
    if (existing && action === 'replace') {
      replaced.set(def.id, { ...def, name: existing.name, path: existing.path });
    } else if (!existing && action === 'add') {
      const name = uniqueName(taken, def.name);
      taken.add(name);
      added.push({ ...def, name, path: folder });
    }
  }
  return dropResolvedCopies({
    ...project,
    circuits: [...project.circuits.map((d) => replaced.get(d.id) ?? d), ...added],
  });
}
