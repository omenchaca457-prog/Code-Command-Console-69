import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search, ArrowUpRight, Layers3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toolCategories, toolModules } from "@/lib/tool-directory";

export default function ToolsCenter() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");

  const filteredModules = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return toolModules.filter((module) => {
      const matchesCategory = category === "Todas" || module.category === category;
      const searchable = `${module.label} ${module.category} ${module.description}`.toLocaleLowerCase();
      return matchesCategory && (!query || searchable.includes(query));
    });
  }, [category, search]);

  const groupedModules = useMemo(() => {
    const groups = new Map<string, typeof filteredModules>();
    for (const module of filteredModules) {
      const group = groups.get(module.category) ?? [];
      group.push(module);
      groups.set(module.category, group);
    }
    return groups;
  }, [filteredModules]);

  return (
    <section className="h-full min-w-0 overflow-y-auto overflow-x-hidden bg-[#080808] px-4 py-5 text-[#e6e6e6] sm:px-6 sm:py-7 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#ff003c]/20 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#00ffff]/70">
              Workspace · módulos disponibles
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Todas las herramientas
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#888]">
              Abre cualquier módulo de Code Command Console sin salir de este workspace.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 border border-[#00ffff]/20 bg-[#00ffff]/5 px-3 py-2 font-mono text-xs text-[#8fefff]">
            <Layers3 className="h-4 w-4" aria-hidden="true" />
            <span>{toolModules.length} módulos</span>
          </div>
        </header>

        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777]" aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o categoría"
              aria-label="Buscar herramientas"
              className="h-11 border-[#272727] bg-[#0c0c0c] pl-10 font-mono text-sm text-white placeholder:text-[#666] focus-visible:ring-[#00ffff]/50"
            />
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
            {toolCategories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                aria-pressed={category === item}
                className={`min-h-11 rounded-sm border px-3 font-mono text-xs transition-colors ${
                  category === item
                    ? "border-[#00ffff]/50 bg-[#00ffff]/10 text-[#9ff8ff]"
                    : "border-[#262626] bg-[#0b0b0b] text-[#aaa] hover:border-[#555] hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {filteredModules.length === 0 ? (
          <div className="border border-dashed border-[#343434] bg-[#0a0a0a] px-4 py-12 text-center">
            <p className="font-mono text-sm text-[#bbb]">No se encontraron herramientas.</p>
            <button
              type="button"
              onClick={() => { setSearch(""); setCategory("Todas"); }}
              className="mt-4 min-h-11 border border-[#00ffff]/30 px-4 font-mono text-xs text-[#8fefff] hover:bg-[#00ffff]/10"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="space-y-7">
            {[...groupedModules.entries()].map(([group, modules]) => (
              <section key={group} aria-labelledby={`tools-${group}`}>
                <h2 id={`tools-${group}`} className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#777]">
                  {group}
                </h2>
                <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {modules.map(({ href, label, description, color, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="group flex min-h-[132px] min-w-0 flex-col border border-[#202020] bg-[#0b0b0b] p-3 transition-colors hover:border-[var(--tool-color)] hover:bg-[#101010] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00ffff] sm:min-h-[148px] sm:p-4"
                      style={{ "--tool-color": `${color}80` } as React.CSSProperties}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center border"
                          style={{ color, borderColor: `${color}50`, backgroundColor: `${color}12` }}
                        >
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-[#555] transition-colors group-hover:text-white" aria-hidden="true" />
                      </div>
                      <span className="break-words text-sm font-semibold text-white sm:text-base">{label}</span>
                      <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#888]">{description}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
