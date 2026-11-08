import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BrainCircuit,
  Bot,
  Code2,
  Cpu,
  LibrarySquare,
  Network,
  Play,
  ShieldAlert,
  Sparkles,
  TerminalSquare,
  TrendingUp,
} from "lucide-react";

export type ToolModule = {
  href: string;
  label: string;
  category: string;
  description: string;
  color: string;
  icon: LucideIcon;
};

export const toolModules: ToolModule[] = [
  {
    href: "/",
    label: "Terminal",
    category: "Desarrollo",
    description: "Terminal visual y conversación con SQ-AI.",
    color: "#ff003c",
    icon: TerminalSquare,
  },
  {
    href: "/runner",
    label: "Runner",
    category: "Desarrollo",
    description: "Paneles de código y acceso a tus snippets guardados.",
    color: "#00ff9c",
    icon: Play,
  },
  {
    href: "/editor",
    label: "Editor",
    category: "Desarrollo",
    description: "Edita, consulta y guarda código en la biblioteca.",
    color: "#ff6680",
    icon: Code2,
  },
  {
    href: "/snippets",
    label: "Biblioteca",
    category: "Desarrollo",
    description: "Consulta y organiza los snippets guardados.",
    color: "#ff9f43",
    icon: LibrarySquare,
  },
  {
    href: "/ai",
    label: "Asistente IA",
    category: "Inteligencia",
    description: "Chat y asistencia de IA.",
    color: "#00ffff",
    icon: Cpu,
  },
  {
    href: "/neural",
    label: "Neural",
    category: "Inteligencia",
    description: "Eventos y telemetría neural del sistema.",
    color: "#00ffff",
    icon: Network,
  },
  {
    href: "/agents",
    label: "Agentes",
    category: "Inteligencia",
    description: "Estado y actividad de los agentes.",
    color: "#a78bfa",
    icon: Bot,
  },
  {
    href: "/cortex",
    label: "Cortex",
    category: "Inteligencia",
    description: "Interfaz del flujo de Cortex.",
    color: "#00ff41",
    icon: BrainCircuit,
  },
  {
    href: "/creator",
    label: "Creator",
    category: "Inteligencia",
    description: "Herramientas de creación disponibles.",
    color: "#ff4de1",
    icon: Sparkles,
  },
  {
    href: "/tools",
    label: "Herramientas",
    category: "Sistema",
    description: "Utilidades y herramientas del workspace.",
    color: "#ff6680",
    icon: ShieldAlert,
  },
  {
    href: "/motor",
    label: "Motor 4105",
    category: "Sistema",
    description: "Simulador y telemetría del Motor 5.5.",
    color: "#00f0ff",
    icon: Activity,
  },
  {
    href: "/trading",
    label: "Máquina 4105",
    category: "Sistema",
    description: "Monitor de solo lectura del bot Python existente.",
    color: "#00f0ff",
    icon: TrendingUp,
  },
];

export const toolCategories = [
  "Todas",
  ...Array.from(new Set(toolModules.map((module) => module.category))),
];
