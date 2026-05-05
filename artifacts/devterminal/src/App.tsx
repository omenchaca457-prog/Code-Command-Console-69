import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
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

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={TerminalPage} />
        <Route path="/editor" component={Home} />
        <Route path="/runner" component={Runner} />
        <Route path="/snippets" component={Snippets} />
        <Route path="/ai" component={AI} />
        <Route path="/tools" component={Tools} />
        <Route path="/neural" component={Neural} />
        <Route path="/agents" component={Agents} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
