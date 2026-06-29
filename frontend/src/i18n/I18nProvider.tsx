import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import es from "./es";
import en from "./en";

export type Language = "es" | "en";

const KEY = "app_lang_v1";

const translations: Record<Language, typeof es> = { es, en };

type Ctx = {
  lang: Language;
  setLang: (l: Language) => void;
  toggleLang: () => void;
  t: typeof es;
};

const I18nContext = createContext<Ctx>({
  lang: "es",
  setLang: () => {},
  toggleLang: () => {},
  t: es,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("es");
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(KEY);
        if (v === "es" || v === "en") {
          setLangState(v);
        }
      } catch {}
      loaded.current = true;
    })();
  }, []);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "es" ? "en" : "es");
  }, [lang, setLang]);

  const t = translations[lang];

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t }),
    [lang, setLang, toggleLang, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useT() {
  const { t } = useContext(I18nContext);
  return useCallback(
    (keyPath: string): string => {
      const keys = keyPath.split(".");
      let result: any = t;
      for (const k of keys) {
        if (result == null) return keyPath;
        result = result[k];
      }
      return result ?? keyPath;
    },
    [t]
  );
}
