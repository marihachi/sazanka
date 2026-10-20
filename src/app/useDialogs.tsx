import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { AboutDialog } from './AboutDialog';
import { ConfirmDialog, type ConfirmRequest } from '../ui/ConfirmDialog';
import { PreferencesDialog } from '../preferences/PreferencesDialog';
import { PromptDialog, type PromptRequest } from '../ui/PromptDialog';
import { TextDialog, type TextRequest } from '../ui/TextDialog';
import type { Preferences } from '../preferences/preferences';
import { CircuitSettingsDialog, type CircuitSettings } from '../modules/CircuitSettingsDialog';
import { findDef, type Project } from '../circuit/project';

/**
 * 画面内のダイアログの開閉と、描く部分。
 * 開く関数と、どれかが開いているか (ショートカットを止めるため)、描く要素を返す
 */
export function useDialogs({
  initialMessage,
  preferences,
  onPreferencesChange,
  project,
  onApplyCircuitSettings,
}: {
  /** 開いた直後に出すお知らせ (保存データが読めなかったときなど) */
  initialMessage?: string;
  preferences: Preferences;
  onPreferencesChange: (preferences: Preferences) => void;
  /** 回路設定のダイアログで、設定する回路を探し、プレビューを描くのに使う */
  project: Project;
  /** 回路 id に回路設定を当てはめる (元に戻せる 1 回の編集にする) */
  onApplyCircuitSettings: (id: string, settings: CircuitSettings) => void;
}) {
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(() =>
    initialMessage ? { message: initialMessage } : null,
  );
  const [prompt, setPrompt] = useState<PromptRequest | null>(null);
  const [text, setText] = useState<TextRequest | null>(null);
  /**
   * 入力のダイアログが閉じ終わったか。閉じた Chakra (zag) のダイアログは、開く前の要素へのフォーカスの返しを
   * setTimeout(0) で遅らせて行い、ほかのダイアログの中にフォーカスがあっても返してしまう。
   * そのあいだにお知らせを開くと、フォーカスを外へ取られて閉じてしまう (読み込みのあとのお知らせ)。
   * そのため、閉じてから 1 回待ち、フォーカスを返し終えてからお知らせを出す。
   * 出すときは flushSync で描き切る。描き切らないと、開発中の StrictMode が effect をやり直す (zag が
   * ダイアログを一度閉じて開き直す) のが、フォーカスを閉じ込め始めたあとになり、同じように閉じてしまう
   */
  const [inputClosed, setInputClosed] = useState(true);
  useEffect(() => {
    if (text || prompt) {
      setInputClosed(false);
      return;
    }
    const timer = setTimeout(() => flushSync(() => setInputClosed(true)), 0);
    return () => clearTimeout(timer);
  }, [text, prompt]);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  /** 回路設定のダイアログで設定している回路の ID */
  const [circuitSettingsId, setCircuitSettingsId] = useState<string | null>(null);
  const circuitSettingsDef = circuitSettingsId ? findDef(project, circuitSettingsId) : undefined;

  const element = (
    <>
      {/* お知らせは、ほかのダイアログが閉じ終わってから出す (上の inputClosed)。閉じるダイアログと
          入れ替わりに開くと、閉じた方のフォーカスの返しで外へフォーカスを取られ、一緒に閉じてしまう
          (読み込みのあとのお知らせなど) */}
      {confirm && !text && !prompt && inputClosed && (
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
      {circuitSettingsDef && (
        <CircuitSettingsDialog
          def={circuitSettingsDef}
          project={project}
          onApply={(settings) => onApplyCircuitSettings(circuitSettingsDef.id, settings)}
          onClose={() => setCircuitSettingsId(null)}
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
    /** 回路 id の回路設定を開く */
    openCircuitSettings: (id: string) => setCircuitSettingsId(id),
    /** どれかのダイアログが開いているか */
    anyOpen:
      !!confirm || !!prompt || !!text || aboutOpen || preferencesOpen || !!circuitSettingsDef,
    element,
  };
}
