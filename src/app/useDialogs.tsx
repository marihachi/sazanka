import { useState } from 'react';
import { AboutDialog } from './AboutDialog';
import { ConfirmDialog, type ConfirmRequest } from '../ui/ConfirmDialog';
import { PreferencesDialog } from '../preferences/PreferencesDialog';
import { PromptDialog, type PromptRequest } from '../ui/PromptDialog';
import { TextDialog, type TextRequest } from '../ui/TextDialog';
import type { Preferences } from '../preferences/preferences';
import { ModuleSettingsDialog } from '../modules/ModuleSettingsDialog';
import { SheetSettingsDialog } from '../sheet/SheetSettingsDialog';
import { findDef, type CircuitSheet, type Package, type Project } from '../circuit/project';

/**
 * 画面内のダイアログの開閉と、描く部分。
 * 開く関数と、どれかが開いているか (ショートカットを止めるため)、描く要素を返す
 */
export function useDialogs({
  initialMessage,
  preferences,
  onPreferencesChange,
  project,
  onApplyModuleSettings,
  onApplySheetSettings,
}: {
  /** 開いた直後に出すお知らせ (保存データが読めなかったときなど) */
  initialMessage?: string;
  preferences: Preferences;
  onPreferencesChange: (preferences: Preferences) => void;
  /** モジュール設定のダイアログで、設定するモジュールを探し、プレビューを描くのに使う */
  project: Project;
  /** モジュール設定を当てはめる (元に戻せる 1 回の編集にする) */
  onApplyModuleSettings: (
    id: string,
    pkg: Package,
    numbers: Map<string, number>,
    labels: Map<string, string>,
  ) => void;
  /** 回路 id のシートの大きさを当てはめる (元に戻せる 1 回の編集にする) */
  onApplySheetSettings: (id: string, sheet: CircuitSheet) => void;
}) {
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(() =>
    initialMessage ? { message: initialMessage } : null,
  );
  const [prompt, setPrompt] = useState<PromptRequest | null>(null);
  const [text, setText] = useState<TextRequest | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  /** モジュール設定のダイアログで設定しているモジュールの ID */
  const [moduleSettingsId, setModuleSettingsId] = useState<string | null>(null);
  const moduleSettingsDef = moduleSettingsId ? findDef(project, moduleSettingsId) : undefined;
  /** シート設定のダイアログで設定している回路の ID */
  const [sheetSettingsId, setSheetSettingsId] = useState<string | null>(null);
  const sheetSettingsDef = sheetSettingsId ? findDef(project, sheetSettingsId) : undefined;

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
      {moduleSettingsDef && (
        <ModuleSettingsDialog
          def={moduleSettingsDef}
          project={project}
          onApply={(pkg, numbers, labels) =>
            onApplyModuleSettings(moduleSettingsDef.id, pkg, numbers, labels)
          }
          onClose={() => setModuleSettingsId(null)}
        />
      )}
      {sheetSettingsDef && (
        <SheetSettingsDialog
          def={sheetSettingsDef}
          project={project}
          onApply={(sheet) => onApplySheetSettings(sheetSettingsDef.id, sheet)}
          onClose={() => setSheetSettingsId(null)}
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
    /** モジュール id のモジュール設定を開く */
    openModuleSettings: (id: string) => setModuleSettingsId(id),
    /** 回路 id のシート設定を開く */
    openSheetSettings: (id: string) => setSheetSettingsId(id),
    /** どれかのダイアログが開いているか */
    anyOpen:
      !!confirm ||
      !!prompt ||
      !!text ||
      aboutOpen ||
      preferencesOpen ||
      !!moduleSettingsDef ||
      !!sheetSettingsDef,
    element,
  };
}
