import {
  Button,
  Dialog as ChakraDialog,
  Field,
  Input,
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
export function TextDialog({ request, onClose }: { request: TextRequest; onClose: () => void }) {
  const m = useMessages();
  const { field } = request;
  const [value, setValue] = useState(request.initial);
  const [fieldValue, setFieldValue] = useState(field?.initial ?? '');
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.select();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // 確定したあとの動きは 3 通り。エラーなら開いたままエラーを出す。
    // doneMessage があれば開いたまま結果を出す (書き出しの「コピー」)。どちらでもなければ閉じる
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
    <DialogFrame onClose={onClose} initialFocus={textRef} size="md" onSubmit={submit}>
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
          {request.readOnly ? m.common.close : m.common.cancel}
        </Button>
        <Button type="submit">{request.confirmLabel}</Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}
