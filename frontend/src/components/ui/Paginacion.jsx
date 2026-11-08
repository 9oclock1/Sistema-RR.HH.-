import { ChevronLeft, ChevronRight } from "lucide-react";
import Boton from "./Boton";
import "./Paginacion.css";

export default function Paginacion({ pagina, limite, total, onCambiar, etiqueta = "Paginación", disabled = false, className = "" }) {
  if (total === 0) return null;
  const totalPaginas = Math.max(1, Math.ceil(total / limite));
  const desde = (pagina - 1) * limite + 1;
  const hasta = Math.min(pagina * limite, total);

  return (
    <nav className={`ds-paginacion ${className}`} aria-label={etiqueta}>
      <p className="ds-paginacion__resumen" aria-live="polite">
        {desde}–{hasta} de {total}
      </p>
      <div className="ds-paginacion__botones">
        <Boton
          tamano="sm"
          icono={ChevronLeft}
          onClick={() => onCambiar(pagina - 1)}
          disabled={disabled || pagina <= 1}
        >
          Anterior
        </Boton>
        <Boton
          tamano="sm"
          icono={ChevronRight}
          onClick={() => onCambiar(pagina + 1)}
          disabled={disabled || pagina >= totalPaginas}
        >
          Siguiente
        </Boton>
      </div>
    </nav>
  );
}
