import { useEffect, useRef, useState } from 'react';
import licenses from 'virtual:licenses';
import logo from '../assets/logo.svg';
import { MaskIcon } from './Icons';
import { classNames } from './classNames';
import styles from './Dialogs.module.css';
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
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  /** Enter またはフォーカスが外れたときに呼ばれる */
  onCommit: (value: string) => void;
  /** Esc で呼ばれる */
  onCancel: () => void;
}

/** その場で文字を編集する入力欄。表示と同時にフォーカスし、全選択する */
export function InlineInput({
  initial,
  className,
  style,
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

  function finish(commit: boolean) {
    if (done.current) return;
    done.current = true;
    if (commit) {
      onCommit(ref.current!.value);
    } else {
      onCancel();
    }
  }

  return (
    <input
      ref={ref}
      className={classNames(styles.inlineInput, className)}
      style={style}
      defaultValue={initial}
      placeholder={placeholder}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          finish(true);
        }
        if (e.key === 'Escape') {
          finish(false);
        }
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
export function Dialog({
  request,
  onClose,
}: {
  request: DialogRequest;
  onClose: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => confirmRef.current?.focus(), []);

  return (
    <div className={styles.dialogBackdrop} onPointerDown={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose();
          }
        }}
      >
        <p>{request.message}</p>
        <div className={styles.dialogButtons}>
          {request.onConfirm && <button onClick={onClose}>キャンセル</button>}
          <button
            ref={confirmRef}
            className={request.danger ? styles.danger : undefined}
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
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (error) return;
    onClose();
    request.onSubmit(value.trim());
  }

  return (
    <div className={styles.dialogBackdrop} onPointerDown={onClose}>
      <form
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-title"
        onSubmit={submit}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose();
          }
        }}
      >
        <h2 id="prompt-title">{request.title}</h2>
        <label className={styles.field}>
          <span>{request.label}</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setTouched(true);
            }}
          />
        </label>
        <p className={styles.fieldError}>{touched && error ? error : ' '}</p>
        <div className={styles.dialogButtons}>
          <button type="button" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="submit"
            className={styles.primary}
            disabled={touched && !!error}
          >
            {request.confirmLabel}
          </button>
        </div>
      </form>
    </div>
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
  const [value, setValue] = useState(request.initial);
  const [fieldValue, setFieldValue] = useState(request.field?.initial ?? '');
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(
    null,
  );
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
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
    <div className={styles.dialogBackdrop} onPointerDown={onClose}>
      <form
        className={classNames(styles.dialog, styles.wide)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="text-title"
        onSubmit={submit}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose();
          }
        }}
      >
        <h2 id="text-title">{request.title}</h2>
        <p>{request.message}</p>
        {request.field && (
          <label className={classNames(styles.field, styles.inline)}>
            <span>{request.field.label}</span>
            <input
              value={fieldValue}
              placeholder={request.field.placeholder}
              onChange={(e) => {
                setFieldValue(e.target.value);
                setStatus(null);
                const text = request.field!.onChange(e.target.value);
                if (text !== undefined) {
                  setValue(text);
                }
              }}
            />
          </label>
        )}
        <textarea
          ref={textRef}
          className={styles.text}
          value={value}
          readOnly={request.readOnly}
          spellCheck={false}
          onChange={(e) => {
            setValue(e.target.value);
            setStatus(null);
          }}
        />
        <p
          className={classNames(
            styles.fieldError,
            status && !status.error && styles.done,
          )}
        >
          {status?.text ?? ' '}
        </p>
        <div className={styles.dialogButtons}>
          <button type="button" onClick={onClose}>
            {request.readOnly ? '閉じる' : 'キャンセル'}
          </button>
          <button type="submit" className={styles.primary}>
            {request.confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

/** このアプリについての画面内ダイアログ */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);

  return (
    <div className={styles.dialogBackdrop} onPointerDown={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose();
          }
        }}
      >
        <h2 id="about-title" className={styles.aboutTitle}>
          <MaskIcon src={logo} className={styles.aboutLogo} />
          <span className="visually-hidden">sazanka について</span>
        </h2>
        <p className={styles.aboutText}>
          ブラウザで動く論理回路シミュレータです。
        </p>
        <ul className={styles.links}>
          <li>
            <a
              href="https://github.com/marihachi/sazanka"
              target="_blank"
              rel="noreferrer noopener"
            >
              GitHub リポジトリ
            </a>
          </li>
        </ul>
        <p className={styles.note}>
          MIT ライセンスで利用できます。ロゴには Inter SemiBold (SIL OFL)
          というフォントを使っています。
        </p>
        {/* 同梱しているライブラリのライセンス文。MIT などは配布物に含めることが条件なので、必ず表示する */}
        <details className={styles.licenses}>
          <summary>使用しているライブラリのライセンス</summary>
          {licenses.map((l) => (
            <details key={l.name} className={styles.license}>
              <summary>
                {l.name} {l.version} ({l.license})
              </summary>
              <pre>{l.text}</pre>
            </details>
          ))}
        </details>
        <div className={styles.dialogButtons}>
          <button ref={closeRef} className={styles.primary} onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
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
  useEffect(() => closeRef.current?.focus(), []);
  // 入力の途中 (空欄や範囲外) は反映せず、使える値になったときだけ反映する
  const [tickText, setTickText] = useState(String(preferences.tickMs));
  const tickValid = isTickMs(Number(tickText)) && tickText.trim() !== '';

  return (
    <div className={styles.dialogBackdrop} onPointerDown={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preferences-title"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose();
          }
        }}
      >
        <h2 id="preferences-title">環境設定</h2>
        <label className={styles.field}>
          <span>シミュレーションで 1 tick を進める間隔 (ms)</span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_TICK_MS}
            max={MAX_TICK_MS}
            step={1}
            value={tickText}
            aria-invalid={!tickValid}
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
        </label>
        <p className={classNames(styles.help, !tickValid && styles.invalid)}>
          {tickValid
            ? `大きくするとゆっくり進み、信号が 1 tick ずつ伝わる様子を目で追えます。既定は ${DEFAULT_PREFERENCES.tickMs} ms。CLOCK の周期 (秒) は、CLOCK ごとの tick 数 × この間隔です。`
            : `${MIN_TICK_MS}〜${MAX_TICK_MS} の整数で入力してください`}
        </p>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={preferences.showGrid}
            onChange={(e) =>
              onChange({ ...preferences, showGrid: e.target.checked })
            }
          />
          シートに方眼を表示する
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={preferences.roundWires}
            onChange={(e) =>
              onChange({ ...preferences, roundWires: e.target.checked })
            }
          />
          配線の角を丸める
        </label>
        <div className={styles.field}>
          <span id="accent-label">アクセントカラー</span>
          <div
            className={styles.swatches}
            role="group"
            aria-labelledby="accent-label"
          >
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={classNames(
                  styles.swatch,
                  preferences.accent === p.value && styles.current,
                )}
                style={{ background: p.value }}
                title={p.label}
                aria-label={p.label}
                aria-pressed={preferences.accent === p.value}
                onClick={() => onChange({ ...preferences, accent: p.value })}
              />
            ))}
            {/* 用意した色以外も選べる */}
            <input
              type="color"
              className={styles.colorInput}
              value={preferences.accent}
              title="ほかの色を選ぶ"
              aria-label="ほかの色を選ぶ"
              onChange={(e) =>
                onChange({ ...preferences, accent: e.target.value })
              }
            />
          </div>
        </div>
        <div className={styles.dialogButtons}>
          <button ref={closeRef} className={styles.primary} onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
