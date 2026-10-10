import { useEffect, useRef, useState } from 'react';
import { clockFlipsAt, clockPeriodOf, type Part } from '../circuit/part';
import type { Project } from '../circuit/project';
import { type Flattened, flattenProject } from './flatten';
import { frameTicks } from './frameTicks';
import { OSCILLATION_TICKS, SETTLED_TICKS, stepFlattened, type SimResult } from './sim';

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

/**
 * 展開した回路の CLOCK に、ON/OFF を当てたもの (計算にだけ使う)。
 * CLOCK の ON/OFF はプロジェクト (画面の状態) には書かず、シミュレーションの中で持つ。
 * 書くと CLOCK が反転するたびにプロジェクトが変わり、画面全体の描き直しと保存が起きて重くなるため
 */
function withClockStates(flat: Flattened, clockOn: ReadonlyMap<string, boolean>): Flattened {
  // 展開後の部品 ID → ON か。同じモジュールを何か所に置いても、中の CLOCK は展開前の部品ごとに 1 つの状態を持つ
  const on = new Map(
    flat.clocks.map((c) => [c.id, !!clockOn.get(clockKey(c.circuitId, c.partId))] as const),
  );
  return {
    ...flat,
    circuit: {
      ...flat.circuit,
      parts: flat.circuit.parts.map((c) => {
        const v = on.get(c.id);
        return v === undefined ? c : { ...c, on: v };
      }),
    },
  };
}

/** 指定した CLOCK を反転させる */
function toggleClocks(clockOn: Map<string, boolean>, keys: readonly string[]) {
  for (const k of keys) {
    clockOn.set(k, !clockOn.get(k));
  }
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
 * tick を短くしても画面の更新回数は増えないので、信号の伝わり方を細かくしつつ描画は軽いままにできる。
 * 値が変わらないフレームでは描き直さず、CLOCK がなく落ち着いたらループ自体を止める。
 *
 * 結果は React の状態にせず、store (購読できる入れ物) で渡す。値を使うシートだけが描き直され、
 * 画面全体 (App) は tick のたびには描き直さない。App が描き直すのは、発振しているかが変わったときだけ
 */
export function useSimulation(
  project: Project,
  circuitId: string,
  /** 時間を 1 tick 進める間隔 (ms、環境設定)。画面の更新間隔とは別で、それより短くてよい */
  tickMs: number,
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
   * 開いている回路を展開したもの (base) と、それに CLOCK の状態を当てたもの (value)。
   * 展開は重いので tick ごとにはせず、回路を編集するかタブを切り替えたときだけ行う。
   * CLOCK が反転したときは、展開し直さずに状態だけを当て直す
   */
  const flat = useRef<{
    project: Project;
    circuitId: string;
    base: Flattened;
    value: Flattened;
  } | null>(null);
  function flattenedFor(p: Project, id: string): Flattened {
    if (!flat.current || flat.current.project !== p || flat.current.circuitId !== id) {
      const base = flattenProject(p, id);
      flat.current = {
        project: p,
        circuitId: id,
        base,
        value: withClockStates(base, clockOn.current ?? new Map()),
      };
    }
    return flat.current.value;
  }
  function flipClocks(keys: readonly string[]) {
    toggleClocks(clockOn.current ?? new Map(), keys);
    if (flat.current) {
      flat.current = {
        ...flat.current,
        value: withClockStates(flat.current.base, clockOn.current ?? new Map()),
      };
    }
  }

  const current = useRef<SimResult>(stepFlattened(flattenedFor(project, circuitId)));
  /** シートなどが購読する入れ物 (このフックの間ずっと同じもの) */
  const store = useRef<ReturnType<typeof createSimStore> | null>(null);
  if (!store.current) {
    store.current = createSimStore(current.current);
  }
  const [unstable, setUnstable] = useState(current.current.unstable);
  /** 一時停止中の 1 tick 送り・戻しのあとに、ボタンの押せる / 押せないを描き直すため */
  const [, setStepVersion] = useState(0);
  /** 結果を画面へ渡す。App へは、発振しているかが変わったときだけ知らせる */
  function publish(result: SimResult) {
    store.current?.set(result);
    setUnstable(result.unstable);
  }
  const [running, setRunning] = useState(true);
  /** 回路ごとの結果。タブを切り替えても、その回路の状態を保つ */
  const results = useRef(new Map<string, SimResult>());
  const ticks = useRef(0);
  /** 戻すために覚えておく、少し前までの結果。toggled はその tick で反転した CLOCK */
  const past = useRef<{ sim: SimResult; toggled: string[] }[]>([]);
  /** 前回の描画で見たプロジェクト。変わっていれば回路が編集された */
  const lastProject = useRef(project);
  /** 前回の描画で開いていた回路。変わっていればタブを切り替えた */
  const lastCircuitId = useRef(circuitId);
  // タイマーからは、常に最新のプロジェクトと開いている回路を見る
  const latest = useRef({ project, circuitId });
  latest.current = { project, circuitId };
  const tickMsRef = useRef(tickMs);
  tickMsRef.current = tickMs;

  /** 計算だけを 1 tick 進める (画面には渡さない)。値が変わったかを返す */
  function advance(): boolean {
    const { project: p, circuitId: id } = latest.current;
    ticks.current += 1;
    const { keys: toggled, short } = clocksFlippingAt(clocksOf(p), ticks.current);
    if (toggled.length > 0) {
      flipClocks(toggled);
    }
    past.current.push({ sim: current.current, toggled });
    if (past.current.length > HISTORY_TICKS) {
      past.current.shift();
    }
    current.current = stepFlattened(flattenedFor(p, id), current.current);
    // 周期の短い CLOCK では、遅延のある回路は落ち着く前に次の反転が来る。
    // そのままでは「落ち着かないまま続いている」と数えられて発振と誤って判定されるので、反転するたびに数え直す。
    // その代わり、周期の短い CLOCK を置いた回路では、本当の発振も検出できない。
    // 半周期が判定の長さ以上ある CLOCK なら、反転の間に落ち着くので数え直さず、発振も検出できる
    if (short) {
      current.current = { ...current.current, activeTicks: 0, unstable: false };
    }
    results.current.set(id, current.current);
    // stableTicks が 0 なら、この tick で値が変わった
    return current.current.stableTicks === 0;
  }

  // 回路を編集したら、戻せる状態は捨てる。編集前の値に戻しても、今の回路とは噛み合わないため。
  // タブを切り替えたときも捨てる。覚えているのは前のタブの回路の結果なので、戻すと別の回路の値が入る。
  // ボタンの押せる / 押せないをこの描画に間に合わせるため、効果ではなく描画中に見る
  if (lastProject.current !== project || lastCircuitId.current !== circuitId) {
    lastProject.current = project;
    lastCircuitId.current = circuitId;
    past.current = [];
  }

  const hasClock = project.circuits.some((d) => d.parts.some((c) => c.kind === 'clock'));

  // advance は ref 越しに最新の状態を見るので、貼り直さなくてよい。
  // project と circuitId は中では使わないが、回路を触ったら止まったループを動かし直すために並べている
  // biome-ignore lint/correctness/useExhaustiveDependencies: 上の理由で依存を絞っている
  useEffect(() => {
    if (!running) {
      return;
    }
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    /** このループで 1 tick でも進めたか。進める前に「落ち着いている」と判断して止めないため */
    let stepped = false;
    const onFrame = (now: number) => {
      carry += now - last;
      last = now;
      // 間隔を変えても、ループを作り直さずに次のフレームから効かせる
      const due = frameTicks(carry, tickMsRef.current);
      const count = due.count;
      carry = due.carry;
      let changed = false;
      for (let i = 0; i < count; i++) {
        changed = advance() || changed;
      }
      stepped ||= count > 0;
      // 画面へ渡すのはフレームに1回だけ。値が変わっていなければ描き直さない
      if (changed) {
        publish(current.current);
      }
      // CLOCK がなく、値も落ち着いたら止める。回路を触れば (project が変わるので) また動き出す
      if (stepped && !hasClock && current.current.stableTicks > SETTLED_TICKS) {
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
    current.current =
      results.current.get(circuitId) ?? stepFlattened(flattenedFor(project, circuitId));
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
    canStepBack: past.current.length > 0,
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
      current.current = last.sim;
      results.current.set(latest.current.circuitId, last.sim);
      publish(last.sim);
      setStepVersion((v) => v + 1);
    },
    /** 回路を削除したときなど、覚えている結果を捨てる */
    forget: (id?: string) => {
      past.current = [];
      if (id) {
        results.current.delete(id);
      } else {
        results.current.clear();
      }
    },
  };
}
