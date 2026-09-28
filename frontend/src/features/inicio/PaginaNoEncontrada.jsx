import { SearchX } from "lucide-react";
import AvisoPagina from "./AvisoPagina";

export default function PaginaNoEncontrada() {
  return (
    <AvisoPagina
      titulo="Página no encontrada"
      icono={SearchX}
      aviso="Esta dirección no corresponde a ningún módulo"
      mensaje="Use el inicio o el buscador de la barra superior para llegar al módulo que busca."
    />
  );
}
