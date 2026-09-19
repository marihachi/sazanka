import { MAIN_ID, type CircuitDef, type Project } from './project';
import type { Component, Kind, PinRef, Wire } from './sim';

/** 共有用 JSON の形式の版。形式を変えたら上げて、古い版も読み込めるようにする */
const SHARE_VERSION = 1;

interface ShareData {
  /** sazanka の共有データであることの目印 */
  app: 'sazanka';
  version: number;
  /** 作者名。書き出すときに入力されなければ含めない */
  author?: string;
  project: Project;
}

/** 共有データに置ける部品の種類。BUF は展開用の内部の部品なので含めない */
const KINDS = new Set<Kind>([
  'AND',
  'OR',
  'NOT',
  'NAND',
  'NOR',
  'XOR',
  'RS',
  'DFF',
  'TFF',
  'JKFF',
  'INPUT',
  'CLOCK',
  'HIGH',
  'OUTPUT',
  'CUSTOM',
]);

/** プロジェクト全体を共有用の JSON にする */
export function serializeProject(project: Project, author = ''): string {
  const data: ShareData = {
    app: 'sazanka',
    version: SHARE_VERSION,
    ...(author.trim() && { author: author.trim() }),
    project: {
      circuits: project.circuits.map((d) =>
        renameIds(
          d,
          (i) => `part-${i + 1}`,
          (i) => `wire-${i + 1}`,
        ),
      ),
    },
  };
  return JSON.stringify(data);
}

/**
 * 回路の部品と配線の ID を、partId / wireId (引数は何番目か) で付け直し、配線の接続先も合わせる。
 * 書き出すときは、読みやすいよう回路ごとに part-1、wire-1 からの連番にする。
 * 読み込むときは、アプリ内の ID の付け方 (ランダム) にそろえる。
 * ID は回路の中でだけ一意であればよい。回路の ID はモジュールの参照に使うので変えない
 */
function renameIds(def: CircuitDef, partId: (index: number) => string, wireId: (index: number) => string): CircuitDef {
  const ids = new Map(def.components.map((c, i) => [c.id, partId(i)]));
  const ref = (p: PinRef): PinRef => ({ comp: ids.get(p.comp) ?? p.comp, pin: p.pin });
  return {
    ...def,
    components: def.components.map((c) => ({ ...c, id: ids.get(c.id)! })),
    wires: def.wires.map((w, i) => ({ id: wireId(i), from: ref(w.from), to: ref(w.to) })),
  };
}

export type ParseResult = { ok: true; project: Project; author?: string } | { ok: false; error: string };

/**
 * 共有用の JSON を読み込む。部品と配線の ID は newId で付け直す。
 * 他人から受け取った文字列なので、形が正しいかをひととおり確かめ、問題があれば理由を返す
 */
export function parseProject(text: string, newId: () => string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON として読み取れません' };
  }
  if (!isObject(data) || data.app !== 'sazanka') return { ok: false, error: 'sazanka の回路データではありません' };
  if (typeof data.version !== 'number' || data.version > SHARE_VERSION) {
    return { ok: false, error: '新しい版の sazanka で作られたデータのため読み込めません' };
  }
  if (data.author !== undefined && typeof data.author !== 'string') {
    return { ok: false, error: '回路データが壊れています (作者名が文字列ではありません)' };
  }
  const error = checkProject(data.project);
  if (error) return { ok: false, error: `回路データが壊れています (${error})` };
  const { circuits } = data.project as Project;
  return {
    ok: true,
    project: { circuits: circuits.map((d) => renameIds(d, newId, newId)) },
    ...(typeof data.author === 'string' && data.author && { author: data.author }),
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * プロジェクトとして正しい形かを確かめ、問題があればその内容を返す。
 * 共有された JSON のほか、localStorage の保存データを読み込むときにも使う
 */
export function checkProject(project: unknown): string | undefined {
  if (!isObject(project) || !Array.isArray(project.circuits)) return '回路の一覧がありません';
  const circuits = project.circuits as unknown[];
  if (!isObject(circuits[0]) || circuits[0].id !== MAIN_ID) return 'メイン回路がありません';
  const ids = new Set<string>();
  for (const def of circuits) {
    const error = checkCircuit(def);
    if (error) return error;
    const { id } = def as CircuitDef;
    if (ids.has(id)) return `回路の ID が重複しています: ${id}`;
    ids.add(id);
  }
  for (const def of circuits as CircuitDef[]) {
    for (const c of def.components) {
      if (c.kind === 'CUSTOM' && !ids.has(c.custom ?? ''))
        return `「${def.name}」が存在しないモジュールを参照しています`;
    }
  }
  return undefined;
}

function checkCircuit(def: unknown): string | undefined {
  if (!isObject(def) || typeof def.id !== 'string' || typeof def.name !== 'string')
    return '回路の ID か名前がありません';
  if (!Array.isArray(def.components) || !Array.isArray(def.wires)) return `「${def.name}」の部品か配線がありません`;
  const compIds = new Set<string>();
  for (const c of def.components as unknown[]) {
    if (!isComponent(c)) return `「${def.name}」に不正な部品があります`;
    if (compIds.has(c.id)) return `「${def.name}」で部品の ID が重複しています: ${c.id}`;
    compIds.add(c.id);
  }
  for (const w of def.wires as unknown[]) {
    if (!isWire(w) || !compIds.has(w.from.comp) || !compIds.has(w.to.comp)) {
      return `「${def.name}」に不正な配線があります`;
    }
  }
  return undefined;
}

function isComponent(c: unknown): c is Component {
  return (
    isObject(c) &&
    typeof c.id === 'string' &&
    KINDS.has(c.kind as Kind) &&
    typeof c.x === 'number' &&
    typeof c.y === 'number'
  );
}

function isPinRef(p: unknown): p is Wire['from'] {
  return isObject(p) && typeof p.comp === 'string' && Number.isInteger(p.pin) && (p.pin as number) >= 0;
}

function isWire(w: unknown): w is Wire {
  return isObject(w) && typeof w.id === 'string' && isPinRef(w.from) && isPinRef(w.to);
}
