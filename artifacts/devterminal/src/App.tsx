import { Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import NotFound from "@/pages/not-found";
import Overview from "@/pages/overview";
import Settings from "@/pages/settings";
import { Layout } from "@/components/layout";
import { PageBoundary } from "@/components/page-boundary";
import { AppProvider } from "@/lib/app-context";
import { NeuralProvider } from "@/lib/neural-context";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

const TerminalPage = lazy(() => import("@/pages/terminal"));
const Home = lazy(() => import("@/pages/home"));
const Snippets = lazy(() => import("@/pages/snippets"));
const AI = lazy(() => import("@/pages/ai"));
const Tools = lazy(() => import("@/pages/tools"));
const Runner = lazy(() => import("@/pages/runner"));
const Neural = lazy(() => import("@/pages/neural"));
const Agents = lazy(() => import("@/pages/agents"));
const Cortex = lazy(() => import("@/pages/cortex"));
const Creator = lazy(() => import("@/pages/creator"));
const CoherenceSimulator = lazy(() => import("@/pages/coherence-simulator"));
const Trading = lazy(() => import("@/pages/trading"));
const ToolsDirectory = lazy(() => import("@/pages/tools-center"));

const PERSISTENT_PAGES: Array<{ path: string; Component: ComponentType }> = [
  { path: "/", Component: Overview },
  { path: "/terminal", Component: TerminalPage },
  { path: "/settings", Component: Settings },
  { path: "/tools-center", Component: ToolsDirectory },
  { path: "/editor", Component: Home },
  { path: "/runner", Component: Runner },
  { path: "/snippets", Component: Snippets },
  { path: "/ai", Component: AI },
  { path: "/tools", Component: Tools },
  { path: "/neural", Component: Neural },
  { path: "/agents", Component: Agents },
  { path: "/cortex", Component: Cortex },
  { path: "/creator", Component: Creator },
  { path: "/motor", Component: CoherenceSimulator },
  { path: "/trading", Component: Trading },
];

function normalizePath(path: string) {
  const normalized = path.split(/[?#]/, 1)[0].replace(/\/+$/, "");
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
            inert={!isActive}
            className={`absolute inset-0 transition-opacity duration-150 ${path !== "/" && path !== "/settings" ? "legacy-page" : ""} ${
              isActive
                ? "z-10 visible opacity-100"
                : "invisible pointer-events-none opacity-0"
            }`}
          >
            <PageBoundary>
              <Suspense fallback={<div className="module-loading" role="status"><span className="module-loading-spinner" />Abriendo módulo…</div>}><Component /></Suspense>
            </PageBoundary>
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
