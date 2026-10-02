import { useState } from 'react';
import { AboutDialog } from './AboutDialog';
import { ConfirmDialog, type ConfirmRequest } from '../ui/ConfirmDialog';
import { PreferencesDialog } from '../preferences/PreferencesDialog';
import { PromptDialog, type PromptRequest } from '../ui/PromptDialog';
import { TextDialog, type TextRequest } from '../ui/TextDialog';
import type { Preferences } from '../preferences/preferences';

/**
 * 画面内のダイアログの開閉と、描く部分。
 * 開く関数と、どれかが開いているか (ショートカットを止めるため)、描く要素を返す
 */
export function useDialogs({
  initialMessage,
  preferences,
  onPreferencesChange,
}: {
  /** 開いた直後に出すお知らせ (保存データが読めなかったときなど) */
  initialMessage?: string;
  preferences: Preferences;
  onPreferencesChange: (preferences: Preferences) => void;
}) {
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(() =>
    initialMessage ? { message: initialMessage } : null,
  );
  const [prompt, setPrompt] = useState<PromptRequest | null>(null);
  const [text, setText] = useState<TextRequest | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const element = (
    <>
      {/* お知らせは、ほかのダイアログが閉じてから出す。閉じるダイアログと入れ替わりに開くと、
          Chakra (zag) が後から開いた方を入れ子とみなして一緒に閉じてしまう (読み込みのあとのお知らせなど) */}
      {confirm && !text && !prompt && (
        <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      )}
      {prompt && <PromptDialog request={prompt} onClose={() => setPrompt(null)} />}
      {text && <TextDialog request={text} onClose={() => setText(null)} />}
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      {preferencesOpen && (
        <PreferencesDialog
          preferences={preferences}
          onChange={onPreferencesChange}
          onClose={() => setPreferencesOpen(false)}
        />
      )}
    </>
  );

  return {
    /** 確認かお知らせを出す */
    showConfirm: setConfirm,
    /** 文字を 1 つ入力してもらう */
    showPrompt: setPrompt,
    /** 複数行の文字列を見せる・入力してもらう */
    showText: setText,
    openAbout: () => setAboutOpen(true),
    openPreferences: () => setPreferencesOpen(true),
    /** どれかのダイアログが開いているか */
    anyOpen: !!confirm || !!prompt || !!text || aboutOpen || preferencesOpen,
    element,
  };
}
