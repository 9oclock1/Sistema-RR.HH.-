import { RotateCcw } from "lucide-react";
import { Boton, CampoTexto, Selector } from "../../components/ui";
import "./CandidateRankingTable.css";

const OPCIONES_DESEMPATE = [
  { valor: "experiencia", etiqueta: "Mayor experiencia laboral" },
  { valor: "fecha_postulacion", etiqueta: "Fecha de postulación (antigüedad)" },
  { valor: "educacion", etiqueta: "Nivel de educación alcanzado" },
];

const OPCIONES_ORDEN = [
  { valor: "desc", etiqueta: "Mayor primero (descendente)" },
  { valor: "asc", etiqueta: "Menor primero (ascendente)" },
];

export default function RankingFilters({ filtros, alCambiarFiltro, alLimpiar }) {
  return (
    <div className="ranking-filtros-barra">
      <div className="ranking-filtros-grupo">
        <div className="ranking-filtros-item">
          <Selector
            id="filtro-criterio-desempate"
            etiqueta="Criterio de desempate"
            opciones={OPCIONES_DESEMPATE}
            value={filtros.desempate}
            onChange={(e) => alCambiarFiltro("desempate", e.target.value)}
          />
        </div>

        <div className="ranking-filtros-item">
          <Selector
            id="filtro-orden-desempate"
            etiqueta="Sentido de orden"
            opciones={OPCIONES_ORDEN}
            value={filtros.orden_desempate}
            onChange={(e) => alCambiarFiltro("orden_desempate", e.target.value)}
          />
        </div>
      </div>

      <div className="ranking-filtros-grupo">
        <div className="ranking-filtros-item ranking-filtros-item--sm">
          <CampoTexto
            id="filtro-experiencia-min"
            name="experiencia_min"
            type="number"
            etiqueta="Exp. mínima (años)"
            placeholder="Ej: 2"
            value={filtros.experiencia_min}
            onChange={(e) => alCambiarFiltro("experiencia_min", e.target.value)}
          />
        </div>

        <div className="ranking-filtros-item ranking-filtros-item--sm">
          <CampoTexto
            id="filtro-ciudad"
            name="ciudad"
            etiqueta="Ciudad"
            placeholder="Ej: La Paz"
            value={filtros.ciudad}
            onChange={(e) => alCambiarFiltro("ciudad", e.target.value)}
          />
        </div>

        {alLimpiar && (
          <div className="ranking-filtros-accion-reset">
            <Boton
              tamano="sm"
              variante="sutil"
              icono={RotateCcw}
              onClick={alLimpiar}
              aria-label="Limpiar filtros"
            >
              Restablecer
            </Boton>
          </div>
        )}
      </div>
    </div>
  );
}