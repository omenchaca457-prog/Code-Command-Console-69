import { Link, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Command,
  Database,
  Grid3X3,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  Terminal,
  X,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NAV_GROUPS, WORKSPACE_MODULES } from "@/lib/workspace-navigation";
import { useWorkspaceStatus } from "@/lib/workspace-status";
import { useHealthCheck } from "@workspace/api-client-react";

const TOOLS_CENTER = {
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

function databaseStatusLabel(status: string) {
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

function formatReplicationLag(lagMs: number | null) {
  if (lagMs === null) return "—";
  return lagMs < 1_000 ? `${lagMs} ms` : `${(lagMs / 1_000).toFixed(1)} s`;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const path = location.split("?")[0].replace(/\/+$/, "") || "/";
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  const [collapsed, setCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const { data: status, isPending } = useWorkspaceStatus();
  const { data: apiHealth } = useHealthCheck();
  const [databaseHealth, setDatabaseHealth] = useState<DatabaseHealth | null>(null);
  const active = WORKSPACE_MODULES.find((item) => item.href === path);
  const activeLabel = active?.label ?? (
    path === "/settings"
      ? "Configuración"
      : path === TOOLS_CENTER.href
        ? TOOLS_CENTER.label
        : "Página no encontrada"
  );
  const online = status?.database === "connected";
  const databaseIndicatorClass = !databaseHealth
    ? "is-offline"
    : databaseHealth.primary === "unavailable" || databaseHealth.replica === "unavailable"
      ? "is-offline"
      : databaseHealth.primary === "ready" && databaseHealth.replica === "ready"
        ? "is-online"
        : "is-pending";

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => {
      setIsMobile(query.matches);
      if (!query.matches) setMobileOpen(false);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    document.title = `${activeLabel} · DevTerminal`;
    setMobileOpen(false);
  }, [path, activeLabel]);

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

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const sidebar = sidebarRef.current;
    const first = sidebar?.querySelector<HTMLElement>("a, button");
    first?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !sidebar) return;
      const elements = [
        ...sidebar.querySelectorAll<HTMLElement>("a, button"),
      ].filter((item) => item.getClientRects().length > 0);
      const firstElement = elements[0];
      const lastElement = elements.at(-1);
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };
    window.addEventListener("keydown", trapFocus);
    return () => {
      window.removeEventListener("keydown", trapFocus);
      mobileButtonRef.current?.focus();
    };
  }, [mobileOpen]);

  return (
    <div className={`workspace-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <a className="skip-link" href="#workspace-main">
        Saltar al contenido
      </a>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Cerrar navegación"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        inert={isMobile && !mobileOpen}
        className={`workspace-sidebar ${mobileOpen ? "is-open" : ""}`}
        aria-label="Navegación principal"
      >
        <div className="workspace-brand-row">
          <Link
            href="/"
            className="workspace-brand"
            aria-label="DevTerminal, inicio"
          >
            <span className="brand-mark">
              <Terminal size={21} strokeWidth={2.3} />
            </span>
            <span className="brand-wordmark">
              devterminal<span>COMMAND CONSOLE</span>
            </span>
          </Link>
          <button
            type="button"
            className="mobile-close icon-button"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-avatar">DT</span>
          <span className="workspace-switcher-copy">
            Mi workspace<small>Entorno de desarrollo</small>
          </span>
          <span className="workspace-local">LOCAL</span>
        </div>
        <nav className="workspace-nav">
          <Link
            href={TOOLS_CENTER.href}
            className={`workspace-nav-link tool-catalog-link ${path === TOOLS_CENTER.href ? "is-active" : ""}`}
            aria-current={path === TOOLS_CENTER.href ? "page" : undefined}
            title={collapsed ? TOOLS_CENTER.label : undefined}
          >
            <Grid3X3 size={17} strokeWidth={1.8} />
            <span>{TOOLS_CENTER.label}</span>
          </Link>
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group}>
              <span className="nav-group-label">{group}</span>
              {WORKSPACE_MODULES.filter((item) => item.group === group).map(
                ({ href, label, icon: Icon, badge }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`workspace-nav-link ${path === href ? "is-active" : ""}`}
                    aria-current={path === href ? "page" : undefined}
                    title={collapsed ? label : undefined}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    <span>{label}</span>
                    {badge && <small>{badge}</small>}
                  </Link>
                ),
              )}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link
            href="/settings"
            className={`workspace-nav-link ${path === "/settings" ? "is-active" : ""}`}
            title="Configuración"
          >
            <Settings2 size={17} />
            <span>Configuración</span>
          </Link>
          <div className="sidebar-connection">
            <span
              className={`status-dot ${online ? "is-online" : isPending ? "is-pending" : "is-offline"}`}
            />
            <span>
              {isPending
                ? "Conectando servicios"
                : online
                  ? "Servicios conectados"
                  : "Revisar conexión"}
            </span>
            <span className="version-tag">v2.0</span>
          </div>
        </div>
      </aside>
      <div className="workspace-body" inert={mobileOpen}>
        <header className="workspace-topbar">
          <div className="topbar-breadcrumb">
            <button
              className="icon-button desktop-collapse"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={
                collapsed ? "Expandir barra lateral" : "Contraer barra lateral"
              }
            >
              {collapsed ? (
                <PanelLeftOpen size={17} />
              ) : (
                <PanelLeftClose size={17} />
              )}
            </button>
            <button
              ref={mobileButtonRef}
              className="icon-button mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir navegación"
              aria-expanded={mobileOpen}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb-workspace">Workspace</span>
            <ChevronRight size={13} />
            <span>{activeLabel}</span>
          </div>
          <div className="topbar-actions">
            <button
              className="global-search"
              onClick={() => setPaletteOpen(true)}
              aria-label="Buscar módulos"
            >
              <Search size={15} />
              <span>Buscar módulos...</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="topbar-divider" />
            <span className="workspace-api-indicator" aria-label={apiHealth?.status === "ok" ? "API en línea" : "API no disponible"}>
              <span className={`status-dot ${apiHealth?.status === "ok" ? "is-online" : "is-offline"}`} />
              <span className="hidden sm:inline">API</span>
            </span>
            <details className="workspace-db-details">
              <summary
                aria-label="Estado de PostgreSQL primaria y réplica"
                className="workspace-db-summary"
              >
                <span className={`status-dot ${databaseIndicatorClass}`} />
                <Database size={14} />
                <span className="hidden sm:inline">DB</span>
              </summary>
              <section className="workspace-db-popover" aria-label="Salud de bases de datos">
                <h2>Salud PostgreSQL</h2>
                <dl>
                  <div><dt>Primaria Replit</dt><dd>{databaseStatusLabel(databaseHealth?.primary ?? "not_configured")}</dd></div>
                  <div><dt>Réplica Neon</dt><dd>{databaseStatusLabel(databaseHealth?.replica ?? "not_configured")}</dd></div>
                  <div><dt>Replicación</dt><dd>{databaseStatusLabel(databaseHealth?.replication.state ?? "uninitialized")}</dd></div>
                  <div className="workspace-db-metrics">
                    <span>Lag: <strong>{formatReplicationLag(databaseHealth?.replication.lagMs ?? null)}</strong></span>
                    <span>Cola: <strong>{databaseHealth?.replication.pending ?? "—"}</strong></span>
                    <span>Fallidos: <strong>{databaseHealth?.replication.failed ?? "—"}</strong></span>
                    <span>Último éxito: <strong>{databaseHealth?.replication.lastSuccessAt ? new Date(databaseHealth.replication.lastSuccessAt).toLocaleTimeString() : "—"}</strong></span>
                  </div>
                  {databaseHealth?.replication.lastErrorCode && (
                    <div><dt>Último error</dt><dd>{databaseHealth.replication.lastErrorCode}</dd></div>
                  )}
                </dl>
                {!databaseHealth && <p>Estado sin verificar; la interfaz sigue disponible.</p>}
              </section>
            </details>
          </div>
        </header>
        <main id="workspace-main" className="workspace-main" tabIndex={-1}>
          {children}
        </main>
        <footer className="workspace-statusbar">
          <span>
            <span className={`status-dot ${online ? "is-online" : "is-offline"}`} />
            {online ? "Sistema conectado" : "Servicios no disponibles"}
          </span>
          <span className="statusbar-module">
            {activeLabel}
          </span>
          <button onClick={() => setPaletteOpen(true)}>
            <Command size={12} /> Paleta de comandos <kbd>Ctrl K</kbd>
          </button>
        </footer>
      </div>
      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="¿A dónde quieres ir?" />
        <CommandList>
          <CommandEmpty>No encontramos ese módulo.</CommandEmpty>
          {NAV_GROUPS.map((group) => (
            <CommandGroup key={group} heading={group}>
              {WORKSPACE_MODULES.filter((item) => item.group === group).map(
                ({ href, label, description, icon: Icon }) => (
                  <CommandItem
                    key={href}
                    value={`${label} ${description}`}
                    onSelect={() => {
                      navigate(href);
                      setPaletteOpen(false);
                    }}
                  >
                    <Icon size={17} />
                    <span>
                      {label}
                      <small className="command-description">
                        {description}
                      </small>
                    </span>
                    <ChevronRight className="ml-auto" size={14} />
                  </CommandItem>
                ),
              )}
            </CommandGroup>
          ))}
          <CommandGroup heading="Workspace">
            <CommandItem
              value={`${TOOLS_CENTER.label} catálogo módulos herramientas`}
              onSelect={() => {
                navigate(TOOLS_CENTER.href);
                setPaletteOpen(false);
              }}
            >
              <Grid3X3 size={17} />
              {TOOLS_CENTER.label}
            </CommandItem>
            <CommandItem
              onSelect={() => {
                navigate("/settings");
                setPaletteOpen(false);
              }}
            >
              <Settings2 size={17} />
              Configuración y conexiones
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
