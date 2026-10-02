import {
  Button,
  Checkbox,
  chakra,
  Dialog as ChakraDialog,
  Field,
  HStack,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useRef, useState } from 'react';
import { HintTooltip } from '../ui/HintTooltip';
import {
  ACCENT_PRESETS,
  DEFAULT_PREFERENCES,
  isTickMs,
  MAX_TICK_MS,
  MIN_TICK_MS,
  type Preferences,
} from './preferences';
import { DialogFrame } from '../ui/DialogFrame';

/** 環境設定のウィンドウ。利用者ごとの設定で、プロジェクトには含めない。変えた値はすぐに反映する (保存は呼び出し側) */
export function PreferencesDialog({
  preferences,
  onChange,
  onClose,
}: {
  preferences: Preferences;
  onChange: (preferences: Preferences) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // 入力の途中 (空欄や範囲外) は反映せず、使える値になったときだけ反映する
  const [tickText, setTickText] = useState(String(preferences.tickMs));
  const tickValid = isTickMs(Number(tickText)) && tickText.trim() !== '';

  return (
    <DialogFrame onClose={onClose} initialFocus={closeRef}>
      <ChakraDialog.Header>
        <ChakraDialog.Title>環境設定</ChakraDialog.Title>
      </ChakraDialog.Header>
      <ChakraDialog.Body>
        <Stack gap="5">
          <Field.Root invalid={!tickValid}>
            <Field.Label>シミュレーションで 1 tick を進める間隔 (ms)</Field.Label>
            <Input
              type="number"
              inputMode="numeric"
              min={MIN_TICK_MS}
              max={MAX_TICK_MS}
              step={1}
              value={tickText}
              onChange={(e) => {
                setTickText(e.target.value);
                const v = Number(e.target.value);
                if (e.target.value.trim() !== '' && isTickMs(v)) {
                  onChange({ ...preferences, tickMs: v });
                }
              }}
              // 使えない値のまま離れたら、今の値に戻す
              onBlur={() => setTickText(String(preferences.tickMs))}
            />
            {tickValid ? (
              <Field.HelperText>
                {`大きくするとゆっくり進み、信号が 1 tick ずつ伝わる様子を目で追えます。既定は ${DEFAULT_PREFERENCES.tickMs} ms。CLOCK の周期 (秒) は、CLOCK ごとの tick 数 × この間隔です。`}
              </Field.HelperText>
            ) : (
              <Field.ErrorText>
                {`${MIN_TICK_MS}〜${MAX_TICK_MS} の整数で入力してください`}
              </Field.ErrorText>
            )}
          </Field.Root>
          <Stack gap="3">
            <Checkbox.Root
              checked={preferences.showGrid}
              onCheckedChange={(e) => onChange({ ...preferences, showGrid: e.checked === true })}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>シートに方眼を表示する</Checkbox.Label>
            </Checkbox.Root>
            <Checkbox.Root
              checked={preferences.roundWires}
              onCheckedChange={(e) => onChange({ ...preferences, roundWires: e.checked === true })}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>配線の角を丸める</Checkbox.Label>
            </Checkbox.Root>
          </Stack>
          <Stack gap="1.5">
            <Text id="accent-label" textStyle="sm" fontWeight="medium">
              アクセントカラー
            </Text>
            <HStack gap="2" role="group" aria-labelledby="accent-label">
              {ACCENT_PRESETS.map((p) => (
                <HintTooltip key={p.value} content={p.label}>
                  <chakra.button
                    type="button"
                    boxSize="6"
                    rounded="full"
                    cursor="pointer"
                    style={{ background: p.value }}
                    // 今の色は、文字色の輪で囲む
                    outline={preferences.accent === p.value ? '2px solid' : 'none'}
                    outlineColor="fg"
                    outlineOffset="2px"
                    _focusVisible={{ outline: '2px solid', outlineColor: 'fg' }}
                    aria-label={p.label}
                    aria-pressed={preferences.accent === p.value}
                    onClick={() => onChange({ ...preferences, accent: p.value })}
                  />
                </HintTooltip>
              ))}
              {/* 用意した色以外も選べる */}
              <HintTooltip content="ほかの色を選ぶ">
                <chakra.input
                  type="color"
                  w="8"
                  h="7"
                  p="0.5"
                  bg="transparent"
                  borderWidth="1px"
                  rounded="l2"
                  cursor="pointer"
                  value={preferences.accent}
                  aria-label="ほかの色を選ぶ"
                  onChange={(e) => onChange({ ...preferences, accent: e.target.value })}
                />
              </HintTooltip>
            </HStack>
          </Stack>
        </Stack>
      </ChakraDialog.Body>
      <ChakraDialog.Footer>
        <Button ref={closeRef} onClick={onClose}>
          閉じる
        </Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}
