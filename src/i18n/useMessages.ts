import { createContext, useContext } from 'react';
import type { Language } from './language';
import { type Messages, getMessages } from './messages';

/** 画面に出す言語。画面全体の外側で渡す */
export const LanguageContext = createContext<Language>('ja');

/** 画面に出す言語 */
export function useLanguage(): Language {
  return useContext(LanguageContext);
}

/** 画面に出す言語の文言の表 */
export function useMessages(): Messages {
  return getMessages(useLanguage());
}
