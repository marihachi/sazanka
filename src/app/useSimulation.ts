import { useEffect, useRef, useState } from 'react';
import type { Project } from '../engine/project';
import { SETTLED_TICKS, step, type SimResult } from '../engine/sim';

/** 時間を 1 tick 進める間隔 (ms)。画面の更新間隔とは別で、これより短くしてよい */
export const TICK_MS = 10;
/** CLOCK が反転する周期 (tick)。半周期ぶん */
export const CLOCK_HALF_TICKS = 50;
/** 1 フレームで進める tick 数の上限。タブを離れていた間の遅れを一気に取り戻さないため */
const MAX_TICKS_PER_FRAME = 20;

/** CLOCK が ON/OFF を一往復する時間 (秒)。ヒントの文言に使う */
export const CLOCK_PERIOD_SECONDS = (CLOCK_HALF_TICKS * 2 * TICK_MS) / 1000;

/** すべての CLOCK を反転させる */
function toggleClocks(project: Project): Project {
  return {
    ...project,
    circuits: project.circuits.map((d) => ({
      ...d,
      components: d.components.map((c) => (c.kind === 'CLOCK' ? { ...c, on: !c.on } : c)),
    })),
  };
}

/**
 * 時間を進めるシミュレーション。
 * 1 tick ごとに回路を1段ぶん進め、CLOCK_HALF_TICKS ごとに CLOCK を反転させる。
 *
 * 計算は ref の中で進め、画面へはフレームごとにそのときの値を渡す。
 * tick を短くしても画面の更新回数は増えないので、信号の伝わり方を細かくしつつ描画は軽いままにできる。
 * 値が変わらないフレームでは描き直さず、CLOCK がなく落ち着いたらループ自体を止める
 */
export function useSimulation(
  project: Project,
  circuitId: string,
  setProject: React.Dispatch<React.SetStateAction<Project>>,
) {
  const current = useRef<SimResult>(step(project, circuitId));
  const [sim, setSim] = useState<SimResult>(current.current);
  const [running, setRunning] = useState(true);
  /** 回路ごとの結果。タブを切り替えても、その回路の状態を保つ */
  const results = useRef(new Map<string, SimResult>());
  const ticks = useRef(0);
  // タイマーからは、常に最新のプロジェクトと開いている回路を見る
  const latest = useRef({ project, circuitId });
  latest.current = { project, circuitId };

  /** 計算だけを 1 tick 進める (画面には渡さない)。値が変わったかを返す */
  function advance(): boolean {
    const { project: p, circuitId: id } = latest.current;
    ticks.current += 1;
    if (
      ticks.current % CLOCK_HALF_TICKS === 0 &&
      p.circuits.some((d) => d.components.some((c) => c.kind === 'CLOCK'))
    ) {
      setProject(toggleClocks);
    }
    current.current = step(p, id, current.current);
    results.current.set(id, current.current);
    // stableTicks が 0 なら、この tick で値が変わった
    return current.current.stableTicks === 0;
  }

  const hasClock = project.circuits.some((d) => d.components.some((c) => c.kind === 'CLOCK'));

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    /** このループで 1 tick でも進めたか。進める前に「落ち着いている」と判断して止めないため */
    let stepped = false;
    const onFrame = (now: number) => {
      carry += now - last;
      last = now;
      const count = Math.min(Math.floor(carry / TICK_MS), MAX_TICKS_PER_FRAME);
      carry -= count * TICK_MS;
      let changed = false;
      for (let i = 0; i < count; i++) changed = advance() || changed;
      stepped ||= count > 0;
      // 画面へ渡すのはフレームに1回だけ。値が変わっていなければ描き直さない
      if (changed) setSim(current.current);
      // CLOCK がなく、値も落ち着いたら止める。回路を触れば (project が変わるので) また動き出す
      if (stepped && !hasClock && current.current.stableTicks > SETTLED_TICKS) return;
      frame = requestAnimationFrame(onFrame);
    };
    frame = requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(frame);
    // advance は ref 越しに最新の状態を見るので、貼り直さなくてよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, hasClock, project, circuitId]);

  // タブを切り替えたら、その回路の前回の結果から続ける
  useEffect(() => {
    current.current = results.current.get(circuitId) ?? step(project, circuitId);
    setSim(current.current);
    // 開いている回路が変わったときだけ入れ替える
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuitId]);

  return {
    sim,
    running,
    toggleRunning: () => setRunning((r) => !r),
    /** 一時停止中に 1 tick だけ進める */
    stepOnce: () => {
      advance();
      setSim(current.current);
    },
    /** 回路を削除したときなど、覚えている結果を捨てる */
    forget: (id?: string) => (id ? results.current.delete(id) : results.current.clear()),
  };
}
