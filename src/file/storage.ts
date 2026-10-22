import {
  type CircuitDef,
  type CircuitSheet,
  checkProject,
  emptyProject,
  findDef,
  getCircuitSheet,
  MAIN_ID,
  type Package,
  type Project,
  withoutSwitchStates,
} from '../circuit/project';
import {
  DEFAULT_PREFERENCES,
  isAccent,
  isTicksPerSecond,
  type Preferences,
} from '../preferences/preferences';
import { isView, type View } from '../geometry/view';
import { GRID, type Point } from '../geometry/layout';
import { DEFAULT_CLOCK_PERIOD, type Part, type PlaceablePartKind } from '../circuit/part';
import { isObject } from '../util';
import { isLanguageSetting } from '../i18n/language';
import { newId } from '../circuit/circuit';
import { CIRCUIT_FORMAT_VERSION, PROJECT_FORMAT_VERSION, upgradeStoredProject } from './upgrade';

const STORAGE_KEY = 'sazanka.project';

/**
 * 保存データとプロジェクトファイルの中の配線。アプリの中の配線 (Wire) とは違い、ID を持たず、種類 (kind) を持つ。
 * 種類は今は普通の配線 (wire) だけ
 */
export interface StoredWire {
  kind: 'wire';
  points: Point[];
}

/**
 * 保存データとプロジェクトファイルの中の部品。ID と ON/OFF を持たない。
 * モジュールの部品は、指す回路の名前の写し (circuitName) を持つ (保存するたびに今の名前を写す。読み込むときは使わない)
 */
export type StoredPart = Omit<Part, 'id' | 'on'> & { circuitName?: string };

/**
 * 回路に置いた要素 (部品と配線)。種類 (kind) で見分ける。配線の種類は wire、それ以外は部品の種類。
 * 部品か配線かという分け方は種類の性質として持ち、一覧は分けない (形式の文書の「要素」)
 */
export type StoredElement = StoredPart | StoredWire;

/** 保存データとプロジェクトファイルの中の回路 (回路の形式のデータ)。メイン回路は名前を持たない */
export interface StoredCircuit {
  format: 'sazanka-circuit';
  version: number;
  id: string;
  name?: string;
  author: string;
  package: Package;
  sheet: CircuitSheet;
  elements: StoredElement[];
}

/** プロジェクトの要素。回路を置くフォルダのパス (フォルダなしは空文字) と、回路のデータの組 */
export interface StoredProjectEntry {
  path: string;
  circuit: StoredCircuit;
}

/**
 * 保存データとプロジェクトファイルの形 (プロジェクトの形式のデータ)。アプリの中の形 (Project) とは、次のところが違う。
 * - 回路は、フォルダのパスと組にした要素の並び (circuits) に並べる (アプリの中は、回路に path を持たせた circuits)。
 * - 部品と配線を、1 つの一覧 (elements) に並べる (アプリの中は parts と wires に分ける)。
 * - 部品の位置と配線の点がマス単位 (アプリの中は px)。
 * - メイン回路は名前を持たない (アプリの中は空文字)。
 * - 部品と配線は ID を持たない。どこからも参照されないので保存せず、読み込むたびに付ける。保存する ID は回路の ID だけ。
 * - 配線は種類を持つ (StoredWire)。モジュールの部品は、指す回路の名前の写し (circuitName) を持つ。
 */
export interface StoredProject {
  format: 'sazanka-project';
  version: number;
  folders: string[];
  circuits: StoredProjectEntry[];
}

/**
 * 保存するときの要素の並び順 (種類 → 何番目か)。開発者が決めた順。
 * 読み込むときは並び順に意味を持たせないが、書くときはこの順にそろえて、データを読みやすくする。
 * どの種類も載せる (型で漏れを防ぐ)。種類を足したら、ここにも足す
 */
const ELEMENT_ORDER: Record<PlaceablePartKind | StoredWire['kind'], number> = {
  input: 0,
  output: 1,
  clock: 2,
  high: 3,
  and: 4,
  or: 5,
  not: 6,
  nand: 7,
  nor: 8,
  xor: 9,
  xnor: 10,
  rsLatch: 11,
  rsEnLatch: 12,
  dLatch: 13,
  dFlipFlop: 14,
  tFlipFlop: 15,
  jkFlipFlop: 16,
  sevenSegment: 17,
  module: 18,
  wire: 19,
};

/** 並び順の表にない種類 (アプリの中だけの BUF など。保存データには現れない) は最後に置く */
function elementOrderOf(kind: string): number {
  return (ELEMENT_ORDER as Record<string, number>)[kind] ?? Number.MAX_SAFE_INTEGER;
}

/** 要素が配線か (配線の種類は wire だけ) */
function isStoredWire(e: StoredElement): e is StoredWire {
  return e.kind === 'wire';
}

/** 座標を持つもの (部品と配線の点) の x と y に scale を掛ける (px → マスは 1 / GRID、マス → px は GRID) */
function scalePoint<T extends Point>(p: T, scale: number): T {
  return { ...p, x: p.x * scale, y: p.y * scale };
}

/**
 * アプリの中の回路 1 つを、保存データの形の回路にする。
 * 部品と配線を 1 つの一覧にまとめ (種類の順 ELEMENT_ORDER。同じ種類の中はアプリの中の順)、位置を px からマスに直し、
 * メイン回路の名前と部品と配線の ID を外し、配線に種類を書き、モジュールの部品に指す回路の今の名前を写す。
 * パッケージ、シートの大きさ、作者名を持たない回路 (テストで作ったものなど) には、split、DEFAULT_SHEET、空文字を書く。
 * 周期を持たない CLOCK には DEFAULT_CLOCK_PERIOD を書く。
 * アプリで置いた部品と引いた配線は GRID の倍数なので、割り切れる
 */
function toStoredCircuit(def: CircuitDef, project: Project): StoredCircuit {
  const { id, name, author, parts, wires } = def;
  const toStoredPart = ({ id: _, on: __, ...c }: Part): StoredElement => {
    const cells = scalePoint(c, 1 / GRID);
    if (c.kind === 'module') {
      return { ...cells, circuitName: findDef(project, c.circuitId)?.name ?? '' };
    }
    // 置いたばかりの CLOCK は周期を持たない (既定の周期で動く)。保存データでは省略できないので書く
    if (c.kind === 'clock' && c.period === undefined) {
      return { ...cells, period: DEFAULT_CLOCK_PERIOD };
    }
    return cells;
  };
  return {
    format: 'sazanka-circuit',
    version: CIRCUIT_FORMAT_VERSION,
    id,
    ...(id === MAIN_ID ? {} : { name }),
    author: author ?? '',
    package: def.package ?? { kind: 'split' },
    sheet: getCircuitSheet(def),
    // sort は安定なので、同じ種類の中はアプリの中の順のまま
    elements: [
      ...parts.map(toStoredPart),
      ...wires.map(
        (w): StoredElement => ({
          kind: 'wire',
          points: w.points.map((p) => scalePoint(p, 1 / GRID)),
        }),
      ),
    ].sort((a, b) => elementOrderOf(a.kind) - elementOrderOf(b.kind)),
  };
}

/**
 * アプリの中のプロジェクトを、保存データとプロジェクトファイルの形にする。
 * 回路の並びを、同じ並びのまま要素の並びにする (フォルダのパスを持たない回路はフォルダなし)
 */
export function toStoredProject(project: Project): StoredProject {
  return {
    format: 'sazanka-project',
    version: PROJECT_FORMAT_VERSION,
    folders: [...(project.folders ?? [])],
    circuits: project.circuits.map((def) => ({
      path: def.path ?? '',
      circuit: toStoredCircuit(def, project),
    })),
  };
}

/**
 * 保存データとプロジェクトファイルの形のプロジェクトを、アプリの中の形にする。
 * 要素の並びを、同じ並びのまま回路の並びにし、フォルダのパスを回路に持たせる。
 * 一覧の要素を種類で部品と配線に分け (それぞれの中の順は保つ)、位置をマスから px に直す。
 * メイン回路の名前は、あっても捨てて空文字にする (画面に出す名前は表示言語の文言から引く)。
 * 部品の名前の写し (circuitName) は使わない (指す回路の名前を引く)。
 * 部品と配線には newId で新しい ID を付ける (回路ごとに部品、配線の順)。データに ID があっても使わない
 */
export function fromStoredProject(project: StoredProject, newId: () => string): Project {
  return {
    folders: [...project.folders],
    circuits: project.circuits.map(({ path, circuit }) => {
      const { format: _, version: __, name, elements, ...def } = circuit;
      // データにある ID (id) は捨てて、新しい ID を付ける
      const parts = elements
        .filter((e): e is StoredPart => !isStoredWire(e))
        .map(({ id: _, circuitName: __, ...c }: StoredPart & { id?: unknown }) => ({
          id: newId(),
          ...scalePoint(c, GRID),
        }));
      const wires = elements.filter(isStoredWire).map((w) => ({
        id: newId(),
        points: w.points.map((p) => scalePoint(p, GRID)),
      }));
      return { ...def, name: def.id === MAIN_ID ? '' : (name ?? ''), path, parts, wires };
    }),
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
 * 一体の形式 (version 1〜4) で保存されたものも、読み込みの入口 (upgrade/index.ts) で新しい形式にしてから読む。
 * newId は、古い版の ID を付け直す変換 (upgradeV3) と、部品と配線の ID に使う
 */
export function readStored(raw: string | null, newId: () => string): LoadResult {
  if (!raw) {
    return { project: emptyProject() };
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { project: emptyProject(), error: { code: 'BROKEN' } };
  }
  const upgraded = upgradeStoredProject(data, newId);
  if (!upgraded.ok) {
    return {
      project: emptyProject(),
      error: { code: upgraded.error.code === 'NEWER_VERSION' ? 'NEWER_VERSION' : 'BROKEN' },
    };
  }
  if (checkProject(upgraded.project) !== undefined) {
    return { project: emptyProject(), error: { code: 'BROKEN' } };
  }
  // 古いデータには ON/OFF が入っていることがあるが、使わない
  return {
    project: withoutSwitchStates(fromStoredProject(upgraded.project as StoredProject, newId)),
  };
}

export function saveProject(project: Project) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(toStoredProject(withoutSwitchStates(project))),
    );
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

const PROBLEMS_PANEL_KEY = 'sazanka.problemsPanel';

/** 問題パネルを開いているかと、開いたときの高さ (px) */
export interface ProblemsPanelState {
  open: boolean;
  height: number;
}

export const DEFAULT_PROBLEMS_PANEL: ProblemsPanelState = { open: false, height: 140 };

/** 問題パネルの状態。保存がないか、形が違えば既定の状態 */
export function loadProblemsPanel(): ProblemsPanelState {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PROBLEMS_PANEL_KEY) ?? 'null');
    if (typeof value !== 'object' || value === null) {
      return DEFAULT_PROBLEMS_PANEL;
    }
    const { open, height } = value as Record<string, unknown>;
    return {
      open: typeof open === 'boolean' ? open : DEFAULT_PROBLEMS_PANEL.open,
      height:
        typeof height === 'number' && Number.isFinite(height) && height > 0
          ? height
          : DEFAULT_PROBLEMS_PANEL.height,
    };
  } catch {
    return DEFAULT_PROBLEMS_PANEL;
  }
}

export function saveProblemsPanel(state: ProblemsPanelState) {
  try {
    localStorage.setItem(PROBLEMS_PANEL_KEY, JSON.stringify(state));
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
