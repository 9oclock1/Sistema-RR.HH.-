import { ChevronDown, ChevronUp, ListTree, Plus, Trash2, X } from "lucide-react";
import { Boton, CampoTexto, EstadoVacio, Etiqueta, Selector, TextoTruncado } from "../../components/ui";
import PreguntaEditor from "./PreguntaEditor";
import { TIPOS_COMPETENCIA } from "./formato";
import { formatearPorcentaje, nuevaPregunta, nuevaSeccion, nuevoCriterio, pesoCriterio, pesoSeccion } from "./plantilla";
import "./estructura.css";

const plural = (cantidad, singular, pluralTexto) => `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;

const reemplazar = (lista, indice, valor) => lista.map((item, i) => (i === indice ? valor : item));
const quitar = (lista, indice) => lista.filter((_, i) => i !== indice);

function Criterio({ criterio, numero, ruta, errores, escalas, soloLectura, idEscala, onCambiar, onEliminar, seccion }) {
  const error = (campo) => errores[`${ruta}.${campo}`];
  const cambiar = (campo) => (evento) => onCambiar({ ...criterio, [campo]: evento.target.value });
  const preguntas = criterio.preguntas;

  return (
    <li className="plantilla-criterio">
      <div className="plantilla-criterio__cabecera">
        <h4 className="plantilla-criterio__titulo">Criterio {numero}</h4>
        <Etiqueta tono="neutral">{formatearPorcentaje(pesoCriterio(criterio))}</Etiqueta>
        {!soloLectura && (
          <Boton
            variante="sutil"
            tamano="sm"
            soloIcono
            icono={Trash2}
            aria-label={`Eliminar el criterio ${numero} de ${seccion}`}
            title="Eliminar criterio"
            onClick={onEliminar}
          />
        )}
      </div>

      <div className="plantilla-campos">
        <CampoTexto
          id={`${ruta}.nombre`}
          etiqueta="Criterio"
          requerido
          maxLength={120}
          autoComplete="off"
          value={criterio.nombre}
          onChange={cambiar("nombre")}
          error={error("nombre")}
        />
        <CampoTexto
          id={`${ruta}.descripcion`}
          etiqueta="Descripción"
          maxLength={255}
          autoComplete="off"
          value={criterio.descripcion}
          onChange={cambiar("descripcion")}
          error={error("descripcion")}
        />
      </div>

      {error("preguntas") && <p className="plantilla-error">{error("preguntas")}</p>}
      {preguntas.length > 0 && (
        <ol className="plantilla-preguntas" aria-label={`Preguntas del criterio ${numero} de ${seccion}`}>
          {preguntas.map((pregunta, indice) => (
            <PreguntaEditor
              key={pregunta.clave}
              pregunta={pregunta}
              numero={indice + 1}
              ruta={`${ruta}.preguntas[${indice}]`}
              errores={errores}
              escalas={escalas}
              soloLectura={soloLectura}
              onCambiar={(nueva) => onCambiar({ ...criterio, preguntas: reemplazar(preguntas, indice, nueva) })}
              onEliminar={() => onCambiar({ ...criterio, preguntas: quitar(preguntas, indice) })}
            />
          ))}
        </ol>
      )}
      {!soloLectura && (
        <Boton
          icono={Plus}
          tamano="sm"
          className="plantilla-agregar"
          aria-label={`Agregar pregunta al criterio ${numero} de ${seccion}`}
          onClick={() => onCambiar({ ...criterio, preguntas: [...preguntas, nuevaPregunta(idEscala)] })}
        >
          Agregar pregunta
        </Boton>
      )}
    </li>
  );
}

// Estructura de una versión: secciones (cada una una competencia laboral o un factor operativo), con sus criterios y las
// preguntas ponderadas de cada uno. En solo lectura (versión publicada) los campos quedan deshabilitados y sin controles.
// `disponibles` son las competencias aún sin usar; `errores` mapea la ruta de cada campo con el mensaje del servidor.
export default function EstructuraPlantilla({
  secciones,
  disponibles,
  escalas,
  editable,
  errores,
  onCambiar,
  onNuevaCompetencia,
}) {
  const idEscala = escalas[0]?.id_escala ?? "";

  const agregarSeccion = (idCompetencia) => {
    const competencia = disponibles.find((c) => c.id_competencia === idCompetencia);
    if (competencia) onCambiar([...secciones, nuevaSeccion(competencia)]);
  };

  const mover = (indice, desplazamiento) => {
    const lista = [...secciones];
    [lista[indice], lista[indice + desplazamiento]] = [lista[indice + desplazamiento], lista[indice]];
    onCambiar(lista);
  };

  return (
    <div className="pl-secciones">
      {editable && (
        <div className="pl-secciones__agregar">
          <Selector
            etiqueta="Agregar sección"
            value=""
            onChange={(evento) => agregarSeccion(evento.target.value)}
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
              ? "Agregue las competencias laborales y los factores operativos que se van a evaluar; luego defina sus criterios y preguntas."
              : "No se definieron secciones antes de publicarla."
          }
        />
      ) : (
        <ol className="pl-lista pl-lista--bloques" aria-label="Secciones de la plantilla">
          {secciones.map((seccion, indice) => {
            const { competencia, criterios } = seccion;
            const tipo = TIPOS_COMPETENCIA[competencia.tipo_codigo];
            const ruta = `secciones[${indice}]`;
            const cantidadPreguntas = criterios.reduce((total, c) => total + c.preguntas.length, 0);
            return (
              <li key={seccion.clave} className="pl-bloque">
                <div className="pl-seccion pl-bloque__cabecera">
                  <span className="pl-seccion__orden" aria-hidden="true">
                    {indice + 1}
                  </span>
                  <div className="pl-seccion__texto">
                    <div className="pl-seccion__titulo">
                      <TextoTruncado className="pl-celda__principal">{competencia.nombre}</TextoTruncado>
                      {tipo && <Etiqueta tono={tipo.tono}>{tipo.texto}</Etiqueta>}
                      {!competencia.esta_activa && <Etiqueta tono="peligro">Desactivada</Etiqueta>}
                    </div>
                    <span className="pl-sutil">
                      {plural(criterios.length, "criterio", "criterios")} · {plural(cantidadPreguntas, "pregunta", "preguntas")} ·{" "}
                      {formatearPorcentaje(pesoSeccion(seccion))} del total
                    </span>
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
                        onClick={() => mover(indice, -1)}
                      />
                      <Boton
                        variante="sutil"
                        soloIcono
                        icono={ChevronDown}
                        aria-label={`Bajar ${competencia.nombre}`}
                        title="Bajar"
                        disabled={indice === secciones.length - 1}
                        onClick={() => mover(indice, 1)}
                      />
                      <Boton
                        variante="sutil"
                        soloIcono
                        icono={X}
                        aria-label={`Quitar ${competencia.nombre}`}
                        title="Quitar"
                        onClick={() => onCambiar(quitar(secciones, indice))}
                      />
                    </div>
                  )}
                </div>

                <fieldset className="pl-bloque__cuerpo" disabled={!editable}>
                  <legend className="ds-solo-lector">Criterios y preguntas de {competencia.nombre}</legend>
                  {errores[`${ruta}.id_competencia`] && <p className="plantilla-error">{errores[`${ruta}.id_competencia`]}</p>}
                  {errores[`${ruta}.criterios`] && <p className="plantilla-error">{errores[`${ruta}.criterios`]}</p>}
                  {criterios.length === 0 ? (
                    <p className="pl-sutil">
                      {editable
                        ? "Sin criterios todavía: agregue al menos uno para poder publicar."
                        : "Esta sección no tiene criterios."}
                    </p>
                  ) : (
                    <ol className="pl-criterios" aria-label={`Criterios de ${competencia.nombre}`}>
                      {criterios.map((criterio, j) => (
                        <Criterio
                          key={criterio.clave}
                          criterio={criterio}
                          numero={j + 1}
                          ruta={`${ruta}.criterios[${j}]`}
                          errores={errores}
                          escalas={escalas}
                          soloLectura={!editable}
                          idEscala={idEscala}
                          seccion={competencia.nombre}
                          onCambiar={(nuevo) =>
                            onCambiar(reemplazar(secciones, indice, { ...seccion, criterios: reemplazar(criterios, j, nuevo) }))
                          }
                          onEliminar={() => onCambiar(reemplazar(secciones, indice, { ...seccion, criterios: quitar(criterios, j) }))}
                        />
                      ))}
                    </ol>
                  )}
                  {editable && (
                    <Boton
                      icono={Plus}
                      className="plantilla-agregar"
                      aria-label={`Agregar criterio a ${competencia.nombre}`}
                      onClick={() =>
                        onCambiar(reemplazar(secciones, indice, { ...seccion, criterios: [...criterios, nuevoCriterio(idEscala)] }))
                      }
                    >
                      Agregar criterio
                    </Boton>
                  )}
                </fieldset>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
