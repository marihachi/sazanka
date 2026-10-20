// モジュール: 回路を部品として使うときのピンの決め方と、回路同士の依存。
// 展開 (シミュレーション用に1つの回路にする) は simulation/flatten.ts にある

import { inputPinNames, outputPinNames, type Part } from './part';
import type { Circuit } from './circuit';
import {
  findDef,
  MAIN_ID,
  MAX_PACKAGE_PINS,
  type CircuitDef,
  type Package,
  type Project,
} from './project';

/**
 * 部品のピンの割り当て (ピンの名前と、モジュールの外側のピン番号)。
 * シート上の配置 (parts/layouts.ts の getLayout) は、これとモジュールの形 (package) から決めるので、形も一緒に持たせる。
 * モジュールのピンと形は中身の回路で決まるので、プロジェクトを読める getPinout で作り、配置まで届ける
 */
export interface Pinout {
  /** 入力ピンの名前 (表示用。名前のないピンは空文字)。並び順が PinRef.pin の番号 */
  inputs: string[];
  /** 出力ピンの名前。並び順は inputs と同じ */
  outputs: string[];
  /** モジュールの形 (パッケージ)。配置を決めるために添える。モジュール以外の部品にはない */
  package?: Package;
  /**
   * 外側のピン番号 (1 から)。inputs / outputs と同じ並び。
   * パッケージが dip / qfp のモジュールだけが持つ
   */
  pinNumbers?: { inputs: number[]; outputs: number[] };
}

/** ピン番号で外側のピンを決める形か (dip / qfp)。split はポート番号の順で決める */
export function usesPinNumbers(
  pkg: Package | undefined,
): pkg is Extract<Package, { pins: number }> {
  return pkg?.kind === 'dip' || pkg?.kind === 'qfp';
}

function isPort(c: Part): boolean {
  return c.kind === 'input' || c.kind === 'output';
}

/**
 * 外側のピンに出せないポートの理由。
 * unassigned はピン番号がない、outOfRange はピン数の範囲の外、duplicate はほかのポートと同じ番号
 */
export type PortProblem = 'unassigned' | 'outOfRange' | 'duplicate';

/**
 * 外側のピンに出せないポート (部品 ID → 理由)。dip / qfp のモジュールだけが持ちうる。
 * 重なりは、どれを出すか決められないので、同じ番号のポートをすべて出さない
 */
export function findUnexposedPorts(def: Circuit & { package?: Package }): Map<string, PortProblem> {
  const problems = new Map<string, PortProblem>();
  const pkg = def.package;
  if (!usesPinNumbers(pkg)) {
    return problems;
  }
  const ports = def.parts.filter(isPort);
  const inRange = (n: number) => n >= 1 && n <= pkg.pins;
  // 番号ごとのポートの数。範囲の中の番号だけを数える
  const counts = new Map<number, number>();
  for (const c of ports) {
    if (c.pinNumber !== undefined && inRange(c.pinNumber)) {
      counts.set(c.pinNumber, (counts.get(c.pinNumber) ?? 0) + 1);
    }
  }
  for (const c of ports) {
    if (c.pinNumber === undefined) {
      problems.set(c.id, 'unassigned');
    } else if (!inRange(c.pinNumber)) {
      problems.set(c.id, 'outOfRange');
    } else if ((counts.get(c.pinNumber) ?? 0) > 1) {
      problems.set(c.id, 'duplicate');
    }
  }
  return problems;
}

/**
 * 外側のピンに出せないポートのうち、利用者に知らせるもの (警告と、ポートの印)。
 * メイン回路では知らせない。メイン回路のピンはどこにもつながらないので、割り当てていなくても困らないため (開発者が決めた)
 */
export function findUnexposedPortsToWarn(def: CircuitDef): Map<string, PortProblem> {
  return def.id === MAIN_ID ? new Map() : findUnexposedPorts(def);
}

/**
 * モジュールのピンになる INPUT / OUTPUT。この並びが PinRef.pin の番号になる。
 * split はポート番号の順 (入力は入力のポート番号の順、出力は出力のポート番号の順)。
 * dip / qfp はピン番号の順で、外側のピンに出せないポート (findUnexposedPorts) は除く
 */
export function getPortsInPinOrder(def: Circuit & { package?: Package }): {
  inputs: Part[];
  outputs: Part[];
} {
  if (usesPinNumbers(def.package)) {
    const problems = findUnexposedPorts(def);
    // 外に出すポートは番号が重ならないので、番号の順に並べれば決まる
    const exposed = def.parts
      .filter((c) => isPort(c) && !problems.has(c.id))
      .sort((a, b) => (a.pinNumber ?? 0) - (b.pinNumber ?? 0));
    return {
      inputs: exposed.filter((c) => c.kind === 'input'),
      outputs: exposed.filter((c) => c.kind === 'output'),
    };
  }

  // ポート番号の順がピンの順になる。読み込んだデータとアプリで置いたポートの番号は、入力どうし・出力どうしで重ならない
  return {
    inputs: def.parts.filter((c) => c.kind === 'input').sort(byPortNumber),
    outputs: def.parts.filter((c) => c.kind === 'output').sort(byPortNumber),
  };
}

/** 部品のピン名。モジュールは中の INPUT / OUTPUT のポート名、ほかは種類で決まる */
export function getPinout(c: Part, project: Project): Pinout {
  if (c.kind === 'module') {
    const def = findDef(project, c.circuitId);

    if (!def) {
      return { inputs: [], outputs: [], package: { kind: 'split' } };
    }

    const { inputs, outputs } = getPortsInPinOrder(def);
    const pkg = def.package ?? { kind: 'split' };
    const numberOf = (k: Part) => k.pinNumber ?? 0;

    return {
      inputs: inputs.map((k) => k.portName ?? ''),
      outputs: outputs.map((k) => k.portName ?? ''),
      package: pkg,
      ...(usesPinNumbers(pkg)
        ? { pinNumbers: { inputs: inputs.map(numberOf), outputs: outputs.map(numberOf) } }
        : {}),
    };
  }

  return {
    inputs: inputPinNames(c.kind),
    outputs: outputPinNames(c.kind),
  };
}

/**
 * 回路に新しく置いたポート (added に ID がある INPUT / OUTPUT) に、ピン番号を割り当てる。置く操作と貼り付けで使う。
 * dip / qfp のモジュールでは、番号がない・範囲の外・ほかと重なるものに、空いているいちばん小さい番号を入れる。
 * 空きがなければ番号を外す (割り当てなしとして知らせる)。
 * メイン回路と split のモジュールでは番号を使わないので外す (貼り付けで持ち込んだものも)
 */
export function assignPinNumbers<T extends Circuit & { package?: Package }>(
  def: T,
  added: ReadonlySet<string>,
): T {
  const pkg = def.package;
  const isAdded = (c: Part) => isPort(c) && added.has(c.id);
  if (!def.parts.some(isAdded)) {
    return def;
  }
  if (!usesPinNumbers(pkg)) {
    return { ...def, parts: def.parts.map((c) => (isAdded(c) ? withoutPinNumber(c) : c)) };
  }
  // 前からあるポートの番号は、範囲の中なら (重なっていても) 使用中とみなし、新しいポートには使わない
  const used = new Set(
    def.parts
      .filter((c) => isPort(c) && !added.has(c.id))
      .map((c) => c.pinNumber)
      .filter((n): n is number => n !== undefined && n >= 1 && n <= pkg.pins),
  );
  const parts = def.parts.map((c) => {
    if (!isAdded(c)) {
      return c;
    }
    const n = c.pinNumber;
    if (n !== undefined && n >= 1 && n <= pkg.pins && !used.has(n)) {
      used.add(n);
      return c;
    }
    let free = 1;
    while (used.has(free)) {
      free++;
    }
    if (free > pkg.pins) {
      return withoutPinNumber(c);
    }
    used.add(free);
    return { ...c, pinNumber: free };
  });
  return { ...def, parts };
}

function withoutPinNumber(c: Part): Part {
  const { pinNumber: _, ...rest } = c;
  return rest;
}

/** 上から、同じ高さなら左から。番号を振り直す順に使う (ピンの順はポート番号の順で、位置の順ではない) */
function byPosition(a: Part, b: Part): number {
  return a.y - b.y || a.x - b.x;
}

/**
 * ポート番号の順。番号のないポート (テストで作ったものなど) は最後にし、番号が同じか、どちらも番号がなければ位置の順にする
 * (読み込んだデータとアプリで置いたポートでは起きないが、並びが決まるように)
 */
function byPortNumber(a: Part, b: Part): number {
  return (
    (a.portNumber ?? Number.POSITIVE_INFINITY) - (b.portNumber ?? Number.POSITIVE_INFINITY) ||
    byPosition(a, b)
  );
}

/**
 * 回路に新しく置いたポート (added に ID がある INPUT / OUTPUT) に、ポート番号を付ける。置く操作と貼り付けで使う。
 * 入力と出力で別々に、前からあるポートと重ならなければ番号をそのまま使い、
 * ないか重なれば、空いているいちばん小さい番号を付ける。複数あるときは、中の位置の順に付ける
 */
export function assignPortNumbers<T extends Circuit>(def: T, added: ReadonlySet<string>): T {
  const isAdded = (c: Part) => isPort(c) && added.has(c.id);
  if (!def.parts.some(isAdded)) {
    return def;
  }
  const numbers = new Map<string, number>();
  for (const kind of ['input', 'output'] as const) {
    const used = new Set(
      def.parts
        .filter((c) => c.kind === kind && !added.has(c.id))
        .map((c) => c.portNumber)
        .filter((n) => n !== undefined),
    );
    const targets = def.parts.filter((c) => c.kind === kind && added.has(c.id)).sort(byPosition);
    for (const c of targets) {
      let n = c.portNumber;
      if (n === undefined || used.has(n)) {
        n = 1;
        while (used.has(n)) {
          n++;
        }
      }
      used.add(n);
      numbers.set(c.id, n);
    }
  }
  const parts = def.parts.map((c) => {
    const n = numbers.get(c.id);
    return n === undefined || c.portNumber === n ? c : { ...c, portNumber: n };
  });
  return { ...def, parts };
}

/** 回路 a が (間接的にでも) 回路 b をモジュールとして含むか */
export function dependsOn(
  project: Project,
  a: string,
  b: string,
  seen = new Set<string>(),
): boolean {
  // seen は調べ終えた回路。一度調べた回路は飛ばす。
  // 循環した参照で止まらなくなるのを防ぎ、同じ回路を何度も調べないため
  if (seen.has(a)) {
    return false;
  }

  seen.add(a);
  const def = findDef(project, a);

  if (!def) {
    return false;
  }

  return def.parts.some(
    (c) =>
      c.kind === 'module' &&
      c.circuitId !== undefined &&
      (c.circuitId === b || dependsOn(project, c.circuitId, b, seen)),
  );
}

/** モジュール id を部品として直接置いている回路 */
export function circuitsUsing(project: Project, id: string): CircuitDef[] {
  return project.circuits.filter((d) =>
    d.parts.some((c) => c.kind === 'module' && c.circuitId === id),
  );
}

// 回路設定 (modules/CircuitSettingsDialog.tsx) で使う計算

/**
 * ポートを、位置の順 (入力を上から、続けて出力を上から) に並べる。
 * split から dip / qfp に変えるときと、「上から順に割り当て直す」で、この順に番号を振る
 */
export function listPortsInPositionOrder(def: Circuit): Part[] {
  return [
    ...def.parts.filter((c) => c.kind === 'input').sort(byPosition),
    ...def.parts.filter((c) => c.kind === 'output').sort(byPosition),
  ];
}

/**
 * ポートを、入力をポート番号の順に、続けて出力をポート番号の順に並べる。回路設定の一覧と選択肢に使う
 * (見出しがポート番号なので、番号の順に並べる)。番号を振る順は、位置の順 (listPortsInPositionOrder) を使う。
 * 番号がない・重なるポートは、読み込みでは断り、置く操作では付け直すので、ふつうは起きない。それでも並びが決まるよう、
 * 番号が同じなら位置の順、番号のないものは最後にする
 */
export function listPortsInNumberOrder(def: Circuit): Part[] {
  return [
    ...def.parts.filter((c) => c.kind === 'input').sort(byPortNumber),
    ...def.parts.filter((c) => c.kind === 'output').sort(byPortNumber),
  ];
}

/** ポートの並び ports の先頭から、1 から pins までの番号を順に割り当てる (部品 ID → 番号)。番号が足りなければ、残りは割り当てない */
export function assignInOrder(ports: readonly Part[], pins: number): Map<string, number> {
  return new Map(ports.slice(0, pins).map((c, i) => [c.id, i + 1]));
}

/**
 * ポートが count 本すべて収まる、いちばん小さいピン数。
 * dip は 4 以上の偶数、qfp は 8 以上の 4 の倍数。上限 (MAX_PACKAGE_PINS) を超えるときは上限にする
 */
export function calcFittingPins(kind: 'dip' | 'qfp', count: number): number {
  const [min, step] = kind === 'dip' ? [4, 2] : [8, 4];
  return Math.min(MAX_PACKAGE_PINS, Math.max(min, Math.ceil(count / step) * step));
}

/**
 * 回路設定 (パッケージ、ポートの名前、ピンの割り当て) を当てはめた回路。パッケージを pkg にし、ポートのピン番号を numbers (部品 ID → 番号) にする。
 * numbers にないポート、ピン数を超える番号、split のモジュールのポートからは、ピン番号を外す。
 * portNames (部品 ID → 入力した名前) があるポートは、名前も変える (空白だけなら名前なし)
 */
export function applyModuleSettings<T extends Circuit & { package?: Package }>(
  def: T,
  pkg: Package,
  numbers: ReadonlyMap<string, number>,
  portNames: ReadonlyMap<string, string> = new Map(),
): T {
  const parts = def.parts.map((c) => {
    if (!isPort(c)) {
      return c;
    }
    const text = portNames.get(c.id);
    const named = text === undefined ? c : withPortName(c, text);
    const n = numbers.get(c.id);
    if (!usesPinNumbers(pkg) || n === undefined || n < 1 || n > pkg.pins) {
      return named.pinNumber === undefined ? named : withoutPinNumber(named);
    }
    return named.pinNumber === n ? named : { ...named, pinNumber: n };
  });
  return { ...def, package: pkg, parts };
}

/** 名前を text にしたポート。空白だけなら名前なしにする。名前が変わらなければ c をそのまま返す */
function withPortName(c: Part, text: string): Part {
  const portName = text.trim() || undefined;
  if (portName === c.portName) {
    return c;
  }
  const { portName: _, ...rest } = c;
  return portName === undefined ? rest : { ...rest, portName };
}

/**
 * ポートの名前で、ほかのポートと重なるもの (部品 ID の集合)。portNames は部品 ID → 名前 (前後の空白は除いて比べる)。
 * 名前のないポートは、いくつあっても重なりとしない。入力と出力をまたいで比べる (ポートの名前は、入力か出力かに関係しないため)
 */
export function findDuplicatePortNames(portNames: ReadonlyMap<string, string>): Set<string> {
  const ids = new Map<string, string[]>();
  for (const [id, text] of portNames) {
    const portName = text.trim();
    if (portName !== '') {
      ids.set(portName, [...(ids.get(portName) ?? []), id]);
    }
  }
  return new Set([...ids.values()].filter((list) => list.length > 1).flat());
}
