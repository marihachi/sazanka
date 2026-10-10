import { Field, Input, Stack, Text } from '@chakra-ui/react';
import { memo, useRef, useState } from 'react';
import {
  clockPeriodOf,
  clockPeriodSeconds,
  isClockPeriod,
  MAX_CLOCK_PERIOD,
  MIN_CLOCK_PERIOD,
  type Part,
} from '../circuit/part';
import { shallowEqual } from '../util';
import { labelOf } from '../parts/views';
import { useLanguage, useMessages } from '../i18n/useMessages';

interface PropertyPanelProps {
  /** 選んでいる部品。1つだけ選んでいるときだけ渡す */
  part?: Part;
  /** モジュールの名前 (モジュールのとき) */
  moduleName?: string;
  /** モジュールの回路を開いているか。モジュールの中の INPUT / OUTPUT は、名前の欄を「ポート名」と呼ぶ */
  inModule?: boolean;
  /** 1 秒に進める tick 数 (環境設定)。CLOCK の周期を秒でも示すのに使う */
  ticksPerSecond: number;
  /** 入力欄を触っている間の最初の変更の直前。欄を離れるまでの変更を、1回の操作として元に戻せるようにするために使う */
  onEditStart: () => void;
  onClockPeriodChange: (id: string, period: number) => void;
  /**
   * 選んでいる INPUT / OUTPUT 以外の、同じ回路のポートの名前を、改行でつないだもの。
   * 同じ名前を付けられないようにするために使う (memo で比べられるよう、集合ではなく文字列で渡す)
   */
  otherLabels?: string;
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
  inModule = false,
  otherLabels = '',
  ticksPerSecond,
  onEditStart,
  onClockPeriodChange,
  onLabelChange,
}: PropertyPanelProps) {
  const lang = useLanguage();
  const m = useMessages();
  return (
    <Stack
      as="aside"
      aria-label={m.property.panel}
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
        {m.property.heading}
      </Text>
      {part ? (
        <>
          <Text fontWeight="semibold">{moduleName ?? labelOf(part.kind, lang)}</Text>
          {/* 部品を選び直したら (key が変わるので)、入力中の文字は捨てて、その部品の値から始める */}
          {part.kind === 'clock' ? (
            <ClockPeriodField
              key={part.id}
              clock={part}
              ticksPerSecond={ticksPerSecond}
              onEditStart={onEditStart}
              onChange={onClockPeriodChange}
            />
          ) : part.kind === 'input' || part.kind === 'output' ? (
            <>
              {/* ポート番号は表示だけ (「入力 1」の形で、入力か出力かも示す)。置いたときに決まり、利用者は変えない。
                  パッケージとピンの割り当てはモジュール設定で確かめるので、ここには出さない */}
              {part.portNumber !== undefined && (
                <ReadOnlyRow
                  label={m.property.portNumber}
                  value={m.common.portName(part.kind, part.portNumber)}
                />
              )}
              <LabelField
                key={part.id}
                part={part}
                inModule={inModule}
                otherLabels={otherLabels}
                onEditStart={onEditStart}
                onChange={onLabelChange}
              />
            </>
          ) : (
            <Text textStyle="xs" color="fg.subtle">
              {m.property.noItems}
            </Text>
          )}
        </>
      ) : (
        <Text textStyle="xs" color="fg.subtle">
          {m.property.selectOne}
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
/** 表示だけの項目 */
function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap="0.5">
      <Text textStyle="sm" fontWeight="medium">
        {label}
      </Text>
      <Text textStyle="sm">{value}</Text>
    </Stack>
  );
}

function LabelField({
  part,
  inModule,
  otherLabels,
  onEditStart,
  onChange,
}: {
  part: Part;
  /** モジュールの回路を開いているか。欄の名前は、モジュールの中では「ポート名」、メイン回路では「ラベル」 */
  inModule: boolean;
  otherLabels: string;
  onEditStart: () => void;
  onChange: (id: string, label: string) => void;
}) {
  const m = useMessages();
  const [text, setText] = useState(part.label ?? '');
  const session = useEditSession(onEditStart);
  const taken = (value: string) =>
    value.trim() !== '' && otherLabels.split('\n').includes(value.trim());

  return (
    <Field.Root invalid={taken(text)}>
      <Field.Label>{inModule ? m.property.portLabel : m.property.label}</Field.Label>
      <Input
        size="sm"
        value={text}
        placeholder={inModule ? m.property.noPortLabel : m.property.noLabel}
        onChange={(e) => {
          setText(e.target.value);
          // ほかのポートと同じ名前は反映しない (欄の文字は残し、エラーを出す)
          if (taken(e.target.value)) {
            return;
          }
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
      <Field.ErrorText>{m.property.duplicateLabel}</Field.ErrorText>
      <Field.HelperText>{m.property.labelHelp}</Field.HelperText>
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
  ticksPerSecond,
  onEditStart,
  onChange,
}: {
  clock: Part;
  ticksPerSecond: number;
  onEditStart: () => void;
  onChange: (id: string, period: number) => void;
}) {
  const m = useMessages();
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
      <Field.Label>{m.property.clockPeriod}</Field.Label>
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
          {m.property.clockPeriodHelp(ticksPerSecond, clockPeriodSeconds(value, ticksPerSecond))}
        </Field.HelperText>
      ) : (
        <Field.ErrorText>
          {m.common.integerRange(MIN_CLOCK_PERIOD, MAX_CLOCK_PERIOD)}
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
