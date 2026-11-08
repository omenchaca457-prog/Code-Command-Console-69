import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Code2,
  Command,
  Cpu,
  FileCode2,
  FolderCode,
  Library,
  Plus,
  Radio,
  RefreshCw,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { useListSnippets } from "@workspace/api-client-react";
import { useAppContext } from "@/lib/app-context";
import { useNeuralContext } from "@/lib/neural-context";
import { useWorkspaceStatus } from "@/lib/workspace-status";
import { WORKSPACE_MODULES } from "@/lib/workspace-navigation";

const EXAMPLE = `# Tu próxima idea empieza aquí.\nfrom datetime import datetime\n\ndef crear_algo_increible():\n    ahora = datetime.now().strftime("%H:%M")\n    print(f"DevTerminal listo a las {ahora}")\n    print("Escribe. Ejecuta. Construye.")\n\ncrear_algo_increible()\n`;

function timeAgo(date: string) {
  const seconds = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return "Sin fecha";
  if (seconds < 60) return "Ahora";
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
  return new Date(date).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
}

export default function Overview() {
  const [, navigate] = useLocation();
  const { setCurrentCode, setCurrentLanguage } = useAppContext();
  const { events, streamStatus } = useNeuralContext();
  const {
    data: status,
    isPending: checking,
    refetch,
    isFetching,
  } = useWorkspaceStatus();
  const {
    data,
    isPending: loadingSnippets,
    isError: snippetsError,
  } = useListSnippets();
  const snippets = Array.isArray(data) ? data : [];
  const [eventFilter, setEventFilter] = useState("all");
  const [downloaded, setDownloaded] = useState(false);
  const connected = status?.database === "connected";
  const providers =
    status?.integrations.filter((item) => item.id !== "storage") ?? [];
  const configuredProviders = providers.filter(
    (item) => item.configured,
  ).length;
  const visibleEvents = events
    .filter((event) => eventFilter === "all" || event.origin === eventFilter)
    .slice(0, 4);
  const recent = [...snippets]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 4);

  const openExample = () => {
    setCurrentCode(EXAMPLE);
    setCurrentLanguage("python");
    navigate("/editor");
  };
  const exportLibrary = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(snippets, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "devterminal-biblioteca.json";
    link.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 2000);
  };

  return (
    <div className="overview-page">
      <div className="overview-inner">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="small-spark">✳</span> TU ESPACIO PARA CONSTRUIR
            </div>
            <h1>
              Todo listo para tu próxima idea<span>.</span>
            </h1>
            <p>Tu código, tus herramientas y tu IA. En un solo lugar.</p>
          </div>
          <button
            className="button-secondary heading-refresh"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>

        <section className="welcome-panel" aria-label="Empieza a construir">
          <div className="welcome-copy">
            <span className="release-pill">
              <span /> DEVTERMINAL 2.0 <ChevronRight size={12} />
            </span>
            <h2>
              Menos fricción.
              <br />
              <span>Más creación.</span>
            </h2>
            <p>
              De la primera línea a la siguiente gran idea.
              <br className="desktop-break" /> Un workspace que sigue tu ritmo.
            </p>
            <div className="welcome-actions">
              <button className="button-primary" onClick={openExample}>
                <Plus size={16} />
                Crear un script
                <ArrowUpRight size={15} />
              </button>
              <Link className="welcome-terminal" href="/terminal">
                <Terminal size={16} />
                Abrir terminal
                <ArrowRight size={14} />
              </Link>
            </div>
            <div className="welcome-footnote">
              <CheckCircle2 size={13} /> Editor, biblioteca y herramientas disponibles.
            </div>
          </div>
          <div className="code-scene" aria-hidden="true">
            <div className="code-scene-orbit" />
            <div className="code-window">
              <div className="code-window-top">
                <div className="window-dots">
                  <i />
                  <i />
                  <i />
                </div>
                <span>
                  <FileCode2 size={12} /> hello_world.py
                </span>
                <span>Python</span>
              </div>
              <div className="code-window-body">
                <div>
                  <i>01</i>
                  <span className="syntax-comment">
                    # Cada gran idea empieza con una línea
                  </span>
                </div>
                <div>
                  <i>02</i>
                  <span>
                    <b>def</b> <em>construir</em>(idea):
                  </span>
                </div>
                <div>
                  <i>03</i>
                  <span>
                    {" "}
                    <b>return</b> idea + <strong>" ✨"</strong>
                  </span>
                </div>
                <div>
                  <i>04</i>
                  <span>&nbsp;</span>
                </div>
                <div>
                  <i>05</i>
                  <span>
                    resultado = <em>construir</em>(
                    <strong>"Hola, mundo"</strong>)
                  </span>
                </div>
                <div>
                  <i>06</i>
                  <span>
                    <em>print</em>(resultado)
                    <span className="code-caret" />
                  </span>
                </div>
              </div>
              <div className="code-window-bottom">
                <span>
                  <span className="status-dot is-pending" /> Código de ejemplo
                </span>
                <span>UTF-8</span>
              </div>
            </div>
            <div className="floating-code-tag">
              <Braces size={17} />
              <span>
                De idea a código<strong>Sin cambiar de contexto</strong>
              </span>
              <span className="floating-check">
                <Check size={13} />
              </span>
            </div>
          </div>
        </section>

        <section
          className="workspace-metrics"
          aria-label="Estado del workspace"
        >
          <div className="metric">
            <div className="metric-icon metric-lime">
              <FolderCode size={19} />
            </div>
            <div>
              <span>Biblioteca</span>
              <strong>
                {loadingSnippets
                  ? "—"
                  : snippetsError
                    ? "N/D"
                    : snippets.length}
                <small>snippets guardados</small>
              </strong>
            </div>
            <Link href="/snippets" aria-label="Ver biblioteca">
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="metric">
            <div className="metric-icon metric-violet">
              <Cpu size={19} />
            </div>
            <div>
              <span>Inteligencia artificial</span>
              <strong>
                {checking || !status ? "—" : configuredProviders}
                <small>
                  de {providers.length || 3} proveedores configurados
                </small>
              </strong>
            </div>
            <Link href="/settings" aria-label="Ver proveedores de IA">
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="metric">
            <div className="metric-icon metric-blue">
              <Command size={19} />
            </div>
            <div>
              <span>Tu caja de herramientas</span>
              <strong>
                {WORKSPACE_MODULES.length - 1}
                <small>módulos disponibles</small>
              </strong>
            </div>
            <Link href="/tools" aria-label="Ver herramientas">
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="metric">
            <div
              className={`metric-icon ${connected ? "metric-lime" : "metric-amber"}`}
            >
              <Radio size={19} />
            </div>
            <div>
              <span>Estado del sistema</span>
              <strong className="metric-status">
                {checking
                  ? "Conectando"
                  : connected
                    ? "Operativo"
                    : "Sin conexión"}
                <small>
                  {connected
                    ? "Servidor y base de datos"
                    : "Revisa tus servicios"}
                </small>
              </strong>
            </div>
            <span
              className={`status-dot ${connected ? "is-online" : "is-pending"}`}
            />
          </div>
        </section>

        <section
          className="quick-access-section"
          aria-labelledby="quick-access-title"
        >
          <div className="section-heading">
            <h2 id="quick-access-title">¿Qué vamos a construir?</h2>
            <span>Elige por dónde empezar</span>
          </div>
          <div className="quick-access-grid">
            <Link href="/editor" className="quick-card">
              <div className="quick-card-top">
                <span className="quick-icon metric-lime">
                  <Code2 size={23} />
                </span>
                <ArrowUpRight size={18} />
              </div>
              <h3>Editor de código</h3>
              <p>
                Un espacio para escribir, guardar
                <br />y dar forma a tus ideas.
              </p>
              <span className="quick-card-link">
                Empezar a programar
                <ArrowRight size={14} />
              </span>
              <span className="quick-card-bg">&lt;/&gt;</span>
            </Link>
            <Link href="/terminal" className="quick-card">
              <div className="quick-card-top">
                <span className="quick-icon metric-blue">
                  <Terminal size={23} />
                </span>
                <ArrowUpRight size={18} />
              </div>
              <h3>Tu terminal, sin límites</h3>
              <p>
                Consola inteligente e historial;
                <br />
                la shell espera aislamiento seguro.
              </p>
              <span className="quick-card-link">
                Abrir una sesión
                <ArrowRight size={14} />
              </span>
              <span className="quick-card-bg">&gt;_</span>
            </Link>
            <Link href="/ai" className="quick-card">
              <div className="quick-card-top">
                <span className="quick-icon metric-violet">
                  <Sparkles size={23} />
                </span>
                <span className="subtle-tag">DEEPSEEK</span>
              </div>
              <h3>Una segunda perspectiva</h3>
              <p>
                Pregunta, explora y resuelve
                <br />
                con tu asistente de desarrollo.
              </p>
              <span className="quick-card-link">
                Conversar con IA
                <ArrowRight size={14} />
              </span>
              <span className="quick-card-bg">✳</span>
            </Link>
          </div>
        </section>

        <div className="overview-bottom-grid">
          <section className="dashboard-panel recent-panel">
            <div className="panel-heading">
              <h2>
                <Library size={16} />
                Tus snippets recientes
              </h2>
              <Link href="/snippets">
                Ver biblioteca
                <ArrowRight size={13} />
              </Link>
            </div>
            {loadingSnippets ? (
              <div className="dashboard-empty">
                <RefreshCw size={22} className="animate-spin" />
                <p>Cargando biblioteca…</p>
              </div>
            ) : snippetsError ? (
              <div className="dashboard-empty">
                <CircleHelp size={25} />
                <h3>La biblioteca no está disponible</h3>
                <p>Comprueba la conexión en Configuración.</p>
                <Link href="/settings" className="text-action">
                  Revisar conexión
                  <ArrowRight size={13} />
                </Link>
              </div>
            ) : recent.length ? (
              <>
                <div className="snippet-table-labels">
                  <span>ARCHIVO</span>
                  <span>ÚLTIMA EDICIÓN</span>
                </div>
                <div className="recent-list">
                  {recent.map((snippet) => (
                    <Link
                      className="recent-snippet"
                      href={`/runner?snippetId=${snippet.id}`}
                      key={snippet.id}
                    >
                      <span
                        className={`file-icon language-${snippet.language}`}
                      >
                        <FileCode2 size={18} />
                      </span>
                      <span className="recent-snippet-title">
                        {snippet.title}
                        <small>{snippet.language}</small>
                      </span>
                      <time dateTime={snippet.updatedAt}>
                        {timeAgo(snippet.updatedAt)}
                      </time>
                      <ArrowUpRight size={15} />
                    </Link>
                  ))}
                </div>
                <button className="export-library" onClick={exportLibrary}>
                  {downloaded ? (
                    <Check size={13} />
                  ) : (
                    <ArrowDownToLine size={13} />
                  )}
                  {downloaded ? "Biblioteca exportada" : "Exportar biblioteca"}
                </button>
              </>
            ) : (
              <div className="dashboard-empty">
                <div className="empty-code-icon">
                  <FolderCode size={26} />
                </div>
                <h3>Aquí vivirán tus próximas ideas</h3>
                <p>
                  Guarda un script desde el editor
                  <br />y retómalo cuando quieras.
                </p>
                <Link href="/editor" className="text-action">
                  Crear mi primer snippet
                  <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </section>
          <section className="dashboard-panel activity-panel">
            <div className="panel-heading">
              <h2>
                <Activity size={16} />
                Actividad del workspace
              </h2>
              <span className="live-indicator">
                <span
                  className={`status-dot ${streamStatus === "connected" ? "is-online" : "is-pending"}`}
                />
                {streamStatus === "connected" ? "EN VIVO" : "CONECTANDO"}
              </span>
            </div>
            <div className="activity-filters">
              {[
                { id: "all", label: "Todo" },
                { id: "runner", label: "Ejecuciones" },
                { id: "agents", label: "Agentes" },
              ].map((filter) => (
                <button
                  key={filter.id}
                  className={eventFilter === filter.id ? "is-selected" : ""}
                  onClick={() => setEventFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="activity-list">
              {visibleEvents.length ? (
                visibleEvents.map((event) => (
                  <div className="activity-row" key={event.id}>
                    <span
                      className={`activity-event-icon ${event.origin === "runner" ? "metric-lime" : "metric-blue"}`}
                    >
                      {event.origin === "runner" ? (
                        <Code2 size={14} />
                      ) : (
                        <Zap size={14} />
                      )}
                    </span>
                    <div>
                      <strong>{event.eventType.replaceAll("_", " ")}</strong>
                      <p title={event.content}>{event.content}</p>
                    </div>
                    <time dateTime={event.createdAt}>
                      {timeAgo(event.createdAt)}
                    </time>
                  </div>
                ))
              ) : (
                <div className="dashboard-empty activity-empty">
                  <Activity size={25} />
                  <h3>
                    {eventFilter === "all"
                      ? "Un nuevo comienzo"
                      : "Sin actividad en este filtro"}
                  </h3>
                  <p>
                    Los eventos aparecerán aquí
                    <br />
                    mientras usas tus herramientas.
                  </p>
                </div>
              )}
            </div>
            <Link className="panel-bottom-link" href="/neural">
              Explorar red neuronal
              <ArrowUpRight size={13} />
            </Link>
          </section>
        </div>
        <div className="overview-tip">
          <span>
            <Command size={14} />
            <strong>Todo, a un atajo de distancia.</strong> Busca cualquier
            módulo con <kbd>Ctrl</kbd>
            <kbd>K</kbd>
          </span>
          <span>
            Hecho para el siguiente paso
            <Braces size={15} />
          </span>
        </div>
      </div>
    </div>
  );
}
