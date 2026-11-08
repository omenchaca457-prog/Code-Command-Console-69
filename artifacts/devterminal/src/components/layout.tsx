import { Link, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Command,
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
  const active = WORKSPACE_MODULES.find((item) => item.href === path);
  const online = status?.database === "connected";

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
    document.title = `${active?.label ?? (path === "/settings" ? "Configuración" : "Página no encontrada")} · DevTerminal`;
    setMobileOpen(false);
  }, [path, active?.label]);

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
            <span>
              {active?.label ??
                (path === "/settings"
                  ? "Configuración"
                  : "Página no encontrada")}
            </span>
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
            <span className="profile-avatar" title="Workspace local">
              DT
            </span>
          </div>
        </header>
        <main id="workspace-main" className="workspace-main" tabIndex={-1}>
          {children}
        </main>
        <footer className="workspace-statusbar">
          <span>
            <span
              className={`status-dot ${online ? "is-online" : "is-offline"}`}
            />
            {online ? "Sistema conectado" : "Servicios no disponibles"}
          </span>
          <span className="statusbar-module">
            {active?.label ?? "Workspace"}
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
