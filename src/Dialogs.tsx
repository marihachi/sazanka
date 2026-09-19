import { useEffect, useRef } from 'react';

// ブラウザの prompt / confirm / alert は VS Code 内のブラウザなどで動かないため、画面内の UI で代替する

interface InlineInputProps {
  initial: string;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  /** Enter またはフォーカスが外れたときに呼ばれる */
  onCommit: (value: string) => void;
  /** Esc で呼ばれる */
  onCancel: () => void;
}

/** その場で文字を編集する入力欄。表示と同時にフォーカスし、全選択する */
export function InlineInput({ initial, className, style, placeholder, onCommit, onCancel }: InlineInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  // Enter で確定した直後の blur で二重に確定しないようにする
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  function finish(commit: boolean) {
    if (done.current) return;
    done.current = true;
    if (commit) onCommit(ref.current!.value);
    else onCancel();
  }

  return (
    <input
      ref={ref}
      className={className}
      style={style}
      defaultValue={initial}
      placeholder={placeholder}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      }}
      onBlur={() => finish(true)}
      onPointerDown={(e) => e.stopPropagation()}
    />
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

/** 画面内のモーダルダイアログ */
export function Dialog({ request, onClose }: { request: DialogRequest; onClose: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => confirmRef.current?.focus(), []);

  return (
    <div className="dialog-backdrop" onPointerDown={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <p>{request.message}</p>
        <div className="dialog-buttons">
          {request.onConfirm && <button onClick={onClose}>キャンセル</button>}
          <button
            ref={confirmRef}
            className={request.danger ? 'danger' : undefined}
            onClick={() => {
              onClose();
              request.onConfirm?.();
            }}
          >
            {request.onConfirm ? (request.confirmLabel ?? 'OK') : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
