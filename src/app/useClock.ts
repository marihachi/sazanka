import { useEffect } from 'react';
import type { Project } from '../engine/project';

/** CLOCK が反転する間隔 (ms) */
export const CLOCK_HALF_PERIOD = 500;

/** プロジェクト内のすべての CLOCK を一定間隔で反転させる。CLOCK がなければタイマーは動かさない */
export function useClock(project: Project, setProject: React.Dispatch<React.SetStateAction<Project>>) {
  const hasClock = project.circuits.some((d) => d.components.some((c) => c.kind === 'CLOCK'));
  useEffect(() => {
    if (!hasClock) return;
    const timer = setInterval(() => {
      setProject((p) => ({
        circuits: p.circuits.map((d) => ({
          ...d,
          components: d.components.map((c) => (c.kind === 'CLOCK' ? { ...c, on: !c.on } : c)),
        })),
      }));
    }, CLOCK_HALF_PERIOD);
    return () => clearInterval(timer);
  }, [hasClock, setProject]);
}
