import { useEffect, useState } from 'react';
import './StatusBar.css';

const HINT_MIN_DURATION = 6000;

/** ヒントを表示し続ける時間 (ms)。長い文ほど長く、最短でも HINT_MIN_DURATION */
function hintDuration(hint: string): number {
  return Math.max(HINT_MIN_DURATION, 3000 + hint.length * 250);
}

interface StatusBarProps {
  /** 表示するヒント。複数あれば時間で切り替える */
  hints: string[];
  unstable: boolean;
}

/** 画面下のステータスバー。使い方のヒントと、発振の警告を出す */
export function StatusBar({ hints, unstable }: StatusBarProps) {
  const hintKey = hints.join('|');
  const [index, setIndex] = useState(0);
  /** マウスが載っている間は切り替えを止める */
  const [paused, setPaused] = useState(false);
  // ヒントの内容が変わったら最初から表示し直す
  useEffect(() => setIndex(0), [hintKey]);
  const hint = hints[index % hints.length];
  // 読み終えられるだけの時間を置いてから次のヒントへ切り替える
  useEffect(() => {
    if (hints.length < 2 || paused) return;
    const timer = setTimeout(() => setIndex((i) => i + 1), hintDuration(hint));
    return () => clearTimeout(timer);
  }, [hint, index, hints.length, paused]);

  return (
    <footer className="statusbar" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <span key={hint} className="status-hint">
        {hint}
      </span>
      {unstable && <span className="status-warn">発振しています</span>}
    </footer>
  );
}
