import { createContext, useContext, useState, ReactNode } from "react";

interface AppContextType {
  currentCode: string;
  setCurrentCode: (code: string) => void;
  currentLanguage: string;
  setCurrentLanguage: (lang: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentCode, setCurrentCode] = useState<string>('console.log("Hello, DevTerminal!");');
  const [currentLanguage, setCurrentLanguage] = useState<string>("javascript");

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
