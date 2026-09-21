import { useEffect, useRef, useState } from 'react';
import type { Project } from '../engine/project';
import { SETTLED_TICKS, step, type SimResult } from '../engine/sim';

/** CLOCK が反転する周期 (tick)。半周期ぶん */
export const CLOCK_HALF_TICKS = 50;
/** 1 フレームで進める tick 数の上限。タブを離れていた間の遅れを一気に取り戻さないため */
const MAX_TICKS_PER_FRAME = 20;
/** 「1 段戻す」ために覚えておく tick 数 */
const HISTORY_TICKS = 300;

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
  /** 時間を 1 tick 進める間隔 (ms、環境設定)。画面の更新間隔とは別で、それより短くてよい */
  tickMs: number,
) {
  const current = useRef<SimResult>(step(project, circuitId));
  const [sim, setSim] = useState<SimResult>(current.current);
  const [running, setRunning] = useState(true);
  /** 回路ごとの結果。タブを切り替えても、その回路の状態を保つ */
  const results = useRef(new Map<string, SimResult>());
  const ticks = useRef(0);
  /** 戻すために覚えておく、少し前までの結果。toggled はその tick で CLOCK を反転したか */
  const past = useRef<{ sim: SimResult; toggled: boolean }[]>([]);
  /** 直前のプロジェクトの変化が、自分で反転した CLOCK によるものか */
  const clockChange = useRef(false);
  /** 前回の描画で見たプロジェクト。変わっていれば回路が編集された */
  const lastProject = useRef(project);
  // タイマーからは、常に最新のプロジェクトと開いている回路を見る
  const latest = useRef({ project, circuitId });
  latest.current = { project, circuitId };
  const tickMsRef = useRef(tickMs);
  tickMsRef.current = tickMs;

  /** 計算だけを 1 tick 進める (画面には渡さない)。値が変わったかを返す */
  function advance(): boolean {
    const { project: p, circuitId: id } = latest.current;
    ticks.current += 1;
    const toggled =
      ticks.current % CLOCK_HALF_TICKS === 0 && p.circuits.some((d) => d.components.some((c) => c.kind === 'CLOCK'));
    if (toggled) {
      clockChange.current = true;
      setProject(toggleClocks);
    }
    past.current.push({ sim: current.current, toggled });
    if (past.current.length > HISTORY_TICKS) past.current.shift();
    current.current = step(p, id, current.current);
    results.current.set(id, current.current);
    // stableTicks が 0 なら、この tick で値が変わった
    return current.current.stableTicks === 0;
  }

  // 回路を編集したら、戻せる状態は捨てる。編集前の値に戻しても、今の回路とは噛み合わないため。
  // CLOCK の反転は自分で起こした変化なので、そのままにする。
  // ボタンの押せる / 押せないをこの描画に間に合わせるため、効果ではなく描画中に見る
  if (lastProject.current !== project) {
    lastProject.current = project;
    if (clockChange.current) clockChange.current = false;
    else past.current = [];
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
      // 間隔を変えても、ループを作り直さずに次のフレームから効かせる
      const interval = tickMsRef.current;
      const count = Math.min(Math.floor(carry / interval), MAX_TICKS_PER_FRAME);
      carry -= count * interval;
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
    /** 戻せる状態が残っているか */
    canStepBack: past.current.length > 0,
    /** 一時停止中に 1 tick 戻す */
    stepBack: () => {
      const last = past.current.pop();
      if (!last) return;
      ticks.current -= 1;
      // CLOCK を反転した tick を戻すので、もう一度反転して元に戻す
      if (last.toggled) {
        clockChange.current = true;
        setProject(toggleClocks);
      }
      current.current = last.sim;
      results.current.set(latest.current.circuitId, last.sim);
      setSim(last.sim);
    },
    /** 回路を削除したときなど、覚えている結果を捨てる */
    forget: (id?: string) => {
      past.current = [];
      if (id) results.current.delete(id);
      else results.current.clear();
    },
  };
}
