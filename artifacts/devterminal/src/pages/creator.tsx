import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  ImagePlus,
  LoaderCircle,
  Maximize2,
  RotateCcw,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useGenerateOpenAiImage } from "@workspace/api-client-react";
import { useNeuralContext } from "@/lib/neural-context";

export default function Creator() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageDimensions, setImageDimensions] = useState("AUTO");
  const [error, setError] = useState("");
  const generateImage = useGenerateOpenAiImage();
  const { recordEvent } = useNeuralContext();
  const isPending = generateImage.isPending;

  const generate = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || cleanPrompt.length > 4000 || isPending) return;
    setError("");
    setImageUrl("");
      setImageDimensions("AUTO");
    try {
      const result = await generateImage.mutateAsync({ data: { prompt: cleanPrompt } });
      setImageUrl(result.url);
      recordEvent({
        origin: "creator",
        eventType: "image_gen",
        content: `Imagen generada con GPT-Image-2.5: ${cleanPrompt.slice(0, 1800)}`,
      });
    } catch (cause) {
      const message = cause instanceof Error && cause.message
        ? cause.message
        : "No se pudo generar la imagen. Inténtalo de nuevo.";
      setError(message);
    }
  };

  return (
    <main className="relative flex h-full min-h-0 flex-col overflow-y-auto bg-[#090a0e] text-[#f1f0eb] selection:bg-[#d8ff3e] selection:text-[#11130a]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: "linear-gradient(rgba(216,255,62,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(216,255,62,.035) 1px,transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage: "linear-gradient(to bottom, black, transparent 80%)",
        }}
      />
      <div className="relative mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-5 pb-8 pt-7 sm:px-8 sm:pb-10 sm:pt-9 xl:px-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-white/10 pb-6">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.22em] text-[#d8ff3e]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> DevTerminal / Laboratorio de creación
            </div>
            <h1 className="font-mono text-3xl font-bold tracking-[-.06em] sm:text-4xl">CREATOR<span className="text-[#d8ff3e]">.</span></h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#92949a]">Convierte una idea en una imagen. Empieza con una sensación y dale un mundo donde existir.</p>
          </div>
          <div className="flex items-center gap-2 border border-white/10 bg-white/[.025] px-3 py-2 font-mono text-[10px] uppercase tracking-[.15em] text-[#a4a6a4]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d8ff3e] shadow-[0_0_10px_rgba(216,255,62,.55)]" aria-hidden="true" />
            Motor de imagen <span className="text-[#f1f0eb]">GPT-Image-2.5 Sunburst</span>
          </div>
        </header>

        <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(290px,.82fr)_minmax(0,1.45fr)] xl:gap-7">
          <form
            className="flex flex-col border border-white/10 bg-[#101116] p-5 sm:p-6"
            onSubmit={(event) => { event.preventDefault(); void generate(); }}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#d8ff3e]">01 / Describe</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight">Define la escena</h2>
              </div>
              <div aria-hidden="true" className="grid h-9 w-9 place-items-center border border-[#d8ff3e]/25 bg-[#d8ff3e]/[.06] text-[#d8ff3e]">
                <WandSparkles className="h-4 w-4" />
              </div>
            </div>
            <label htmlFor="creator-prompt" className="mb-2 font-mono text-[10px] uppercase tracking-[.14em] text-[#a6a7a9]">
              Prompt de imagen
            </label>
            <textarea
              id="creator-prompt"
              data-testid="input-image-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value.slice(0, 4000))}
              maxLength={4000}
              minLength={1}
              required
              rows={9}
              aria-describedby="prompt-guidance prompt-count"
              placeholder="Un invernadero de cristal sobre un mar de nubes al anochecer, luces cálidas entre plantas escultóricas, fotografía cinematográfica."
              className="min-h-48 w-full flex-1 resize-y border border-white/10 bg-[#090a0e] p-4 text-sm leading-7 text-[#f1f0eb] placeholder:text-[#5f6066] transition-colors focus:border-[#d8ff3e]/60 focus:outline-none focus:ring-2 focus:ring-[#d8ff3e]/15"
            />
            <p id="prompt-guidance" className="mt-3 text-xs leading-5 text-[#777980]">Incluye un sujeto, un entorno y una atmósfera. Los detalles concretos dan más fuerza a la imagen.</p>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[.07] pt-4">
              <span id="prompt-count" aria-live="polite" className="font-mono text-[10px] tabular-nums text-[#777980]">
                <span className={prompt.length > 3800 ? "text-[#ffc35c]" : "text-[#d8ff3e]"}>{prompt.length}</span> / 4000
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#777980]">{imageDimensions}</span>
            </div>
            <button
              data-testid="button-generate-image"
              type="submit"
              disabled={!prompt.trim() || prompt.trim().length > 4000 || isPending}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[#d8ff3e] px-5 font-mono text-xs font-bold uppercase tracking-[.13em] text-[#12140a] transition-[background-color,transform] hover:bg-[#e4ff76] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8ff3e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101116] active:translate-y-px disabled:cursor-not-allowed disabled:bg-[#34372a] disabled:text-[#818476]"
            >
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
              {isPending ? "Generando imagen…" : "Generar Imagen"}
              {!isPending && <ArrowUpRight className="ml-auto h-4 w-4" aria-hidden="true" />}
            </button>
            <div className="mt-4 flex items-center gap-2 font-mono text-[10px] text-[#6f7177]">
              <Check className="h-3.5 w-3.5 text-[#d8ff3e]" aria-hidden="true" />
              Cada imagen generada con éxito se registra en Neural.
            </div>
          </form>

          <section
            aria-label="Vista previa de la imagen generada"
            aria-busy={isPending}
            className="relative flex min-h-[350px] flex-col overflow-hidden border border-white/10 bg-[#0d0e13] sm:min-h-[500px] lg:min-h-0"
          >
            <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-[#a6a7a9]">
                <span className={`h-1.5 w-1.5 rounded-full ${isPending ? "animate-pulse bg-[#d8ff3e]" : imageUrl ? "bg-[#d8ff3e]" : "bg-[#55565d]"}`} aria-hidden="true" />
                02 / Lienzo
              </div>
              <span className="font-mono text-[10px] text-[#676970]">{imageUrl ? "IMAGEN LISTA" : isPending ? "PROCESANDO" : "EN ESPERA"}</span>
            </div>
            <div className="relative flex flex-1 items-center justify-center p-4 sm:p-7">
              {error ? (
                <div className="max-w-md text-center" role="alert">
                  <div className="mx-auto mb-4 grid h-11 w-11 place-items-center border border-[#ff657a]/30 bg-[#ff657a]/[.07] text-[#ff8292]">
                    <RotateCcw className="h-5 w-5" aria-hidden="true" />
                  </div>
                    <p data-testid="text-image-error" className="text-sm font-medium text-[#ff9aa6]">Generación interrumpida</p>
                  <p className="mt-2 break-words text-xs leading-5 text-[#a17d83]">{error}</p>
                  <button
                    type="button"
                    onClick={() => { void generate(); }}
                    disabled={!prompt.trim() || isPending}
                    className="mt-5 border border-[#ff8292]/30 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-[#ff9aa6] transition hover:bg-[#ff8292]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8292] disabled:opacity-40"
                  >
                    Reintentar
                  </button>
                </div>
              ) : imageUrl ? (
                <figure className="w-full max-w-3xl">
                  <div className="relative mx-auto w-fit max-w-full border border-[#d8ff3e]/20 bg-[#090a0e] p-1 shadow-[0_16px_60px_rgba(0,0,0,.4)]">
                    <img
                      data-testid="img-generated-image"
                      src={imageUrl}
                      alt={prompt.trim()}
                      onLoad={(event) => setImageDimensions(`${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`)}
                      className="mx-auto max-h-[62vh] w-auto max-w-full object-contain"
                    />
                    <a
                      href={imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Abrir imagen generada en una pestaña nueva"
                      className="absolute right-3 top-3 grid h-9 w-9 place-items-center border border-white/15 bg-[#090a0e]/80 text-white transition hover:border-[#d8ff3e]/50 hover:text-[#d8ff3e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8ff3e]"
                    >
                      <Maximize2 className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>
                  <figcaption className="mx-auto mt-4 max-w-2xl break-words border-l-2 border-[#d8ff3e]/50 pl-3 text-xs leading-5 text-[#a6a7a9]">{prompt.trim()}</figcaption>
                </figure>
              ) : isPending ? (
                <div className="w-full max-w-md text-center" role="status" aria-live="polite">
                  <div className="relative mx-auto mb-7 aspect-square w-40 max-w-[45vw] overflow-hidden border border-[#d8ff3e]/25 bg-[linear-gradient(135deg,rgba(216,255,62,.08),transparent_60%)] sm:w-52">
                    <div className="absolute inset-4 border border-[#d8ff3e]/10" />
                    <div className="absolute inset-x-0 top-1/2 h-px animate-pulse bg-[#d8ff3e]/70 shadow-[0_0_16px_rgba(216,255,62,.6)]" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#d8ff3e]">
                      <LoaderCircle className="h-8 w-8 animate-spin" aria-hidden="true" />
                    </div>
                  </div>
                  <p className="font-mono text-xs uppercase tracking-[.16em] text-[#e0e1d9]">Creando tu imagen</p>
                  <p className="mt-2 text-xs text-[#777980]">El lienzo está tomando forma. Esto puede tardar un momento.</p>
                </div>
              ) : (
                <div className="relative w-full max-w-lg text-center">
                  <div aria-hidden="true" className="relative mx-auto mb-7 grid aspect-square w-44 max-w-[48vw] place-items-center border border-dashed border-white/[.14] bg-[radial-gradient(circle_at_50%_50%,rgba(216,255,62,.07),transparent_68%)] sm:w-56">
                    <div className="absolute inset-3 border border-white/[.04]" />
                    <div className="absolute left-1/2 top-0 h-2 w-px bg-[#d8ff3e]/70" />
                    <div className="absolute bottom-0 left-1/2 h-2 w-px bg-[#d8ff3e]/70" />
                    <div className="absolute left-0 top-1/2 h-px w-2 bg-[#d8ff3e]/70" />
                    <div className="absolute right-0 top-1/2 h-px w-2 bg-[#d8ff3e]/70" />
                    <ImagePlus className="h-8 w-8 text-[#d8ff3e]/60" />
                  </div>
                  <p className="font-mono text-xs uppercase tracking-[.16em] text-[#d4d5ce]">Tu lienzo está listo</p>
                  <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#777980]">Describe un momento, un lugar o algo que nunca haya existido. Tu primera imagen empieza con una línea de texto.</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-white/[.07] px-4 py-3 font-mono text-[9px] uppercase tracking-[.12em] text-[#64666d] sm:px-5">
              <span>Estudio de creación</span>
              <span>Enlace Neural <span className="text-[#d8ff3e]">activo</span></span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
