import { Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState, type ComponentType } from "react";
import NotFound from "@/pages/not-found";
import TerminalPage from "@/pages/terminal";
import Home from "@/pages/home";
import Snippets from "@/pages/snippets";
import AI from "@/pages/ai";
import Tools from "@/pages/tools";
import Runner from "@/pages/runner";
import Neural from "@/pages/neural";
import Agents from "@/pages/agents";
import { Layout } from "@/components/layout";
import { AppProvider } from "@/lib/app-context";
import { NeuralProvider } from "@/lib/neural-context";

const queryClient = new QueryClient();

const PERSISTENT_PAGES: Array<{ path: string; Component: ComponentType }> = [
  { path: "/", Component: TerminalPage },
  { path: "/editor", Component: Home },
  { path: "/runner", Component: Runner },
  { path: "/snippets", Component: Snippets },
  { path: "/ai", Component: AI },
  { path: "/tools", Component: Tools },
  { path: "/neural", Component: Neural },
  { path: "/agents", Component: Agents },
];

function normalizePath(path: string) {
  const normalized = path.replace(/\/+$/, "");
  return normalized || "/";
}

function PersistentPages() {
  const [location] = useLocation();
  const currentPath = normalizePath(location);
  const [visitedPaths, setVisitedPaths] = useState(() => new Set([currentPath]));

  useEffect(() => {
    setVisitedPaths((visited) => {
      if (visited.has(currentPath)) return visited;
      const next = new Set(visited);
      next.add(currentPath);
      return next;
    });
  }, [currentPath]);

  const isKnownPath = PERSISTENT_PAGES.some(({ path }) => path === currentPath);

  return (
    <div className="relative h-full w-full">
      {PERSISTENT_PAGES.map(({ path, Component }) => {
        const isActive = currentPath === path;
        if (!isActive && !visitedPaths.has(path)) return null;

        return (
          <div
            key={path}
            aria-hidden={!isActive}
            className={`absolute inset-0 transition-opacity duration-150 ${
              isActive
                ? "z-10 visible opacity-100"
                : "invisible pointer-events-none opacity-0"
            }`}
          >
            <Component />
          </div>
        );
      })}

      {!isKnownPath && (
        <div className="absolute inset-0 z-10">
          <NotFound />
        </div>
      )}
    </div>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    const report = (message: string) => {
      void fetch("/api/diagnostics/webview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.slice(0, 500) }),
        keepalive: true,
      }).catch(() => undefined);
    };
    const onError = (event: ErrorEvent) => report(`window.error: ${event.message}`);
    const onRejection = (event: PromiseRejectionEvent) =>
      report(`unhandledrejection: ${String(event.reason).slice(0, 400)}`);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NeuralProvider>
         <AppProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Layout>
                  <PersistentPages />
                </Layout>
          </WouterRouter>
          <Toaster />
         </AppProvider>
        </NeuralProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
