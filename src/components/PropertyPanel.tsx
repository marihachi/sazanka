import { useRef, useState } from 'react';
import { clockPeriodOf, isClockPeriod, MAX_CLOCK_PERIOD, MIN_CLOCK_PERIOD, type Component } from '../engine/component';
import { classNames } from './classNames';
import { LABELS } from './parts';
import styles from './PropertyPanel.module.css';

interface PropertyPanelProps {
  /** 選んでいる部品。1つだけ選んでいるときだけ渡す */
  component?: Component;
  /** モジュールの名前 (CUSTOM のとき) */
  moduleName?: string;
  /** 1 tick を進める間隔 (ms、環境設定)。CLOCK の周期を秒でも示すのに使う */
  tickMs: number;
  /** 入力欄を触っている間の最初の変更の直前。欄を離れるまでの変更を、1回の操作として元に戻せるようにするために使う */
  onEditStart: () => void;
  onClockPeriodChange: (id: string, period: number) => void;
}

/**
 * シートの右側の、選んだ部品の項目を編集する欄。
 * 狭い画面では、部品を選んでいる間だけ出す (シートを狭くしすぎないため)
 */
export function PropertyPanel({ component, moduleName, tickMs, onEditStart, onClockPeriodChange }: PropertyPanelProps) {
  return (
    <aside className={classNames(styles.panel, !component && styles.idle)} aria-label="部品のプロパティ">
      <h3 className={styles.title}>プロパティ</h3>
      {component ? (
        <>
          <p className={styles.kind}>{moduleName ?? LABELS[component.kind] ?? component.kind}</p>
          {component.kind === 'CLOCK' ? (
            // 部品を選び直したら、入力中の文字は捨てて、その部品の値から始める
            <ClockPeriodField
              key={component.id}
              clock={component}
              tickMs={tickMs}
              onEditStart={onEditStart}
              onChange={onClockPeriodChange}
            />
          ) : (
            <p className={styles.empty}>この部品に設定できる項目はありません</p>
          )}
        </>
      ) : (
        <p className={styles.empty}>部品を1つ選ぶと、その部品の項目を編集できます</p>
      )}
    </aside>
  );
}

/**
 * CLOCK の周期の入力欄。使える値になったら、すぐに反映する。
 * 欄を離れるまでの変更は1回の操作として元に戻せる (打つたびに履歴が増えないように)。
 * 使えない値のまま離れたら、今の値に戻す
 */
function ClockPeriodField({
  clock,
  tickMs,
  onEditStart,
  onChange,
}: {
  clock: Component;
  tickMs: number;
  onEditStart: () => void;
  onChange: (id: string, period: number) => void;
}) {
  const period = clockPeriodOf(clock);
  const [text, setText] = useState(String(period));
  const value = Number(text);
  const valid = text.trim() !== '' && isClockPeriod(value);

  /** 欄を触っている間に、もう履歴を積んだか */
  const editing = useRef(false);

  function change(next: string) {
    setText(next);
    const v = Number(next);
    if (next.trim() === '' || !isClockPeriod(v) || v === period) return;
    if (!editing.current) {
      onEditStart();
      editing.current = true;
    }
    onChange(clock.id, v);
  }

  /** 欄を離れた。使えない値のままなら、今の値に戻す */
  function finish() {
    editing.current = false;
    setText(String(period));
  }

  return (
    <label className={styles.field}>
      <span>周期 (tick)</span>
      <input
        type="number"
        inputMode="numeric"
        min={MIN_CLOCK_PERIOD}
        max={MAX_CLOCK_PERIOD}
        step={1}
        value={text}
        aria-invalid={!valid}
        onChange={(e) => change(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          // Enter で区切る。続けて変えたら、それは別の操作として元に戻せる
          if (e.key === 'Enter') finish();
        }}
      />
      <span className={classNames(styles.help, !valid && styles.invalid)}>
        {valid
          ? `ON と OFF を一往復する tick 数。今の間隔 (${tickMs} ms) では ${(value * tickMs) / 1000} 秒`
          : `${MIN_CLOCK_PERIOD}〜${MAX_CLOCK_PERIOD} の整数で入力してください`}
      </span>
    </label>
  );
}
