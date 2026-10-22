// 一体の形式 version 4 の回路 1 つを、回路の形式 version 1 の形に変える。プロジェクト全体の変換 (project/v1.ts) から呼ぶ。
// 回路の形式 v1 では、形式の目印 (format) と版 (version)、作者名 (author) を持ち、メイン回路もパッケージを持つ。
// sheet、CLOCK の period、INPUT / OUTPUT の portNumber を省略できなくし、モジュールの部品が回路を指す項目を module から circuitId にして、
// 名前の写し circuitName を足した。split のピンの順は、中の位置の順からポート番号の順になった。
// 形式は docs/format/integrated/v4.md と docs/format/circuit/v1.md。
//
// 今のアプリのコード (部品の型や検証、ポート番号の付け方) には頼らない。今のコードが変わっても、この変換の結果が変わらないようにするため

import { isObject } from '../../../util';

/** メイン回路の ID。回路の形式 v1 でも変えない */
const MAIN_ID = 'main';

/** 一体の形式 v4 で、sheet を省略したときの大きさ */
const V4_DEFAULT_SHEET = { width: 300, height: 200 };

/** 一体の形式 v4 で、CLOCK の period を省略したときの周期 */
const V4_DEFAULT_PERIOD = 100;

/** 一体の形式 v4 の要素 (部品と配線) のうち、この変換で見るところ */
type Element = Record<string, unknown>;

/** INPUT / OUTPUT の種類 */
const PORT_KINDS = ['input', 'output'] as const;

/** 上から、同じ高さなら左から (一体の形式 v4 の split のピンの順)。位置が数でなければ並びを変えない */
function byPosition(a: Element, b: Element): number {
  const ay = Number(a.y);
  const by = Number(b.y);
  const ax = Number(a.x);
  const bx = Number(b.x);
  return ay - by || ax - bx || 0;
}

/** ポート番号として使える値か (1 以上の整数) */
function isPortNumber(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 1;
}

/**
 * ポート番号を整えた要素の一覧を返す (入力と出力で別々に)。
 * renumber なら、1 から位置の順に振り直す (split のモジュールとメイン回路)。
 * そうでなければ、一体の形式の読み込みと同じく、番号がないものと、位置の順で後ろの重なるものに、空いているいちばん小さい番号を付ける。
 * 番号が正しくない値 (0 や文字列など) のポートは、そのまま残す (検証で断る)
 */
function withPortNumbers(elements: unknown[], renumber: boolean): unknown[] {
  const numbers = new Map<Element, number>();
  for (const kind of PORT_KINDS) {
    const ports = elements
      .filter((e): e is Element => isObject(e) && e.kind === kind)
      .sort(byPosition);
    if (renumber) {
      for (const [i, e] of ports.entries()) {
        numbers.set(e, i + 1);
      }
      continue;
    }
    const used = new Set<number>();
    const missing: Element[] = [];
    for (const e of ports) {
      if (e.portNumber === undefined || (isPortNumber(e.portNumber) && used.has(e.portNumber))) {
        missing.push(e);
      } else if (isPortNumber(e.portNumber)) {
        used.add(e.portNumber);
      }
    }
    for (const e of missing) {
      let n = 1;
      while (used.has(n)) {
        n++;
      }
      used.add(n);
      numbers.set(e, n);
    }
  }
  return elements.map((e) => {
    const n = isObject(e) ? numbers.get(e) : undefined;
    return n === undefined ? e : { ...(e as Element), portNumber: n };
  });
}

/**
 * 部品 1 つの、ポート番号以外の項目を変える。module を circuitId に移して名前と大きさの写し (circuitName、circuitSize) を書き、
 * CLOCK の周期がなければ書き込む。circuitNames と circuitSizes は、回路の ID から、変換後の名前と本体の大きさへの対応
 */
function upgradeElement(
  e: Element,
  circuitNames: ReadonlyMap<string, string>,
  circuitSizes: ReadonlyMap<string, V1CircuitSize>,
): Element {
  if (e.kind === 'module') {
    const { module, ...rest } = e;
    return {
      ...rest,
      circuitId: module,
      // 指す先の回路がないモジュールは、写す名前と大きさがない。未解決のモジュールとして、空の名前と決まった大きさで読む
      circuitName: typeof module === 'string' ? (circuitNames.get(module) ?? '') : '',
      circuitSize:
        (typeof module === 'string' ? circuitSizes.get(module) : undefined) ?? UNRESOLVED_SIZE,
    };
  }
  if (e.kind === 'clock' && e.period === undefined) {
    return { ...e, period: V4_DEFAULT_PERIOD };
  }
  return e;
}

export interface CircuitV1Options {
  /** 回路の作者名 (一体の形式のプロジェクトの作者名) */
  author: unknown;
  /** 回路の名前。メイン回路では使わない (名前を持たない) */
  name: unknown;
  /** 回路の ID から、変換後の名前への対応。モジュールの部品の名前の写し (circuitName) に使う */
  circuitNames: ReadonlyMap<string, string>;
  /** 回路の ID から、モジュールとして置いたときの本体の大きさへの対応 (v4ModuleSize)。大きさの写し (circuitSize) に使う */
  circuitSizes: ReadonlyMap<string, V1CircuitSize>;
}

/** 本体の大きさ (マス) */
export interface V1CircuitSize {
  width: number;
  height: number;
}

/** 指す先の回路がないモジュールの部品に書く大きさ (アプリの、写しのない未解決のモジュールと同じ) */
const UNRESOLVED_SIZE: V1CircuitSize = { width: 6, height: 3 };

/**
 * 一体の形式 version 4 の回路を、モジュールとして置いたときの本体の大きさ (マス)。回路の形式 version 1 の配置の決まりで求める
 * (split は幅 4・高さは入力と出力の多い方の数 + 1、dip は幅 3・高さはピン数、qfp は 1 辺が (ピン数 / 4 - 1) × 2 + 4)。
 * 変換は、あとでアプリの配置が変わっても同じ結果になるよう、アプリの配置のコードを使わずにここで求める。
 * パッケージの形が正しくなければ undefined (検証で断る)
 */
export function v4ModuleSize(circuit: unknown): V1CircuitSize | undefined {
  if (!isObject(circuit) || !isObject(circuit.package)) {
    return undefined;
  }
  const { kind, pins } = circuit.package;
  if (kind === 'dip' && typeof pins === 'number') {
    return { width: 3, height: pins };
  }
  if (kind === 'qfp' && typeof pins === 'number') {
    const side = (pins / 4 - 1) * 2 + 4;
    return { width: side, height: side };
  }
  if (kind === 'split') {
    const elements = Array.isArray(circuit.elements) ? circuit.elements : [];
    const count = (k: string) => elements.filter((e) => isObject(e) && e.kind === k).length;
    return { width: 4, height: Math.max(count('input'), count('output'), 1) + 1 };
  }
  return undefined;
}

/**
 * 一体の形式 version 4 の回路 1 つを、回路の形式 version 1 にする。
 * 名前と作者名は、プロジェクト全体の変換が決めたもの (options) を書く。
 * 形の正しくないデータは、分かるところだけを変えて返す (検証で断る)
 */
export function upgradeToCircuitV1(circuit: unknown, options: CircuitV1Options): unknown {
  if (!isObject(circuit)) {
    return circuit;
  }
  const { id, name: _, package: pkg, sheet, elements, ...rest } = circuit;
  const isMain = id === MAIN_ID;
  // メイン回路は、一体の形式ではパッケージを持たない。今までと同じピンの順になる split にする
  const modulePackage = isMain ? { kind: 'split' } : pkg;
  const renumber = isMain || (isObject(pkg) && pkg.kind === 'split');
  return {
    format: 'sazanka-circuit',
    version: 1,
    ...rest,
    id,
    ...(isMain ? {} : { name: options.name }),
    author: options.author,
    package: modulePackage,
    sheet: sheet === undefined ? V4_DEFAULT_SHEET : sheet,
    elements: Array.isArray(elements)
      ? withPortNumbers(
          elements.map((e) =>
            isObject(e) ? upgradeElement(e, options.circuitNames, options.circuitSizes) : e,
          ),
          renumber,
        )
      : elements,
  };
}
