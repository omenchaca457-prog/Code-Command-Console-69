import { Link, useLocation } from "wouter";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Grid3X3,
  Menu,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useHealthCheck } from "@workspace/api-client-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toolModules } from "@/lib/tool-directory";

const TOOL_CENTER = {
  href: "/tools-center",
  label: "Todas las herramientas",
};

type DatabaseHealth = {
  primary: "ready" | "unavailable" | "not_configured" | "invalid_configuration";
  replica: "ready" | "not_initialized" | "unavailable" | "not_configured" | "invalid_configuration";
  replication: {
    state: "active" | "disabled" | "uninitialized" | "degraded" | "migration_pending" | "rebaseline_required";
    enabled: boolean;
    pending: number;
    failed: number;
    lagMs: number | null;
    lastSuccessAt: string | null;
    lastErrorCode: string | null;
  };
};

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    ready: "Conectada",
    unavailable: "No disponible",
    not_configured: "No configurada",
    not_initialized: "Sin inicializar",
    active: "Activa",
    disabled: "Desactivada",
    uninitialized: "Pendiente de inicializar",
    degraded: "Degradada",
    migration_pending: "Migraciones pendientes",
    invalid_configuration: "Configuración inválida",
    rebaseline_required: "Requiere reconciliación",
  };
  return labels[status] ?? "Sin verificar";
}

function formatLag(lagMs: number | null): string {
  if (lagMs === null) return "—";
  if (lagMs < 1_000) return `${lagMs} ms`;
  return `${(lagMs / 1_000).toFixed(1)} s`;
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeLocation = location === "/" ? "/" : location.replace(/\/+$/, "");
  const { data: health } = useHealthCheck();
  const [databaseHealth, setDatabaseHealth] = useState<DatabaseHealth | null>(null);
  const defaultTitle = useRef(document.title);

  const groups = useMemo(
    () => [...new Set(toolModules.map((module) => module.category))].map((category) => ({
      category,
      modules: toolModules.filter((module) => module.category === category),
    })),
    [],
  );

  useEffect(() => {
    if (activeLocation === "/trading") {
      document.title = "MÁQUINA 4105 // TRADING";
    } else if (activeLocation === "/tools-center") {
      document.title = "DEVTERMINAL — Todas las herramientas";
    } else {
      document.title = defaultTitle.current;
    }
  }, [activeLocation]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch("/api/replication/status", { cache: "no-store" });
        if (!response.ok) throw new Error("Database status unavailable");
        const result = await response.json() as DatabaseHealth;
        if (!cancelled) setDatabaseHealth(result);
      } catch {
        if (!cancelled) setDatabaseHealth(null);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const renderDesktopLink = (
    item: typeof toolModules[number] | typeof TOOL_CENTER,
    collapsed: boolean,
  ) => {
    const isCatalog = item.href === TOOL_CENTER.href;
    const Icon = isCatalog ? Grid3X3 : "icon" in item ? item.icon : undefined;
    const color = isCatalog ? "#00ffff" : "color" in item ? item.color : "#00ffff";
    const active = activeLocation === item.href;
    if (!Icon) return null;

    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-11 items-center gap-3 rounded-sm border px-3 font-mono text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffff] ${
          collapsed ? "justify-center px-2" : ""
        } ${
          active
            ? "bg-white/[0.04] text-white"
            : "border-transparent text-[#a2a2a2] hover:bg-white/[0.035] hover:text-white"
        }`}
        style={{
          borderColor: active ? `${color}60` : "transparent",
          color: active ? color : undefined,
          backgroundColor: active ? `${color}0c` : undefined,
        }}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[#080808] text-foreground screen-flicker">
      <aside
        className={`hidden min-h-0 shrink-0 flex-col border-r border-[#ff003c]/15 bg-[#060606] transition-[width] duration-200 lg:flex ${
          sidebarCollapsed ? "w-[76px]" : "w-60"
        }`}
      >
        <div className={`flex h-14 shrink-0 items-center border-b border-[#ff003c]/15 px-3 ${sidebarCollapsed ? "justify-center" : "justify-between"}`}>
          <Link href="/" className="flex min-w-0 items-center gap-2 font-mono text-xs font-bold tracking-[0.18em] text-[#ff003c]">
            <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!sidebarCollapsed && <span className="truncate">DEVTERMINAL</span>}
          </Link>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={sidebarCollapsed ? "Expandir menú lateral" : "Plegar menú lateral"}
            title={sidebarCollapsed ? "Expandir menú" : "Plegar menú"}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-[#999] hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffff] ${sidebarCollapsed ? "mt-1" : ""}`}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav aria-label="Navegación principal" className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-3">
          <div className="space-y-1">
            {renderDesktopLink(TOOL_CENTER, sidebarCollapsed)}
          </div>
          {groups.map(({ category, modules }) => (
            <section key={category} className="space-y-1">
              {!sidebarCollapsed && (
                <h2 className="px-3 pb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-[#656565]">
                  {category}
                </h2>
              )}
              {modules.map((module) => renderDesktopLink(module, sidebarCollapsed))}
            </section>
          ))}
        </nav>

        {!sidebarCollapsed && (
          <div className="border-t border-[#222] px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#666]">
            12 módulos · workspace local
          </div>
        )}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-[#ff003c]/20 bg-[#060606] px-3 sm:px-5">
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgba(255,0,60,0.05),transparent_60%)]" />
          <div className="relative z-10 flex min-w-0 items-center gap-2 sm:gap-4">
            <Link href="/" className="flex shrink-0 items-center gap-2 font-mono text-xs font-bold tracking-[0.16em] text-[#ff003c] lg:hidden">
              <Eye className="h-4 w-4" aria-hidden="true" />
              <span className="hidden xs:inline">DEVTERMINAL</span>
            </Link>
            <span className="hidden h-5 w-px bg-[#ff003c]/20 lg:block" />
            <span className="truncate font-mono text-xs uppercase tracking-wider text-[#c8c8c8] sm:text-sm">
              {activeLocation === "/tools-center"
                ? "Todas las herramientas"
                : toolModules.find((module) => module.href === activeLocation)?.label ?? "Terminal"}
            </span>
          </div>

          <div className="relative z-10 flex shrink-0 items-center gap-2 sm:gap-4">
            <div
              className={`flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest ${
                health?.status === "ok" ? "text-[#00ff41]/80" : "text-[#ff003c]/80"
              }`}
              aria-label={health?.status === "ok" ? "API en línea" : "API no disponible"}
            >
              <span className={`h-2 w-2 rounded-full ${health?.status === "ok" ? "bg-[#00ff41]" : "bg-[#ff003c]"}`} />
              <span className="hidden sm:inline">{health?.status === "ok" ? "API ONLINE" : "API OFFLINE"}</span>
            </div>

            <details className="relative">
              <summary
                aria-label="Estado de PostgreSQL primaria y réplica"
                className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-2 border border-[#00ffff]/25 px-2 font-mono text-[10px] uppercase tracking-wider text-[#a9faff] hover:bg-[#00ffff]/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffff] [&::-webkit-details-marker]:hidden"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    databaseHealth?.primary === "ready"
                      ? "bg-[#00ff41]"
                      : databaseHealth?.primary === "unavailable"
                        ? "bg-[#ff003c]"
                        : "bg-[#777]"
                  }`}
                />
                <span>DB</span>
              </summary>
              <section
                aria-label="Salud de bases de datos"
                className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(88vw,340px)] border border-[#00ffff]/25 bg-[#080b0d] p-4 font-mono text-[11px] shadow-2xl shadow-black/80"
              >
                <h2 className="mb-3 text-[10px] uppercase tracking-[0.18em] text-[#00ffff]">
                  Salud PostgreSQL
                </h2>
                <dl className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#888]">Primaria Replit</dt>
                    <dd className={databaseHealth?.primary === "ready" ? "text-[#00ff41]" : "text-[#aaa]"}>
                      {statusLabel(databaseHealth?.primary ?? "not_configured")}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#888]">Réplica Neon</dt>
                    <dd className={databaseHealth?.replica === "ready" ? "text-[#00ff41]" : "text-[#aaa]"}>
                      {statusLabel(databaseHealth?.replica ?? "not_configured")}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#888]">Replicación</dt>
                    <dd className="text-[#d6d6d6]">
                      {statusLabel(databaseHealth?.replication.state ?? "uninitialized")}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-[#888]">
                    <span>Lag: <strong className="text-white">{formatLag(databaseHealth?.replication.lagMs ?? null)}</strong></span>
                    <span>Cola: <strong className="text-white">{databaseHealth?.replication.pending ?? "—"}</strong></span>
                    <span>Fallidos: <strong className="text-white">{databaseHealth?.replication.failed ?? "—"}</strong></span>
                    <span>
                      Último éxito:{" "}
                      <strong className="text-white">
                        {databaseHealth?.replication.lastSuccessAt
                          ? new Date(databaseHealth.replication.lastSuccessAt).toLocaleTimeString()
                          : "—"}
                      </strong>
                    </span>
                  </div>
                  {databaseHealth?.replication.lastErrorCode && (
                    <div className="border-t border-white/10 pt-3 text-[#888]">
                      Último error:{" "}
                      <strong className="break-all text-[#ff7777]">
                        {databaseHealth.replication.lastErrorCode}
                      </strong>
                    </div>
                  )}
                </dl>
                {!databaseHealth && (
                  <p className="mt-3 border-t border-white/10 pt-3 text-[#888]">
                    Estado sin verificar; la interfaz sigue disponible.
                  </p>
                )}
              </section>
            </details>

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menú de herramientas"
                className="flex min-h-11 min-w-11 items-center justify-center gap-2 border border-[#ff003c]/30 px-3 font-mono text-xs text-white hover:bg-[#ff003c]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffff] lg:hidden"
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">MENÚ</span>
              </button>
              <SheetContent side="left" className="flex h-[100dvh] w-[min(88vw,360px)] flex-col overflow-y-auto border-[#ff003c]/20 bg-[#080808] p-4 text-white">
                <SheetHeader className="mb-4 text-left">
                  <SheetTitle className="font-mono text-sm tracking-widest text-[#ff003c]">DEVTERMINAL</SheetTitle>
                  <SheetDescription className="text-xs text-[#888]">Navegación de módulos del workspace</SheetDescription>
                </SheetHeader>
                <nav aria-label="Menú móvil" className="min-h-0 flex-1 space-y-4 overflow-y-auto">
                  <Link
                    href={TOOL_CENTER.href}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={activeLocation === TOOL_CENTER.href ? "page" : undefined}
                    className={`flex min-h-12 items-center gap-3 border px-3 font-mono text-sm ${
                      activeLocation === TOOL_CENTER.href
                        ? "border-[#00ffff]/50 bg-[#00ffff]/10 text-[#9ff8ff]"
                        : "border-[#333] text-[#e5e5e5] hover:border-[#00ffff]/40"
                    }`}
                  >
                    <Grid3X3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Todas las herramientas</span>
                  </Link>
                  {groups.map(({ category, modules }) => (
                    <section key={category} className="space-y-1">
                      <h2 className="px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#666]">{category}</h2>
                      {modules.map(({ href, label, icon: Icon, color }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMobileMenuOpen(false)}
                          aria-current={activeLocation === href ? "page" : undefined}
                          className={`flex min-h-12 items-center gap-3 border border-transparent px-3 font-mono text-sm ${
                            activeLocation === href
                              ? "bg-white/[0.04] text-white"
                              : "text-[#aaa] hover:bg-white/[0.04] hover:text-white"
                          }`}
                          style={{ color: activeLocation === href ? color : undefined }}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{label}</span>
                        </Link>
                      ))}
                    </section>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
