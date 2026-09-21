import { useEffect, useRef, useState } from 'react';
import type { Project } from '../engine/project';
import { step, type SimResult } from '../engine/sim';

/** 時間を 1 tick 進める間隔 (ms) */
export const TICK_MS = 20;
/** CLOCK が反転する周期 (tick)。半周期ぶん */
export const CLOCK_HALF_TICKS = 25;

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
 * 部品の遅延があるため、値は tick を重ねて伝わっていく
 */
export function useSimulation(
  project: Project,
  circuitId: string,
  setProject: React.Dispatch<React.SetStateAction<Project>>,
) {
  const [sim, setSim] = useState<SimResult>(() => step(project, circuitId));
  const [running, setRunning] = useState(true);
  /** 回路ごとの結果。タブを切り替えても、その回路の状態を保つ */
  const results = useRef(new Map<string, SimResult>());
  const ticks = useRef(0);
  // タイマーからは、常に最新のプロジェクトと開いている回路を見る
  const latest = useRef({ project, circuitId });
  latest.current = { project, circuitId };

  function advance() {
    const { project: p, circuitId: id } = latest.current;
    ticks.current += 1;
    if (
      ticks.current % CLOCK_HALF_TICKS === 0 &&
      p.circuits.some((d) => d.components.some((c) => c.kind === 'CLOCK'))
    ) {
      setProject(toggleClocks);
    }
    setSim((prev) => {
      const next = step(latest.current.project, id, prev);
      results.current.set(id, next);
      return next;
    });
  }

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(advance, TICK_MS);
    return () => clearInterval(timer);
    // advance は ref 越しに最新の状態を見るので、貼り直さなくてよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // タブを切り替えたら、その回路の前回の結果から続ける
  useEffect(() => {
    setSim(results.current.get(circuitId) ?? step(project, circuitId));
    // 開いている回路が変わったときだけ入れ替える
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuitId]);

  return {
    sim,
    running,
    toggleRunning: () => setRunning((r) => !r),
    /** 一時停止中に 1 tick だけ進める */
    stepOnce: advance,
    /** 回路を削除したときなど、覚えている結果を捨てる */
    forget: (id?: string) => (id ? results.current.delete(id) : results.current.clear()),
  };
}
