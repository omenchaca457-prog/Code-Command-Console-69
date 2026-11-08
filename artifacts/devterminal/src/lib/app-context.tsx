import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface AppContextType {
  currentCode: string;
  setCurrentCode: (code: string) => void;
  currentLanguage: string;
  setCurrentLanguage: (lang: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [draft] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("devterminal-draft-v2") ?? "null");
      if (saved && typeof saved.code === "string" && typeof saved.language === "string") return saved as { code: string; language: string };
    } catch { /* Storage can be unavailable in private or embedded browsers. */ }
    return { code: 'console.log("¡Hola, DevTerminal!");', language: "javascript" };
  });
  const [currentCode, setCurrentCode] = useState<string>(draft.code);
  const [currentLanguage, setCurrentLanguage] = useState<string>(draft.language);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { localStorage.setItem("devterminal-draft-v2", JSON.stringify({ code: currentCode, language: currentLanguage })); }
      catch { /* Keep the editor usable if storage is full or unavailable. */ }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [currentCode, currentLanguage]);

  return (
    <AppContext.Provider value={{ currentCode, setCurrentCode, currentLanguage, setCurrentLanguage }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
