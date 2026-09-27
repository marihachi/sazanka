import {
  Button,
  Checkbox,
  chakra,
  Dialog as ChakraDialog,
  Field,
  HStack,
  Input,
  Link,
  Portal,
  Stack,
  Text,
  Textarea,
  VisuallyHidden,
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import logo from '../assets/logo.svg';
import { MaskIcon } from './Icons';
import {
  ACCENT_PRESETS,
  DEFAULT_PREFERENCES,
  isTickMs,
  MAX_TICK_MS,
  MIN_TICK_MS,
  type Preferences,
} from './preferences';

// ブラウザの prompt / confirm / alert は VS Code 内のブラウザなどで動かないため、画面内の UI で代替する

interface InlineInputProps {
  initial: string;
  placeholder?: string;
  /** Enter またはフォーカスが外れたときに呼ばれる */
  onCommit: (value: string) => void;
  /** Esc で呼ばれる */
  onCancel: () => void;
}

/** その場で文字を編集する入力欄。表示と同時にフォーカスし、全選択する */
export function InlineInput({
  initial,
  placeholder,
  onCommit,
  onCancel,
}: InlineInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  // Enter で確定した直後の blur で二重に確定しないようにする
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  /** value は確定するときの入力欄の値 (取り消すときは使わない) */
  function finish(commit: boolean, value: string) {
    if (done.current) {
      return;
    }
    done.current = true;
    if (commit) {
      onCommit(value);
    } else {
      onCancel();
    }
  }

  return (
    <Input
      ref={ref}
      size="xs"
      defaultValue={initial}
      placeholder={placeholder}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          finish(true, e.currentTarget.value);
        }
        if (e.key === 'Escape') {
          finish(false, e.currentTarget.value);
        }
      }}
      onBlur={(e) => finish(true, e.currentTarget.value)}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}

/**
 * ダイアログの外枠 (Chakra の Dialog)。Esc と外側のクリックで閉じ、開いている間はフォーカスを中に閉じ込める。
 * 開くかどうかは呼び出し側が、このコンポーネントを置くかどうかで決める
 */
function DialogFrame({
  onClose,
  initialFocus,
  role = 'dialog',
  size = 'sm',
  onSubmit,
  children,
}: {
  onClose: () => void;
  /** 開いたときにフォーカスする要素 */
  initialFocus: React.RefObject<HTMLElement | null>;
  role?: 'dialog' | 'alertdialog';
  size?: 'sm' | 'md';
  /** 渡すと中身を form にして、Enter で送信できるようにする */
  onSubmit?: (e: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <ChakraDialog.Root
      open
      onOpenChange={(e) => {
        if (!e.open) {
          onClose();
        }
      }}
      role={role}
      size={size}
      placement="center"
      initialFocusEl={() => initialFocus.current}
    >
      <Portal>
        <ChakraDialog.Backdrop />
        <ChakraDialog.Positioner>
          {onSubmit ? (
            <ChakraDialog.Content asChild>
              <form onSubmit={onSubmit}>{children}</form>
            </ChakraDialog.Content>
          ) : (
            <ChakraDialog.Content>{children}</ChakraDialog.Content>
          )}
        </ChakraDialog.Positioner>
      </Portal>
    </ChakraDialog.Root>
  );
}

export interface DialogRequest {
  message: string;
  /** 確定ボタンの文言。onConfirm がなければ「OK」だけのお知らせになる */
  confirmLabel?: string;
  /** 確定すると取り返しのつかない操作か (ボタンを赤くする) */
  danger?: boolean;
  onConfirm?: () => void;
}

/** 画面内のモーダルダイアログ (確認とお知らせ) */
export function Dialog({
  request,
  onClose,
}: {
  request: DialogRequest;
  onClose: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  return (
    <DialogFrame
      onClose={onClose}
      initialFocus={confirmRef}
      role={request.onConfirm ? 'alertdialog' : 'dialog'}
    >
      <ChakraDialog.Body pt="6">
        <Text>{request.message}</Text>
      </ChakraDialog.Body>
      <ChakraDialog.Footer>
        {request.onConfirm && (
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
        )}
        <Button
          ref={confirmRef}
          colorPalette={request.danger ? 'red' : undefined}
          onClick={() => {
            onClose();
            request.onConfirm?.();
          }}
        >
          {request.onConfirm ? (request.confirmLabel ?? 'OK') : 'OK'}
        </Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}

export interface PromptRequest {
  title: string;
  label: string;
  initial: string;
  confirmLabel: string;
  /** 入力値に問題があればエラーメッセージを返す */
  validate?: (value: string) => string | undefined;
  onSubmit: (value: string) => void;
}

/** 文字を1つ入力してもらう画面内のダイアログ */
export function PromptDialog({
  request,
  onClose,
}: {
  request: PromptRequest;
  onClose: () => void;
}) {
  const [value, setValue] = useState(request.initial);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const error = request.validate?.(value.trim());

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (error) {
      return;
    }
    onClose();
    request.onSubmit(value.trim());
  }

  return (
    <DialogFrame onClose={onClose} initialFocus={inputRef} onSubmit={submit}>
      <ChakraDialog.Header>
        <ChakraDialog.Title>{request.title}</ChakraDialog.Title>
      </ChakraDialog.Header>
      <ChakraDialog.Body>
        <Field.Root invalid={touched && !!error}>
          <Field.Label>{request.label}</Field.Label>
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setTouched(true);
            }}
          />
          <Field.ErrorText>{error}</Field.ErrorText>
        </Field.Root>
      </ChakraDialog.Body>
      <ChakraDialog.Footer>
        <Button variant="outline" onClick={onClose}>
          キャンセル
        </Button>
        <Button type="submit" disabled={touched && !!error}>
          {request.confirmLabel}
        </Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}

export interface TextRequest {
  title: string;
  message: string;
  initial: string;
  /** 表示するだけで編集させない (書き出した文字列を見せるときなど) */
  readOnly?: boolean;
  confirmLabel: string;
  /** 確定時の処理。エラーメッセージを返すとダイアログを閉じずに表示する */
  onSubmit: (value: string) => string | undefined | Promise<string | undefined>;
  /** 成功しても閉じずに、このメッセージを表示する */
  doneMessage?: string;
  /** 文字列の上に置く1行の入力欄 (書き出すときの作者名など) */
  field?: {
    label: string;
    initial: string;
    placeholder?: string;
    /** 入力が変わるたびに呼ばれる。文字列を返すと、下の複数行の文字列をそれに置き換える */
    onChange: (value: string) => string | undefined;
  };
}

/** 複数行の文字列を見せる・入力してもらう画面内のダイアログ */
export function TextDialog({
  request,
  onClose,
}: {
  request: TextRequest;
  onClose: () => void;
}) {
  const { field } = request;
  const [value, setValue] = useState(request.initial);
  const [fieldValue, setFieldValue] = useState(field?.initial ?? '');
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(
    null,
  );
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.select();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const error = await request.onSubmit(value);
    if (error) {
      setStatus({ error: true, text: error });
    } else if (request.doneMessage) {
      setStatus({ error: false, text: request.doneMessage });
    } else {
      onClose();
    }
  }

  return (
    // 複数行の文字列を読みやすくするため、少し広くする
    <DialogFrame
      onClose={onClose}
      initialFocus={textRef}
      size="md"
      onSubmit={submit}
    >
      <ChakraDialog.Header>
        <ChakraDialog.Title>{request.title}</ChakraDialog.Title>
      </ChakraDialog.Header>
      <ChakraDialog.Body>
        <Stack gap="4">
          <Text>{request.message}</Text>
          {field && (
            <Field.Root>
              <Field.Label>{field.label}</Field.Label>
              <Input
                value={fieldValue}
                placeholder={field.placeholder}
                onChange={(e) => {
                  setFieldValue(e.target.value);
                  setStatus(null);
                  const text = field.onChange(e.target.value);
                  if (text !== undefined) {
                    setValue(text);
                  }
                }}
              />
            </Field.Root>
          )}
          <Textarea
            ref={textRef}
            value={value}
            readOnly={request.readOnly}
            spellCheck={false}
            h="40"
            fontFamily="mono"
            fontSize="xs"
            resize="vertical"
            onChange={(e) => {
              setValue(e.target.value);
              setStatus(null);
            }}
          />
          {status && (
            <Text
              textStyle="sm"
              color={status.error ? 'fg.error' : 'accent.fg'}
              role={status.error ? 'alert' : 'status'}
            >
              {status.text}
            </Text>
          )}
        </Stack>
      </ChakraDialog.Body>
      <ChakraDialog.Footer>
        <Button variant="outline" onClick={onClose}>
          {request.readOnly ? '閉じる' : 'キャンセル'}
        </Button>
        <Button type="submit">{request.confirmLabel}</Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}

/** このアプリについての画面内ダイアログ */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  return (
    <DialogFrame onClose={onClose} initialFocus={closeRef}>
      <ChakraDialog.Header justifyContent="center" pt="8">
        <ChakraDialog.Title display="flex">
          <MaskIcon src={logo} w="153px" h="42px" bg="var(--brand)" />
          <VisuallyHidden>sazanka について</VisuallyHidden>
        </ChakraDialog.Title>
      </ChakraDialog.Header>
      <ChakraDialog.Body>
        <Stack gap="4" align="center" textAlign="center">
          <Text>ブラウザで動く論理回路シミュレータです。</Text>
          <Stack as="ul" gap="1" listStyleType="none">
            <li>
              <Link
                href="https://github.com/marihachi/sazanka"
                target="_blank"
                rel="noreferrer noopener"
                colorPalette="accent"
                variant="underline"
              >
                GitHub リポジトリ
              </Link>
            </li>
            <li>
              {/* 同梱しているライブラリのライセンス文。MIT などは配布物に含めることが条件なので、必ず置く (ビルドで書き出す) */}
              <Link
                href={`${import.meta.env.BASE_URL}licenses.txt`}
                target="_blank"
                rel="noreferrer noopener"
                colorPalette="accent"
                variant="underline"
              >
                使用しているライブラリのライセンス
              </Link>
            </li>
          </Stack>
          <Text textStyle="xs" color="fg.muted">
            MIT ライセンスで利用できます。ロゴには Inter SemiBold (SIL OFL)
            というフォントを使っています。
          </Text>
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
            <Field.Label>
              シミュレーションで 1 tick を進める間隔 (ms)
            </Field.Label>
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
              onCheckedChange={(e) =>
                onChange({ ...preferences, showGrid: e.checked === true })
              }
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>シートに方眼を表示する</Checkbox.Label>
            </Checkbox.Root>
            <Checkbox.Root
              checked={preferences.roundWires}
              onCheckedChange={(e) =>
                onChange({ ...preferences, roundWires: e.checked === true })
              }
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
                <chakra.button
                  key={p.value}
                  type="button"
                  boxSize="6"
                  rounded="full"
                  cursor="pointer"
                  style={{ background: p.value }}
                  // 今の色は、文字色の輪で囲む
                  outline={
                    preferences.accent === p.value ? '2px solid' : 'none'
                  }
                  outlineColor="fg"
                  outlineOffset="2px"
                  _focusVisible={{ outline: '2px solid', outlineColor: 'fg' }}
                  title={p.label}
                  aria-label={p.label}
                  aria-pressed={preferences.accent === p.value}
                  onClick={() => onChange({ ...preferences, accent: p.value })}
                />
              ))}
              {/* 用意した色以外も選べる */}
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
                title="ほかの色を選ぶ"
                aria-label="ほかの色を選ぶ"
                onChange={(e) =>
                  onChange({ ...preferences, accent: e.target.value })
                }
              />
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
