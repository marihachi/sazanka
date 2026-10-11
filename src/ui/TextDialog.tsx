import {
  Button,
  Dialog as ChakraDialog,
  Field,
  HStack,
  Input,
  RadioGroup,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { useMessages } from '../i18n/useMessages';
import { DialogFrame } from './DialogFrame';

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
  /** 確定ボタンの左に並べるボタン (書き出しの「ファイルに保存」)。押すと今の文字列を渡す。閉じない */
  extraAction?: { label: string; onClick: (value: string) => void };
  /** 文字列の上に置く1行の入力欄 (書き出すときの作者名など) */
  field?: {
    label: string;
    initial: string;
    placeholder?: string;
    /** 入力が変わるたびに呼ばれる。文字列を返すと、下の複数行の文字列をそれに置き換える */
    onChange: (value: string) => string | undefined;
  };
  /**
   * 文字列のほかに、ファイルからも入力できるようにする (読み込み)。
   * ラジオボタンで入力元を選び、初めはファイルを選んでおく。ファイルのときは確定で onSubmit を呼ぶ
   */
  fileInput?: {
    /** ファイルを選ぶ画面で絞り込む種類 (input の accept) */
    accept: string;
    sourceLabel: string;
    fileLabel: string;
    textLabel: string;
    chooseLabel: string;
    /** まだファイルを選んでいないときに、ファイル名の代わりに出す文 */
    noFileLabel: string;
    /** 確定時の処理。エラーメッセージを返すとダイアログを閉じずに表示する */
    onSubmit: (file: File) => Promise<string | undefined>;
  };
}

type Source = 'file' | 'text';

/** 複数行の文字列を見せる・入力してもらう画面内のダイアログ */
export function TextDialog({ request, onClose }: { request: TextRequest; onClose: () => void }) {
  const m = useMessages();
  const { field, fileInput } = request;
  const [value, setValue] = useState(request.initial);
  const [fieldValue, setFieldValue] = useState(field?.initial ?? '');
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);
  const [source, setSource] = useState<Source>(fileInput ? 'file' : 'text');
  const [file, setFile] = useState<File | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 開いたときは、選んでいるラジオボタン (ファイル) にフォーカスする
  const sourceRef = useRef<HTMLInputElement>(null);
  const showFile = fileInput && source === 'file';
  /** 確定の処理 (onSubmit) を待っている間か */
  const submitting = useRef(false);

  useEffect(() => {
    textRef.current?.select();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // 確定の処理が終わるまでは、次の確定を受け付けない。ファイルを読む間に確定を連打すると、
    // 同じ読み込みが何度も行われ、元に戻す 1 回で戻らなくなるため
    if (submitting.current || (showFile && !file)) {
      return;
    }
    submitting.current = true;
    const error = showFile && file ? await fileInput.onSubmit(file) : await request.onSubmit(value);
    // 確定したあとの動きは 3 通り。エラーなら開いたままエラーを出す。
    // doneMessage があれば開いたまま結果を出す (書き出しの「コピー」)。どちらでもなければ閉じる。
    // 閉じるときは、閉じ終わるまでに届いた確定も受け付けないよう、submitting を戻さない
    if (error || request.doneMessage) {
      submitting.current = false;
    }
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
      initialFocus={fileInput ? sourceRef : textRef}
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
          {fileInput && (
            <RadioGroup.Root
              value={source}
              onValueChange={(e) => {
                setSource(e.value === 'text' ? 'text' : 'file');
                setStatus(null);
              }}
            >
              <HStack gap="4">
                <RadioGroup.Label>{fileInput.sourceLabel}</RadioGroup.Label>
                {(['file', 'text'] as const).map((s) => (
                  <RadioGroup.Item key={s} value={s}>
                    <RadioGroup.ItemHiddenInput ref={s === 'file' ? sourceRef : undefined} />
                    <RadioGroup.ItemIndicator />
                    <RadioGroup.ItemText>
                      {s === 'file' ? fileInput.fileLabel : fileInput.textLabel}
                    </RadioGroup.ItemText>
                  </RadioGroup.Item>
                ))}
              </HStack>
            </RadioGroup.Root>
          )}
          {showFile && (
            <HStack gap="3">
              {/* ブラウザ標準のファイルの入力は、ボタンの文字がブラウザの言語で出て表示言語と合わないので隠し、
                  ボタンから開く */}
              <input
                ref={fileInputRef}
                type="file"
                accept={fileInput.accept}
                hidden
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setStatus(null);
                }}
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                {fileInput.chooseLabel}
              </Button>
              <Text textStyle="sm" color={file ? undefined : 'fg.muted'} truncate minW="0">
                {file ? file.name : fileInput.noFileLabel}
              </Text>
            </HStack>
          )}
          {!showFile && (
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
          )}
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
          {request.readOnly ? m.common.close : m.common.cancel}
        </Button>
        {request.extraAction && (
          <Button
            onClick={() => {
              setStatus(null);
              request.extraAction?.onClick(value);
            }}
          >
            {request.extraAction.label}
          </Button>
        )}
        <Button type="submit" disabled={showFile && !file}>
          {request.confirmLabel}
        </Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}
