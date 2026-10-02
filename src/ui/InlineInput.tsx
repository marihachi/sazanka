import { Input } from '@chakra-ui/react';
import { useEffect, useRef } from 'react';

interface InlineInputProps {
  initial: string;
  placeholder?: string;
  /** Enter またはフォーカスが外れたときに呼ばれる */
  onCommit: (value: string) => void;
  /** Esc で呼ばれる */
  onCancel: () => void;
}

/** その場で文字を編集する入力欄。表示と同時にフォーカスし、全選択する */
export function InlineInput({ initial, placeholder, onCommit, onCancel }: InlineInputProps) {
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
