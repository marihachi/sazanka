import { Field, Input, Stack, Text } from '@chakra-ui/react';
import { memo, useRef, useState } from 'react';
import {
  clockPeriodOf,
  isClockPeriod,
  MAX_CLOCK_PERIOD,
  MIN_CLOCK_PERIOD,
  type Part,
} from '../circuit/part';
import { shallowEqual } from '../util';
import { labelOf } from '../parts/views';

interface PropertyPanelProps {
  /** 選んでいる部品。1つだけ選んでいるときだけ渡す */
  part?: Part;
  /** モジュールの名前 (モジュールのとき) */
  moduleName?: string;
  /** 1 tick を進める間隔 (ms、環境設定)。CLOCK の周期を秒でも示すのに使う */
  tickMs: number;
  /** 入力欄を触っている間の最初の変更の直前。欄を離れるまでの変更を、1回の操作として元に戻せるようにするために使う */
  onEditStart: () => void;
  onClockPeriodChange: (id: string, period: number) => void;
  /** INPUT / OUTPUT のラベルを変えた */
  onLabelChange: (id: string, label: string) => void;
}

/**
 * シートの右側の、選んだ部品の項目を編集する欄。
 * 狭い画面では、部品を選んでいる間だけ出す (シートを狭くしすぎないため)
 */
export const PropertyPanel = memo(function PropertyPanel({
  part,
  moduleName,
  tickMs,
  onEditStart,
  onClockPeriodChange,
  onLabelChange,
}: PropertyPanelProps) {
  return (
    <Stack
      as="aside"
      aria-label="部品のプロパティ"
      // 狭い画面では、部品を選んでいない間は出さない
      display={{ base: part ? 'flex' : 'none', md: 'flex' }}
      w={{ base: '160px', md: '200px' }}
      flexShrink={0}
      gap="3"
      px="3"
      py="2.5"
      bg="bg.panel"
      borderLeftWidth="1px"
      overflowY="auto"
    >
      <Text as="h3" textStyle="xs" color="fg.muted">
        プロパティ
      </Text>
      {part ? (
        <>
          <Text fontWeight="semibold">{moduleName ?? labelOf(part.kind)}</Text>
          {/* 部品を選び直したら (key が変わるので)、入力中の文字は捨てて、その部品の値から始める */}
          {part.kind === 'clock' ? (
            <ClockPeriodField
              key={part.id}
              clock={part}
              tickMs={tickMs}
              onEditStart={onEditStart}
              onChange={onClockPeriodChange}
            />
          ) : part.kind === 'input' || part.kind === 'output' ? (
            <LabelField
              key={part.id}
              part={part}
              onEditStart={onEditStart}
              onChange={onLabelChange}
            />
          ) : (
            <Text textStyle="xs" color="fg.subtle">
              この部品に設定できる項目はありません
            </Text>
          )}
        </>
      ) : (
        <Text textStyle="xs" color="fg.subtle">
          部品を1つ選ぶと、その部品の項目を編集できます
        </Text>
      )}
    </Stack>
  );
}, samePanel);

/**
 * 入力欄を触っている間の変更を、1回の操作として元に戻せるようにする。
 * 反映する前に begin を呼ぶと、最初の1回だけ onEditStart (履歴を積む) を呼ぶ。欄を離れたら end を呼ぶ
 */
function useEditSession(onEditStart: () => void) {
  const editing = useRef(false);
  return {
    begin() {
      if (editing.current) {
        return;
      }
      onEditStart();
      editing.current = true;
    },
    end() {
      editing.current = false;
    },
  };
}

/**
 * INPUT / OUTPUT のラベルの入力欄。入力したらすぐに反映する。
 * 欄を離れるまでの変更は1回の操作として元に戻せる。モジュールの中では、外から見たピンの名前になる
 */
function LabelField({
  part,
  onEditStart,
  onChange,
}: {
  part: Part;
  onEditStart: () => void;
  onChange: (id: string, label: string) => void;
}) {
  const [text, setText] = useState(part.label ?? '');
  const session = useEditSession(onEditStart);

  return (
    <Field.Root>
      <Field.Label>ラベル</Field.Label>
      <Input
        size="sm"
        value={text}
        placeholder="ラベルなし"
        onChange={(e) => {
          setText(e.target.value);
          session.begin();
          onChange(part.id, e.target.value);
        }}
        onBlur={session.end}
        onKeyDown={(e) => {
          // Enter で区切る。続けて変えたら、それは別の操作として元に戻せる
          if (e.key === 'Enter') {
            session.end();
          }
        }}
      />
      <Field.HelperText>モジュールの中では、ピンの名前になります</Field.HelperText>
    </Field.Root>
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
  clock: Part;
  tickMs: number;
  onEditStart: () => void;
  onChange: (id: string, period: number) => void;
}) {
  const period = clockPeriodOf(clock);
  const [text, setText] = useState(String(period));
  const value = Number(text);
  const valid = text.trim() !== '' && isClockPeriod(value);

  const session = useEditSession(onEditStart);

  function change(next: string) {
    setText(next);
    const v = Number(next);
    // 使えない値や、今と同じ値では反映しない (履歴を積まないため、session.begin も呼ばない)
    if (next.trim() === '' || !isClockPeriod(v) || v === period) {
      return;
    }
    session.begin();
    onChange(clock.id, v);
  }

  /** 欄を離れた。使えない値のままなら、今の値に戻す */
  function finish() {
    session.end();
    setText(String(period));
  }

  return (
    <Field.Root invalid={!valid}>
      <Field.Label>周期 (tick)</Field.Label>
      <Input
        size="sm"
        type="number"
        inputMode="numeric"
        min={MIN_CLOCK_PERIOD}
        max={MAX_CLOCK_PERIOD}
        step={1}
        value={text}
        onChange={(e) => change(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          // Enter で区切る。続けて変えたら、それは別の操作として元に戻せる
          if (e.key === 'Enter') {
            finish();
          }
        }}
      />
      {valid ? (
        <Field.HelperText>
          {`ON と OFF を一往復する tick 数。今の間隔 (${tickMs} ms) では ${(value * tickMs) / 1000} 秒`}
        </Field.HelperText>
      ) : (
        <Field.ErrorText>
          {`${MIN_CLOCK_PERIOD}〜${MAX_CLOCK_PERIOD} の整数で入力してください`}
        </Field.ErrorText>
      )}
    </Field.Root>
  );
}

/**
 * 描き直すかの判定。プロパティ欄は部品の位置を出さないので、選んだ部品を動かしただけでは描き直さない。
 * そのほかの props は、そのまま比べる (App は同じ関数を渡し続ける)
 */
function samePanel(a: PropertyPanelProps, b: PropertyPanelProps): boolean {
  const { part: pa, ...ra } = a;
  const { part: pb, ...rb } = b;
  const withoutPosition = (c?: Part) => c && { ...c, x: 0, y: 0 };
  return shallowEqual(withoutPosition(pa), withoutPosition(pb)) && shallowEqual(ra, rb);
}
