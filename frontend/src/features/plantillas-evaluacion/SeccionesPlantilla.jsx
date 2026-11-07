import { ChevronDown, ChevronUp, ListTree, Plus, X } from "lucide-react";
import { Boton, EstadoVacio, Etiqueta, Selector, TextoTruncado } from "../../components/ui";
import { TIPOS_COMPETENCIA } from "./formato";

// Lista ordenada de las secciones de una versión. Cada sección es una competencia laboral o un factor operativo.
// En solo lectura (versión publicada) no muestra controles. `disponibles` son las competencias aún sin usar.
export default function SeccionesPlantilla({
  secciones,
  disponibles,
  editable,
  onAgregar,
  onMover,
  onQuitar,
  onNuevaCompetencia,
}) {
  return (
    <div className="pl-secciones">
      {editable && (
        <div className="pl-secciones__agregar">
          <Selector
            etiqueta="Agregar sección"
            value=""
            onChange={(evento) => onAgregar(evento.target.value)}
            textoVacio={disponibles.length > 0 ? "Seleccione una competencia o factor…" : "No quedan por agregar"}
            disabled={disponibles.length === 0}
          >
            {Object.entries(TIPOS_COMPETENCIA).map(([codigo, tipo]) => {
              const lista = disponibles.filter((c) => c.tipo_codigo === codigo);
              return (
                lista.length > 0 && (
                  <optgroup key={codigo} label={tipo.plural}>
                    {lista.map((c) => (
                      <option key={c.id_competencia} value={c.id_competencia}>
                        {c.nombre}
                      </option>
                    ))}
                  </optgroup>
                )
              );
            })}
          </Selector>
          <Boton icono={Plus} onClick={onNuevaCompetencia}>
            Nueva competencia
          </Boton>
        </div>
      )}

      {secciones.length === 0 ? (
        <EstadoVacio
          icono={ListTree}
          titulo="Esta versión aún no tiene secciones"
          mensaje={
            editable
              ? "Agregue las competencias laborales y los factores operativos que se van a evaluar."
              : "No se definieron secciones antes de publicarla."
          }
        />
      ) : (
        <ol className="pl-lista" aria-label="Secciones de la plantilla">
          {secciones.map((competencia, indice) => {
            const tipo = TIPOS_COMPETENCIA[competencia.tipo_codigo];
            return (
              <li key={competencia.id_competencia} className="pl-seccion">
                <span className="pl-seccion__orden" aria-hidden="true">
                  {indice + 1}
                </span>
                <div className="pl-seccion__texto">
                  <div className="pl-seccion__titulo">
                    <TextoTruncado className="pl-celda__principal">{competencia.nombre}</TextoTruncado>
                    <Etiqueta tono={tipo.tono}>{tipo.texto}</Etiqueta>
                    {!competencia.esta_activa && <Etiqueta tono="peligro">Desactivada</Etiqueta>}
                  </div>
                  {competencia.descripcion && (
                    <TextoTruncado className="pl-sutil">{competencia.descripcion}</TextoTruncado>
                  )}
                  {!competencia.esta_activa && (
                    <span className="pl-sutil">No se podrá publicar mientras esta competencia siga desactivada.</span>
                  )}
                </div>
                {editable && (
                  <div className="pl-acciones">
                    <Boton
                      variante="sutil"
                      soloIcono
                      icono={ChevronUp}
                      aria-label={`Subir ${competencia.nombre}`}
                      title="Subir"
                      disabled={indice === 0}
                      onClick={() => onMover(indice, -1)}
                    />
                    <Boton
                      variante="sutil"
                      soloIcono
                      icono={ChevronDown}
                      aria-label={`Bajar ${competencia.nombre}`}
                      title="Bajar"
                      disabled={indice === secciones.length - 1}
                      onClick={() => onMover(indice, 1)}
                    />
                    <Boton
                      variante="sutil"
                      soloIcono
                      icono={X}
                      aria-label={`Quitar ${competencia.nombre}`}
                      title="Quitar"
                      onClick={() => onQuitar(competencia.id_competencia)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
