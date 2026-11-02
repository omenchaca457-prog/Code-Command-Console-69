import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BrainCircuit,
  Bot,
  ChevronLeft,
  ChevronRight,
  Code2,
  Command,
  Cpu,
  Layers3,
  Library,
  Menu,
  Network,
  Play,
  Search,
  Shield,
  Sparkles,
  TerminalSquare,
  TrendingUp,
  X,
} from "lucide-react";

const modules = [
  { name: "Terminal", route: "/terminal", category: "Desarrollo", icon: TerminalSquare, color: "#ff315c", description: "Tu línea directa con el entorno." },
  { name: "Runner", route: "/runner", category: "Desarrollo", icon: Play, color: "#ff315c", description: "Ejecuta y revisa tus procesos." },
  { name: "Editor", route: "/editor", category: "Desarrollo", icon: Code2, color: "#ff315c", description: "Escribe código. Mantén el flujo." },
  { name: "Asistente IA", route: "/ai", category: "Inteligencia", icon: Cpu, color: "#b693ff", description: "Una interfaz para pensar en voz alta." },
  { name: "Biblioteca", route: "/snippets", category: "Desarrollo", icon: Library, color: "#ff315c", description: "Fragmentos listos para volver a usar." },
  { name: "Neural", route: "/neural", category: "Inteligencia", icon: Network, color: "#36e7df", description: "Explora conexiones y señales." },
  { name: "Agentes", route: "/agents", category: "Inteligencia", icon: Bot, color: "#b693ff", description: "Coordina agentes de trabajo." },
  { name: "Herramientas", route: "/tools", category: "Sistema", icon: Shield, color: "#f4c85b", description: "Un espacio para tus utilidades." },
  { name: "Cortex", route: "/cortex", category: "Inteligencia", icon: BrainCircuit, color: "#36e7df", description: "Conecta ideas y capacidades." },
  { name: "Motor 4105", route: "/motor", category: "Sistema", icon: Activity, color: "#f4c85b", description: "Abre el motor 4105." },
  { name: "Creator", route: "/creator", category: "Creación", icon: Sparkles, color: "#ff83ca", description: "Dale forma a lo que tienes en mente." },
  { name: "Máquina 4105", route: "/trading", category: "Sistema", icon: TrendingUp, color: "#f4c85b", description: "Entra a Máquina 4105." },
];

const categories = ["Todas", "Desarrollo", "Inteligencia", "Sistema", "Creación"];

export function Dashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const filtered = useMemo(() => modules.filter((item) => {
    const matchesQuery = `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (category === "Todas" || item.category === category);
  }), [query, category]);
  const featured = modules.filter((item) => ["Terminal", "Editor", "Asistente IA", "Runner"].includes(item.name));

  const sidebar = (
    <aside className={`${collapsed ? "md:w-[76px]" : "md:w-[238px]"} fixed inset-y-0 left-0 z-40 flex w-[286px] flex-col border-r border-[#243037] bg-[#0b1013] transition-[width,transform] duration-300 md:relative md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex h-[76px] items-center gap-3 border-b border-[#243037] px-5">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center border border-[#ff315c]/60 bg-[#ff315c]/10 text-[#ff315c]">
          <Command size={18} strokeWidth={2.2} />
          <span className="absolute -right-1 -top-1 h-2 w-2 bg-[#ff315c]" />
        </div>
        {!collapsed && <div className="min-w-0"><p className="font-mono text-[10px] tracking-[.2em] text-[#819095]">CC / WORKSPACE</p><p className="mt-1 truncate text-[14px] font-bold tracking-[.02em] text-[#e9f0ed]">Code Command</p></div>}
        <button aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} className="ml-auto rounded-md p-2 text-[#91a0a3] hover:bg-white/5 md:hidden"><X size={18} /></button>
      </div>
      <div className="px-3 pt-6">
        {!collapsed && <p className="mb-3 px-3 font-mono text-[9px] font-semibold tracking-[.2em] text-[#627176]">ESPACIO DE TRABAJO</p>}
        <a href="/terminal" onClick={() => setMobileOpen(false)} className="group flex min-h-[48px] items-center gap-3 border border-[#ff315c]/30 bg-[#ff315c]/[.09] px-3 text-[#ff6681] shadow-[inset_2px_0_0_#ff315c]">
          <Layers3 size={17} className="shrink-0" />
          {!collapsed && <><span className="flex-1 text-[13px] font-semibold">Vista general</span><span className="font-mono text-[9px] tracking-widest text-[#ff6681]/70">HOME</span></>}
        </a>
      </div>
      <div className="mt-7 px-3">
        {!collapsed && <p className="mb-3 px-3 font-mono text-[9px] font-semibold tracking-[.2em] text-[#627176]">MÓDULOS</p>}
        <nav className="space-y-1" aria-label="Módulos">
          {modules.map(({ name, route, icon: Icon, color }) => (
            <a key={route} href={route} onClick={() => setMobileOpen(false)} title={collapsed ? name : undefined} className="flex min-h-[44px] items-center gap-3 rounded-sm px-3 text-[#93a0a3] transition-colors hover:bg-white/[.045] hover:text-[#e9f0ed]">
              <Icon size={17} className="shrink-0" style={{ color }} />
              {!collapsed && <span className="truncate text-[12px]">{name}</span>}
              {!collapsed && <ArrowUpRight size={13} className="ml-auto opacity-0 transition-opacity group-hover:opacity-60" />}
            </a>
          ))}
        </nav>
      </div>
      <div className="mt-auto border-t border-[#243037] p-3">
        <button onClick={() => setCollapsed((value) => !value)} className="hidden min-h-[44px] w-full items-center justify-center gap-2 rounded-sm text-[#7e8b8f] hover:bg-white/[.04] hover:text-[#dfe7e3] md:flex" aria-label={collapsed ? "Expandir menú" : "Contraer menú"}>
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span className="text-[11px]">Contraer menú</span></>}
        </button>
        {!collapsed && <div className="px-3 pb-2 pt-3 font-mono text-[9px] tracking-[.16em] text-[#536166]">CODE COMMAND CONSOLE</div>}
      </div>
    </aside>
  );

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#101619] text-[#e9f0ed] [font-family:ui-sans-serif,system-ui,sans-serif]">
      <div className="flex min-h-[100dvh]">
        {sidebar}
        {mobileOpen && <button aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/65 md:hidden" />}
        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#243037] bg-[#101619]/95 px-4 backdrop-blur-md sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setMobileOpen(true)} aria-label="Abrir menú" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#2d3b40] text-[#c4ceca] hover:border-[#ff315c]/50 hover:text-[#ff6681] md:hidden"><Menu size={19} /></button>
              <div className="hidden h-8 w-8 items-center justify-center border border-[#2d3b40] text-[#ff496a] sm:flex"><Command size={16} /></div>
              <div className="min-w-0"><p className="font-mono text-[9px] tracking-[.2em] text-[#78878b]">CONSOLE / WORKSPACE</p><h1 className="truncate text-[14px] font-semibold tracking-wide sm:text-[15px]">Vista general</h1></div>
            </div>
            <a href="/tools" className="flex min-h-[42px] items-center gap-2 border border-[#2d3b40] px-3 text-[11px] font-medium text-[#aebbb8] transition hover:border-[#ff315c]/50 hover:text-[#ff8295] sm:px-4"><span className="hidden sm:inline">Todas las herramientas</span><span className="sm:hidden">Catálogo</span><ArrowUpRight size={14} /></a>
          </header>
          <div className="mx-auto w-full max-w-[1420px] px-4 pb-16 pt-8 sm:px-7 sm:pt-10 lg:px-10">
            <section className="relative overflow-hidden border border-[#28363b] bg-[#141d21] px-5 py-7 sm:px-9 sm:py-9">
              <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[45%] opacity-60 sm:block" style={{ backgroundImage: "linear-gradient(90deg, #141d21 4%, transparent 75%), linear-gradient(rgba(71,96,99,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(71,96,99,.14) 1px, transparent 1px)", backgroundSize: "100% 100%, 28px 28px, 28px 28px" }} />
              <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border border-[#ff315c]/10 sm:right-[12%]"><div className="absolute inset-8 rounded-full border border-[#ff315c]/15" /><div className="absolute inset-16 rounded-full border border-[#ff315c]/20" /></div>
              <div className="relative max-w-[700px]">
                <p className="mb-4 flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[.22em] text-[#ff607a]"><span className="h-px w-6 bg-[#ff315c]" />TU ESPACIO DE DESARROLLO</p>
                <h2 className="max-w-[630px] text-[32px] font-semibold leading-[1.05] tracking-[-.045em] sm:text-[46px]">Todo tu entorno.<br /><span className="text-[#8d9b9d]">Una sola consola.</span></h2>
                <p className="mt-5 max-w-[470px] text-[13px] leading-6 text-[#a0aeac] sm:text-[14px]">Accede directamente a cada módulo de Code Command y continúa justo donde empieza tu siguiente idea.</p>
                <a href="/terminal" className="mt-7 inline-flex min-h-[48px] items-center gap-3 bg-[#ff315c] px-5 text-[12px] font-bold tracking-wide text-[#19080c] transition hover:bg-[#ff5576]"><TerminalSquare size={16} />Abrir Terminal<ArrowUpRight size={15} /></a>
              </div>
              <div className="absolute bottom-4 right-5 hidden font-mono text-[9px] tracking-[.18em] text-[#708084] lg:block">CC / MODULE DIRECTORY</div>
            </section>

            <section className="mt-10 sm:mt-12">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div><p className="font-mono text-[9px] tracking-[.22em] text-[#718084]">ACCESO DIRECTO</p><h2 className="mt-2 text-[20px] font-semibold tracking-[-.02em]">Tus módulos</h2></div>
                <span className="font-mono text-[10px] tracking-wider text-[#657479]">SELECCIONA PARA ABRIR</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {featured.map(({ name, route, icon: Icon, color, description }) => (
                  <a key={route} href={route} className="group relative flex min-h-[154px] flex-col justify-between overflow-hidden border border-[#2a383c] bg-[#141d20] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#53666a] hover:bg-[#182326]">
                    <div className="pointer-events-none absolute -right-5 -top-8 h-24 w-24 rounded-full border opacity-15 transition-transform duration-300 group-hover:scale-125" style={{ borderColor: color }} />
                    <div className="flex items-start justify-between">
                      <span className="flex h-10 w-10 items-center justify-center border bg-[#0f171a]" style={{ borderColor: `${color}55`, color }}><Icon size={19} /></span>
                      <ArrowUpRight size={16} className="text-[#67777a] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#e6efeb]" />
                    </div>
                    <div><h3 className="text-[15px] font-semibold">{name}</h3><p className="mt-1 text-[11px] leading-5 text-[#869497]">{description}</p></div>
                  </a>
                ))}
              </div>
            </section>

            <section id="catalogo" className="mt-12 border-t border-[#29373b] pt-8 sm:mt-14 sm:pt-10">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div><p className="font-mono text-[9px] tracking-[.22em] text-[#718084]">DIRECTORIO / 12 MÓDULOS</p><h2 className="mt-2 text-[22px] font-semibold tracking-[-.025em] sm:text-[25px]">Todas las herramientas</h2><p className="mt-2 text-[12px] text-[#879497]">Encuentra tu módulo y entra directamente.</p></div>
                <label className="flex h-[46px] w-full items-center gap-3 border border-[#2d3b40] bg-[#121a1d] px-3.5 transition focus-within:border-[#ff315c]/70 lg:max-w-[340px]">
                  <Search size={16} className="shrink-0 text-[#819094]" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar herramientas..." className="min-w-0 flex-1 bg-transparent text-[12px] text-[#e9f0ed] outline-none placeholder:text-[#637176]" />
                  {query && <button aria-label="Limpiar búsqueda" onClick={() => setQuery("")} className="p-1 text-[#829094] hover:text-white"><X size={15} /></button>}
                </label>
              </div>
              <div className="mt-6 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Filtrar por categoría">
                {categories.map((item) => <button key={item} onClick={() => setCategory(item)} aria-pressed={category === item} className={`min-h-[40px] shrink-0 border px-4 text-[11px] font-medium transition ${category === item ? "border-[#ff315c]/50 bg-[#ff315c]/10 text-[#ff7189]" : "border-[#2b393d] text-[#899699] hover:border-[#4a5c60] hover:text-[#d8e1dd]"}`}>{item}</button>)}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map(({ name, route, category: itemCategory, icon: Icon, color, description }) => (
                  <a key={route} href={route} className="group flex min-h-[84px] items-center gap-4 border border-[#263438] bg-[#121a1d] px-4 py-3 transition hover:border-[#53666a] hover:bg-[#172124]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center border bg-[#0e1518]" style={{ borderColor: `${color}48`, color }}><Icon size={18} /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-[#dce5e1] group-hover:text-white">{name}</span><span className="mt-1 block truncate text-[10px] text-[#829094]">{description}</span></span>
                    <span className="hidden shrink-0 font-mono text-[9px] tracking-wider text-[#68777b] sm:block">{itemCategory.toUpperCase()}</span>
                    <ArrowUpRight size={15} className="shrink-0 text-[#607075] transition group-hover:text-[#ff7189]" />
                  </a>
                ))}
                {filtered.length === 0 && <div className="col-span-full border border-dashed border-[#344347] px-5 py-10 text-center"><Search size={19} className="mx-auto text-[#708084]" /><p className="mt-3 text-[13px] font-medium text-[#c2ceca]">No hay herramientas que coincidan.</p><p className="mt-1 text-[11px] text-[#78878b]">Prueba otra búsqueda o cambia la categoría.</p><button onClick={() => { setQuery(""); setCategory("Todas"); }} className="mt-4 min-h-[40px] border border-[#3d4d51] px-4 text-[11px] text-[#c8d1ce] hover:border-[#ff315c]/60">Limpiar filtros</button></div>}
              </div>
            </section>
            <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[#29373b] pt-5 font-mono text-[9px] tracking-[.14em] text-[#647378]"><span>CODE COMMAND CONSOLE</span><span>DIRECTORIO DE MÓDULOS</span></footer>
          </div>
        </main>
      </div>
    </div>
  );
}
