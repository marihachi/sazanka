import { Button, Dialog as ChakraDialog, Field, Input } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { useMessages } from '../i18n/useMessages';
import { DialogFrame } from './DialogFrame';

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
  const m = useMessages();
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
          {m.common.cancel}
        </Button>
        <Button type="submit" disabled={touched && !!error}>
          {request.confirmLabel}
        </Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}
