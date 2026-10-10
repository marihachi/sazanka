import {
  Button,
  Checkbox,
  chakra,
  Dialog as ChakraDialog,
  Field,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useRef, useState } from 'react';
import { HintTooltip } from '../ui/HintTooltip';
import {
  ACCENT_PRESETS,
  DEFAULT_PREFERENCES,
  isTicksPerSecond,
  MAX_TICKS_PER_SECOND,
  MIN_TICKS_PER_SECOND,
  type Preferences,
} from './preferences';
import { DialogFrame } from '../ui/DialogFrame';
import { useLanguage, useMessages } from '../i18n/useMessages';
import { isLanguageSetting, LANGUAGE_SETTINGS } from '../i18n/language';

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
  const lang = useLanguage();
  const m = useMessages();
  const closeRef = useRef<HTMLButtonElement>(null);
  // 入力の途中 (空欄や範囲外) は反映せず、使える値になったときだけ反映する
  const [tickText, setTickText] = useState(String(preferences.ticksPerSecond));
  const tickValid = isTicksPerSecond(Number(tickText)) && tickText.trim() !== '';

  return (
    <DialogFrame onClose={onClose} initialFocus={closeRef}>
      <ChakraDialog.Header>
        <ChakraDialog.Title>{m.preferences.title}</ChakraDialog.Title>
      </ChakraDialog.Header>
      <ChakraDialog.Body>
        <Stack gap="5">
          {/* 言語は、今の言語が読めない人も見つけられるよう、いちばん上に置く */}
          <Field.Root>
            <Field.Label>{m.preferences.language}</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field
                value={preferences.language}
                onChange={(e) => {
                  const language = e.target.value;
                  if (isLanguageSetting(language)) {
                    onChange({ ...preferences, language });
                  }
                }}
              >
                {LANGUAGE_SETTINGS.map((l) => (
                  <option key={l} value={l}>
                    {m.preferences.languages[l]}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
          <Field.Root invalid={!tickValid}>
            <Field.Label>{m.preferences.ticksPerSecond}</Field.Label>
            <Input
              type="number"
              inputMode="numeric"
              min={MIN_TICKS_PER_SECOND}
              max={MAX_TICKS_PER_SECOND}
              step={1}
              value={tickText}
              onChange={(e) => {
                setTickText(e.target.value);
                const v = Number(e.target.value);
                if (e.target.value.trim() !== '' && isTicksPerSecond(v)) {
                  onChange({ ...preferences, ticksPerSecond: v });
                }
              }}
              // 使えない値のまま離れたら、今の値に戻す
              onBlur={() => setTickText(String(preferences.ticksPerSecond))}
            />
            {tickValid ? (
              <Field.HelperText>
                {m.preferences.ticksPerSecondHelp(DEFAULT_PREFERENCES.ticksPerSecond)}
              </Field.HelperText>
            ) : (
              <Field.ErrorText>
                {m.common.integerRange(MIN_TICKS_PER_SECOND, MAX_TICKS_PER_SECOND)}
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
              <Checkbox.Label>{m.preferences.showGrid}</Checkbox.Label>
            </Checkbox.Root>
            <Checkbox.Root
              checked={preferences.roundWires}
              onCheckedChange={(e) => onChange({ ...preferences, roundWires: e.checked === true })}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>{m.preferences.roundWires}</Checkbox.Label>
            </Checkbox.Root>
          </Stack>
          <Stack gap="1.5">
            <Text id="accent-label" textStyle="sm" fontWeight="medium">
              {m.preferences.accent}
            </Text>
            <HStack gap="2" role="group" aria-labelledby="accent-label">
              {ACCENT_PRESETS.map((p) => (
                <HintTooltip key={p.value} content={p.label[lang]}>
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
                    aria-label={p.label[lang]}
                    aria-pressed={preferences.accent === p.value}
                    onClick={() => onChange({ ...preferences, accent: p.value })}
                  />
                </HintTooltip>
              ))}
              {/* 用意した色以外も選べる */}
              <HintTooltip content={m.preferences.otherColor}>
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
                  aria-label={m.preferences.otherColor}
                  onChange={(e) => onChange({ ...preferences, accent: e.target.value })}
                />
              </HintTooltip>
            </HStack>
          </Stack>
        </Stack>
      </ChakraDialog.Body>
      <ChakraDialog.Footer>
        <Button ref={closeRef} onClick={onClose}>
          {m.common.close}
        </Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}
