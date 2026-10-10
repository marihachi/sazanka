import { useEffect, useRef, useState } from 'react';
import { clockFlipsAt, clockPeriodOf, type Part } from '../circuit/part';
import type { Project } from '../circuit/project';
import { flattenProject } from './flatten';
import { FRAME_BUDGET_MS, frameTicks } from './frameTicks';
import {
  type CompiledCircuit,
  compileFlattened,
  OSCILLATION_TICKS,
  SETTLED_TICKS,
  type SimResult,
  type SimState,
  sourcesOf,
  stepState,
  toResult,
  toState,
} from './sim';

/** 「1 tick 戻す」ために覚えておく tick 数 */
const HISTORY_TICKS = 300;

/** CLOCK を指す文字列 (回路 ID と部品 ID)。どの回路の CLOCK も、それぞれの周期で動く */
function clockKey(circuitId: string, compId: string): string {
  return `${circuitId}/${compId}`;
}

/** プロジェクト全体の CLOCK の 1 つ。key は clockKey */
interface ClockEntry {
  key: string;
  part: Part;
}

/** プロジェクト全体の CLOCK。tick ごとにプロジェクト全体を探さないよう、プロジェクトが変わったときだけ作る */
function listClocks(project: Project): ClockEntry[] {
  return project.circuits.flatMap((d) =>
    d.parts.filter((c) => c.kind === 'clock').map((c) => ({ key: clockKey(d.id, c.id), part: c })),
  );
}

/**
 * 時刻 tick の時点で ON/OFF を切り替える CLOCK (プロジェクト全体)。
 * short は、その中に半周期が発振の判定 (OSCILLATION_TICKS) より短い CLOCK があるか
 */
function clocksFlippingAt(
  clocks: readonly ClockEntry[],
  tick: number,
): { keys: string[]; short: boolean } {
  const flipping = clocks.filter((c) => clockFlipsAt(c.part, tick));
  return {
    keys: flipping.map((c) => c.key),
    short: flipping.some((c) => clockPeriodOf(c.part) / 2 < OSCILLATION_TICKS),
  };
}

/** 指定した CLOCK を反転させる */
function toggleClocks(clockOn: Map<string, boolean>, keys: readonly string[]) {
  for (const k of keys) {
    clockOn.set(k, !clockOn.get(k));
  }
}

/** ある時点の評価の状態と、それを求めた回路。回路を編集すると、回路 (部品番号の振り方) が変わる */
interface Snapshot {
  circuit: CompiledCircuit;
  state: SimState;
}

/** 評価の状態を、回路 circuit の部品番号で引く形にする。編集で回路が変わっていたら、部品 ID で引き継ぐ */
function stateFor(snapshot: Snapshot, circuit: CompiledCircuit): SimState {
  return snapshot.circuit === circuit
    ? snapshot.state
    : toState(circuit, toResult(snapshot.circuit, snapshot.state));
}

/**
 * 「1 tick 戻す」ための履歴。入れられるのは limit 個までで、超えたら古いものから捨てる。
 * 毎 tick 入れるので、配列の先頭を消す (shift。中身をすべて詰め直す) のではなく、輪のように使い回す
 */
function createHistory<T>(limit: number) {
  const items: (T | undefined)[] = Array(limit);
  /** いちばん古いものの位置 */
  let start = 0;
  let size = 0;
  return {
    get size() {
      return size;
    },
    push(item: T) {
      items[(start + size) % limit] = item;
      if (size < limit) {
        size += 1;
      } else {
        // いっぱいなら、いちばん古いものの位置に書いたので、古いものの位置を 1 つ進める
        start = (start + 1) % limit;
      }
    },
    /** いちばん新しいものを取り出す */
    pop(): T | undefined {
      if (size === 0) {
        return undefined;
      }
      size -= 1;
      const i = (start + size) % limit;
      const item = items[i];
      items[i] = undefined;
      return item;
    },
    clear() {
      items.fill(undefined);
      start = 0;
      size = 0;
    },
  };
}

/** 値を読み、変わったら知らせてもらえる、シミュレーションの結果の入れ物。シートが購読する (sheet/Sheet.tsx) */
export interface SimStore {
  get: () => SimResult;
  subscribe: (listener: () => void) => () => void;
}

/** 値を入れておき、変わったら購読している側に知らせる入れ物 */
function createSimStore(initial: SimResult) {
  let value = initial;
  const listeners = new Set<() => void>();
  const store: SimStore = {
    get: () => value,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    store,
    set(next: SimResult) {
      value = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

/**
 * 時間を進めるシミュレーション。
 * 1 tick ごとに回路を進め、CLOCK をそれぞれの周期 (部品の period) で反転させる。
 *
 * 計算は ref の中で進め、画面へはフレームごとにそのときの値を渡す。
 * 1 フレームの計算は FRAME_BUDGET_MS までで、間に合わない tick は進めず、遅れは取り戻さない (frameTicks.ts)。
 * tick を速くしても画面の更新回数は増えないので、信号の伝わり方を細かくしつつ描画は軽いままにできる。
 * 値が変わらないフレームでは描き直さず、CLOCK がなく落ち着いたらループ自体を止める。
 *
 * 結果は React の状態にせず、store (購読できる入れ物) で渡す。値を使うシートだけが描き直され、
 * 画面全体 (App) は tick のたびには描き直さない。App が描き直すのは、発振しているかが変わったときだけ
 */
export function useSimulation(
  project: Project,
  circuitId: string,
  /** 1 秒に進める tick 数 (環境設定)。画面の更新とは別で、1 フレームに何 tick 進めてもよい */
  ticksPerSecond: number,
) {
  /** CLOCK の ON/OFF (回路 ID と部品 ID → ON か)。保存データに残っていた値から始める */
  const clockOn = useRef<Map<string, boolean> | null>(null);
  if (!clockOn.current) {
    clockOn.current = new Map(
      project.circuits.flatMap((d) =>
        d.parts
          .filter((c) => c.kind === 'clock')
          .map((c) => [clockKey(d.id, c.id), !!c.on] as const),
      ),
    );
  }
  /** プロジェクト全体の CLOCK。プロジェクトが変わったら作り直す */
  const clocks = useRef<{ project: Project; value: ClockEntry[] } | null>(null);
  function clocksOf(p: Project): ClockEntry[] {
    if (!clocks.current || clocks.current.project !== p) {
      clocks.current = { project: p, value: listClocks(p) };
    }
    return clocks.current.value;
  }
  /**
   * 開いている回路を評価するための準備。展開して番号で引く形にした回路と、INPUT と CLOCK の ON/OFF。
   * 展開は重いので tick ごとにはせず、回路を編集するかタブを切り替えたときだけ行う
   */
  const prepared = useRef<{
    project: Project;
    circuitId: string;
    circuit: CompiledCircuit;
    /** INPUT と CLOCK の ON/OFF (部品番号の順)。CLOCK の分は clockOn から当て、反転したら書き換える */
    sources: Uint8Array;
    /** CLOCK (clockKey) → 展開後のその CLOCK の部品番号。同じモジュールを何か所に置くと、何か所にもなる */
    clockParts: Map<string, number[]>;
  } | null>(null);
  function prepare(p: Project, id: string) {
    if (!prepared.current || prepared.current.project !== p || prepared.current.circuitId !== id) {
      const flat = flattenProject(p, id);
      const circuit = compileFlattened(flat);
      const sources = sourcesOf(circuit);
      const indexOf = new Map(circuit.parts.map((c, i) => [c.id, i]));
      const clockParts = new Map<string, number[]>();
      for (const c of flat.clocks) {
        const key = clockKey(c.circuitId, c.partId);
        const i = indexOf.get(c.id);
        if (i === undefined) {
          throw new Error(`展開した回路に CLOCK がない: ${c.id}`);
        }
        clockParts.set(key, [...(clockParts.get(key) ?? []), i]);
        // CLOCK の ON/OFF は、部品の on ではなくシミュレーションの中で持つ値を使う
        sources[i] = clockOn.current?.get(key) ? 1 : 0;
      }
      prepared.current = { project: p, circuitId: id, circuit, sources, clockParts };
    }
    return prepared.current;
  }
  function flipClocks(keys: readonly string[]) {
    toggleClocks(clockOn.current ?? new Map(), keys);
    // 準備した回路の ON/OFF も書き換える。展開し直さずに済ませるため
    const p = prepared.current;
    if (!p) {
      return;
    }
    for (const key of keys) {
      for (const i of p.clockParts.get(key) ?? []) {
        p.sources[i] = clockOn.current?.get(key) ? 1 : 0;
      }
    }
  }
  /** 回路 id を、前回の結果なしで 1 tick 進めた状態 (開いた直後と、タブを初めて開いたとき) */
  function startOf(p: Project, id: string): Snapshot {
    const { circuit, sources } = prepare(p, id);
    return { circuit, state: stepState(circuit, sources, toState(circuit)) };
  }

  const current = useRef<Snapshot>(startOf(project, circuitId));
  /** シートなどが購読する入れ物 (このフックの間ずっと同じもの) */
  const store = useRef<ReturnType<typeof createSimStore> | null>(null);
  if (!store.current) {
    store.current = createSimStore(toResult(current.current.circuit, current.current.state));
  }
  const [unstable, setUnstable] = useState(current.current.state.unstable);
  /** 一時停止中の 1 tick 送り・戻しのあとに、ボタンの押せる / 押せないを描き直すため */
  const [, setStepVersion] = useState(0);
  /** 結果を画面へ渡す。App へは、発振しているかが変わったときだけ知らせる */
  function publish({ circuit, state }: Snapshot) {
    store.current?.set(toResult(circuit, state));
    setUnstable(state.unstable);
  }
  const [running, setRunning] = useState(true);
  /** 回路ごとの結果。タブを切り替えても、その回路の状態を保つ */
  const results = useRef(new Map<string, Snapshot>());
  const ticks = useRef(0);
  /** 戻すために覚えておく、少し前までの結果。toggled はその tick で反転した CLOCK */
  const past = useRef(createHistory<{ snapshot: Snapshot; toggled: string[] }>(HISTORY_TICKS));
  /** 前回の描画で見たプロジェクト。変わっていれば回路が編集された */
  const lastProject = useRef(project);
  /** 前回の描画で開いていた回路。変わっていればタブを切り替えた */
  const lastCircuitId = useRef(circuitId);
  // タイマーからは、常に最新のプロジェクトと開いている回路を見る
  const latest = useRef({ project, circuitId });
  latest.current = { project, circuitId };
  const ticksPerSecondRef = useRef(ticksPerSecond);
  ticksPerSecondRef.current = ticksPerSecond;

  /** 計算だけを 1 tick 進める (画面には渡さない)。値が変わったかを返す */
  function advance(): boolean {
    const { project: p, circuitId: id } = latest.current;
    ticks.current += 1;
    const { keys: toggled, short } = clocksFlippingAt(clocksOf(p), ticks.current);
    if (toggled.length > 0) {
      flipClocks(toggled);
    }
    past.current.push({ snapshot: current.current, toggled });
    const { circuit, sources } = prepare(p, id);
    const state = stepState(circuit, sources, stateFor(current.current, circuit));
    // 周期の短い CLOCK では、遅延のある回路は落ち着く前に次の反転が来る。
    // そのままでは「落ち着かないまま続いている」と数えられて発振と誤って判定されるので、反転するたびに数え直す。
    // その代わり、周期の短い CLOCK を置いた回路では、本当の発振も検出できない。
    // 半周期が判定の長さ以上ある CLOCK なら、反転の間に落ち着くので数え直さず、発振も検出できる
    if (short) {
      state.activeTicks = 0;
      state.unstable = false;
    }
    current.current = { circuit, state };
    results.current.set(id, current.current);
    // stableTicks が 0 なら、この tick で値が変わった
    return state.stableTicks === 0;
  }

  // 回路を編集したら、戻せる状態は捨てる。編集前の値に戻しても、今の回路とは噛み合わないため。
  // タブを切り替えたときも捨てる。覚えているのは前のタブの回路の結果なので、戻すと別の回路の値が入る。
  // ボタンの押せる / 押せないをこの描画に間に合わせるため、効果ではなく描画中に見る
  if (lastProject.current !== project || lastCircuitId.current !== circuitId) {
    lastProject.current = project;
    lastCircuitId.current = circuitId;
    past.current.clear();
  }

  const hasClock = project.circuits.some((d) => d.parts.some((c) => c.kind === 'clock'));

  /**
   * 経過時間の数え方。last は前のフレームの時刻、carry は持ち越した 1 tick に満たない端数。
   * ループは回路を編集するたびに作り直す (下の useEffect) ので、作り直しをまたいで持つ。
   * ループの中に持つと、部品のドラッグのように編集が続くとき、作り直すたびに前のフレームからの時間が
   * 数えられず、時間が遅れる。null はループが止まっていた (一時停止、または CLOCK がなく落ち着いた) とき。
   * 止まっていた間の時間は数えないので、動かし直すときは、その時刻から数え始める
   */
  const frameTiming = useRef<{ last: number; carry: number } | null>(null);

  // advance は ref 越しに最新の状態を見るので、貼り直さなくてよい。
  // project と circuitId は中では使わないが、回路を触ったら止まったループを動かし直すために並べている
  // biome-ignore lint/correctness/useExhaustiveDependencies: 上の理由で依存を絞っている
  useEffect(() => {
    if (!running) {
      frameTiming.current = null;
      return;
    }
    let frame = 0;
    if (!frameTiming.current) {
      frameTiming.current = { last: performance.now(), carry: 0 };
    }
    const timing = frameTiming.current;
    /** このループで 1 tick でも進めたか。進める前に「落ち着いている」と判断して止めないため */
    let stepped = false;
    const onFrame = (now: number) => {
      // 速さを変えても、ループを作り直さずに次のフレームから効かせる
      // フレームの時刻は、作り直したときに測った時刻より前のことがあるので、負にならないようにする
      const due = frameTicks(
        timing.carry,
        Math.max(0, now - timing.last),
        ticksPerSecondRef.current,
      );
      timing.last = now;
      timing.carry = due.carry;
      let changed = false;
      let count = 0;
      const start = performance.now();
      // 計算に FRAME_BUDGET_MS より長くかかったら、ループを抜け、このフレームの残りの tick は進めない。
      // 遅れは取り戻さない (残りの数を覚えておかない)。取り戻そうとすると、重い回路では
      // 遅れが積み上がり続け、重さが引いたあとに早送りになるため。
      // その分、シミュレーションは指定の速さより遅く進む
      while (count < due.count && performance.now() - start < FRAME_BUDGET_MS) {
        changed = advance() || changed;
        count += 1;
        // CLOCK がなく落ち着いたら、残りの tick を進めても値は変わらない
        if (!hasClock && current.current.state.stableTicks > SETTLED_TICKS) {
          break;
        }
      }
      stepped ||= count > 0;
      // 画面へ渡すのはフレームに1回だけ。値が変わっていなければ描き直さない
      if (changed) {
        publish(current.current);
      }
      // CLOCK がなく、値も落ち着いたら止める。回路を触れば (project が変わるので) また動き出す
      if (stepped && !hasClock && current.current.state.stableTicks > SETTLED_TICKS) {
        frameTiming.current = null;
        return;
      }
      frame = requestAnimationFrame(onFrame);
    };
    frame = requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(frame);
  }, [running, hasClock, project, circuitId]);

  // タブを切り替えたら、その回路の前回の結果から続ける
  // biome-ignore lint/correctness/useExhaustiveDependencies: 開いている回路が変わったときだけ入れ替える (project の変更では入れ替えない)
  useEffect(() => {
    current.current = results.current.get(circuitId) ?? startOf(project, circuitId);
    publish(current.current);
  }, [circuitId]);

  return {
    /** シートが購読する、シミュレーションの結果 */
    simStore: store.current.store,
    /** 発振しているか (ステータスバーとヒント用) */
    unstable,
    running,
    toggleRunning: () => setRunning((r) => !r),
    /** 一時停止中に 1 tick だけ進める */
    stepOnce: () => {
      advance();
      publish(current.current);
      setStepVersion((v) => v + 1);
    },
    /** 戻せる状態が残っているか */
    canStepBack: past.current.size > 0,
    /** 一時停止中に 1 tick 戻す */
    stepBack: () => {
      const last = past.current.pop();
      if (!last) {
        return;
      }
      ticks.current -= 1;
      // CLOCK を反転した tick を戻すので、もう一度反転して元に戻す
      if (last.toggled.length > 0) {
        flipClocks(last.toggled);
      }
      current.current = last.snapshot;
      results.current.set(latest.current.circuitId, last.snapshot);
      publish(last.snapshot);
      setStepVersion((v) => v + 1);
    },
    /** 回路を削除したときなど、覚えている結果を捨てる */
    forget: (id?: string) => {
      past.current.clear();
      if (id) {
        results.current.delete(id);
      } else {
        results.current.clear();
      }
    },
  };
}
