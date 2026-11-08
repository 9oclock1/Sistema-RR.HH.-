import { Lock, Plus, Save, Trash2 } from "lucide-react";
import { Boton, CampoAreaTexto, CampoTexto, EstadoVacio, Etiqueta, Tarjeta } from "../../components/ui";
import { formatearFecha } from "../solicitud-vacaciones/formato";
import {
  CAMPOS_RETROALIMENTACION,
  compromisoVacio,
  MAX_COMPROMISOS,
  MAX_DESCRIPCION_COMPROMISO,
  MAX_TEXTO,
  tieneContenido,
} from "./retroalimentacion";

const TITULO = "Retroalimentación final";

// Sección final del formulario mientras el evaluador todavía no completó los puntajes.
export function RetroalimentacionBloqueada({ faltantes }) {
  return (
    <Tarjeta nivelTitulo={2} titulo={TITULO} className="ev-retro" acciones={<Etiqueta icono={Lock}>Bloqueada</Etiqueta>}>
      <p className="ev-sutil">
        {faltantes > 0
          ? `Responda ${faltantes === 1 ? "la pregunta obligatoria que falta" : `las ${faltantes} preguntas obligatorias que faltan`} para registrar las fortalezas, los aspectos de mejora y los compromisos de desarrollo.`
          : "Responda las preguntas de la evaluación para registrar las fortalezas, los aspectos de mejora y los compromisos de desarrollo."}
      </p>
    </Tarjeta>
  );
}

// Sección final editable: textos cualitativos y compromisos con descripción y fecha objetivo.
export function FormularioRetroalimentacion({ valor, errores, hoy, sinGuardar, guardando, onCambiar, onGuardar }) {
  const cambiarCampo = (clave, texto) => onCambiar({ ...valor, [clave]: texto });
  const cambiarCompromiso = (indice, cambios) =>
    onCambiar({ ...valor, compromisos: valor.compromisos.map((c, i) => (i === indice ? { ...c, ...cambios } : c)) });
  const agregar = () => onCambiar({ ...valor, compromisos: [...valor.compromisos, compromisoVacio()] });
  const quitar = (indice) => onCambiar({ ...valor, compromisos: valor.compromisos.filter((_, i) => i !== indice) });

  return (
    <Tarjeta
      nivelTitulo={2}
      titulo={TITULO}
      className="ev-retro"
      acciones={sinGuardar ? <Etiqueta tono="aviso">Cambios sin guardar</Etiqueta> : null}
    >
      <p className="ev-sutil">
        Complete la valoración con comentarios cualitativos. El colaborador podrá leerlos, sin editarlos, cuando envíe la
        evaluación.
      </p>

      {CAMPOS_RETROALIMENTACION.map(({ clave, etiqueta, ayuda }) => (
        <CampoAreaTexto
          key={clave}
          etiqueta={etiqueta}
          ayuda={ayuda}
          filas={3}
          maxLength={MAX_TEXTO}
          value={valor[clave]}
          error={errores[clave]}
          onChange={(evento) => cambiarCampo(clave, evento.target.value)}
        />
      ))}

      <section className="ev-compromisos" aria-labelledby="ev-compromisos-titulo">
        <h3 id="ev-compromisos-titulo" className="ev-criterio__titulo">
          Compromisos de desarrollo
        </h3>
        {valor.compromisos.length === 0 ? (
          <p className="ev-sutil">Aún no hay compromisos. Agregue acciones concretas con su fecha objetivo de cumplimiento.</p>
        ) : (
          <ol className="ev-compromisos__lista">
            {valor.compromisos.map((compromiso, indice) => (
              <li key={compromiso.clave} className="ev-compromiso">
                <CampoAreaTexto
                  etiqueta={`Compromiso ${indice + 1}`}
                  requerido
                  filas={2}
                  maxLength={MAX_DESCRIPCION_COMPROMISO}
                  value={compromiso.descripcion}
                  error={errores[`compromisos[${indice}].descripcion`]}
                  onChange={(evento) => cambiarCompromiso(indice, { descripcion: evento.target.value })}
                />
                <CampoTexto
                  etiqueta="Fecha objetivo"
                  type="date"
                  requerido
                  min={hoy}
                  value={compromiso.fecha_objetivo}
                  error={errores[`compromisos[${indice}].fecha_objetivo`]}
                  onChange={(evento) => cambiarCompromiso(indice, { fecha_objetivo: evento.target.value })}
                />
                <Boton
                  className="ev-compromiso__quitar"
                  icono={Trash2}
                  soloIcono
                  variante="sutil"
                  aria-label={`Quitar el compromiso ${indice + 1}`}
                  onClick={() => quitar(indice)}
                />
              </li>
            ))}
          </ol>
        )}
        <Boton icono={Plus} tamano="sm" onClick={agregar} disabled={valor.compromisos.length >= MAX_COMPROMISOS}>
          Agregar compromiso
        </Boton>
      </section>

      <div className="ev-retro__pie">
        <Boton icono={Save} onClick={onGuardar} cargando={guardando} disabled={guardando || !sinGuardar}>
          Guardar retroalimentación
        </Boton>
      </div>
    </Tarjeta>
  );
}

// Vista de solo lectura: la usan el evaluador tras el envío y el colaborador al consultar sus resultados.
export function VistaRetroalimentacion({ retroalimentacion }) {
  if (!tieneContenido(retroalimentacion)) {
    return (
      <Tarjeta nivelTitulo={2} titulo={TITULO} className="ev-retro">
        <EstadoVacio titulo="Sin retroalimentación" mensaje="El evaluador no registró comentarios cualitativos en esta evaluación." />
      </Tarjeta>
    );
  }
  const { compromisos } = retroalimentacion;
  return (
    <Tarjeta nivelTitulo={2} titulo={TITULO} className="ev-retro" acciones={<Etiqueta icono={Lock}>Solo lectura</Etiqueta>}>
      <dl className="ev-retro__textos">
        {CAMPOS_RETROALIMENTACION.map(({ clave, etiqueta }) => (
          <div key={clave}>
            <dt>{etiqueta}</dt>
            <dd className={retroalimentacion[clave] ? "ev-retro__texto" : "ev-sutil"}>
              {retroalimentacion[clave] || "Sin registrar"}
            </dd>
          </div>
        ))}
      </dl>
      <section className="ev-compromisos" aria-labelledby="ev-compromisos-vista">
        <h3 id="ev-compromisos-vista" className="ev-criterio__titulo">
          Compromisos de desarrollo
        </h3>
        {compromisos.length === 0 ? (
          <p className="ev-sutil">No se registraron compromisos.</p>
        ) : (
          <ol className="ev-compromisos__lista">
            {compromisos.map((compromiso, indice) => (
              <li key={compromiso.id_compromiso ?? indice} className="ev-compromiso ev-compromiso--lectura">
                <p className="ev-retro__texto">{compromiso.descripcion}</p>
                <p className="ev-sutil">Fecha objetivo: {formatearFecha(compromiso.fecha_objetivo)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Tarjeta>
  );
}
