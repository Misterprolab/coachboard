import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Lang = 'it' | 'en';

interface I18nStore {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (it: string, en: string) => string;
}

export const useI18n = create<I18nStore>((set, get) => ({
  lang: 'it',
  setLang: async (lang) => {
    set({ lang });
    await AsyncStorage.setItem('lang', lang);
  },
  t: (it, en) => get().lang === 'it' ? it : en,
}));

export const initLang = async () => {
  const saved = await AsyncStorage.getItem('lang');
  if (saved === 'en' || saved === 'it') {
    useI18n.setState({ lang: saved });
  }
};
