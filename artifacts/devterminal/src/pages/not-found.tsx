import { Link } from "wouter";
import { ArrowLeft, Compass } from "lucide-react";
export default function NotFound() {
  return <div className="module-loading"><Compass size={38} className="text-[#c4f477]" /><span className="eyebrow">404 · PÁGINA NO ENCONTRADA</span><h1 className="text-xl text-white">Parece que este camino no existe.</h1><p>Vuelve a tu workspace y sigue construyendo.</p><Link className="button-primary" href="/"><ArrowLeft size={15} />Volver al inicio</Link></div>;
}
