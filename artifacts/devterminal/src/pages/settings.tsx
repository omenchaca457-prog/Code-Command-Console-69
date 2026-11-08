import { useState } from "react";
import {
  Check,
  CheckCircle2,
  CircleAlert,
  Database,
  KeyRound,
  Monitor,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import { useWorkspaceStatus } from "@/lib/workspace-status";

export default function Settings() {
  const { data, isPending, isFetching, refetch } = useWorkspaceStatus();
  const [copied, setCopied] = useState(false);
  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText("DEEPSEEK_API_KEY");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="overview-page">
      <div className="settings-inner">
        <div className="page-heading">
          <div>
            <div className="eyebrow">TU WORKSPACE, A TU MANERA</div>
            <h1>
              Configuración<span>.</span>
            </h1>
            <p>Conexiones claras. Un entorno listo para crear.</p>
          </div>
          <button
            className="button-secondary"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            Comprobar
          </button>
        </div>
        <section className="settings-card">
          <div className="settings-section-heading">
            <Server size={19} />
            <div>
              <h2>Estado del entorno</h2>
              <p>Información observada en el servidor.</p>
            </div>
          </div>
          <div className="settings-status-grid">
            <div>
              <span>
                <Database size={15} />
                Base de datos
              </span>
              <strong
                className={
                  data?.database === "connected" ? "text-lime" : "text-amber"
                }
              >
                {isPending
                  ? "Comprobando…"
                  : data?.database === "connected"
                    ? "Conectada"
                    : "No disponible"}
              </strong>
            </div>
            <div>
              <span>
                <Monitor size={15} />
                Node.js
              </span>
              <strong>{data?.node ?? "No disponible"}</strong>
            </div>
            <div>
              <span>
                <CheckCircle2 size={15} />
                Servidor activo
              </span>
              <strong>
                {data ? `${Math.floor(data.uptime / 60)} min` : "No disponible"}
              </strong>
            </div>
          </div>
        </section>
        <section className="settings-card">
          <div className="settings-section-heading">
            <KeyRound size={19} />
            <div>
              <h2>Proveedores e integraciones</h2>
              <p>
                Las credenciales se configuran exclusivamente en el servidor.
              </p>
            </div>
          </div>
          <div className="integration-list">
            {(
              data?.integrations ?? [
                { id: "deepseek", name: "DeepSeek", configured: false },
                { id: "openai", name: "OpenAI", configured: false },
                { id: "gemini", name: "Gemini", configured: false },
                { id: "storage", name: "App Storage", configured: false },
              ]
            ).map((item) => (
              <div className="integration-row" key={item.id}>
                <span className={`provider-mark provider-${item.id}`}>
                  {item.id === "deepseek"
                    ? "D"
                    : item.id === "openai"
                      ? "O"
                      : item.id === "gemini"
                        ? "G"
                        : "S"}
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.id === "deepseek"
                      ? "Asistente de desarrollo y terminal inteligente"
                      : item.id === "openai"
                        ? "Orquestación, análisis y generación de imágenes"
                        : item.id === "gemini"
                          ? "Análisis de contexto"
                          : "Almacenamiento de imágenes en Replit"}
                  </small>
                </div>
                <span
                  className={`integration-badge ${data && item.configured ? "is-configured" : ""}`}
                >
                  {data && item.configured ? (
                    <Check size={12} />
                  ) : (
                    <CircleAlert size={12} />
                  )}
                  {data
                    ? item.configured
                      ? "Configurado"
                      : "Sin configurar"
                    : "No comprobado"}
                </span>
              </div>
            ))}
          </div>
          <div className="settings-note">
            <ShieldCheck size={18} />
            <div>
              <strong>Tus claves permanecen en el servidor</strong>
              <p>
                El navegador solo consulta si existe una credencial. No recibe
                ni guarda su valor. Un proveedor configurado todavía requiere
                una clave válida y acceso a su API.
              </p>
            </div>
          </div>
        </section>
        <section className="settings-card deepseek-setup">
          <span className="provider-mark provider-deepseek">D</span>
          <div>
            <h2>Conecta DeepSeek</h2>
            <p>
              Configura la variable <code>DEEPSEEK_API_KEY</code> en el entorno
              del servidor y reinicia la aplicación. El asistente utiliza la
              integración original del proyecto.
            </p>
          </div>
          <button
            className="button-secondary"
            onClick={() => void copyCommand()}
          >
            {copied ? <Check size={14} /> : <KeyRound size={14} />}
            {copied ? "Copiado" : "Copiar variable"}
          </button>
        </section>
        <p className="settings-footnote">
          Las funciones de editor, biblioteca, terminal y simulador pueden
          utilizarse sin una clave de IA.
        </p>
      </div>
    </div>
  );
}
