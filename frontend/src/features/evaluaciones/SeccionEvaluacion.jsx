import { Etiqueta, Tarjeta } from "../../components/ui";
import PreguntaEvaluacion from "./PreguntaEvaluacion";
import { formatearPuntaje, TIPOS_COMPETENCIA } from "./formato";

export default function SeccionEvaluacion({ seccion, escalas, respuestas, errores, editable, resultado, onCambiar }) {
  const { competencia } = seccion;
  const preguntas = seccion.criterios.flatMap((criterio) => criterio.preguntas);
  const respondidas = preguntas.filter((pregunta) => respuestas[pregunta.id_pregunta]).length;

  return (
    <Tarjeta
      nivelTitulo={2}
      titulo={competencia.nombre}
      className="ev-seccion"
      acciones={
        <>
          <Etiqueta>{TIPOS_COMPETENCIA[competencia.tipo] ?? competencia.tipo}</Etiqueta>
          {resultado ? (
            <Etiqueta tono="exito">Puntaje {formatearPuntaje(resultado.puntaje)}</Etiqueta>
          ) : (
            <span className="ev-sutil">
              {respondidas} de {preguntas.length}
            </span>
          )}
        </>
      }
    >
      {competencia.descripcion && <p className="ev-sutil">{competencia.descripcion}</p>}
      {seccion.criterios.map((criterio) => (
        <section key={criterio.id_criterio} className="ev-criterio" aria-labelledby={`ev-criterio-${criterio.id_criterio}`}>
          <h3 id={`ev-criterio-${criterio.id_criterio}`} className="ev-criterio__titulo">
            {criterio.nombre}
          </h3>
          {criterio.descripcion && <p className="ev-sutil">{criterio.descripcion}</p>}
          {criterio.preguntas.map((pregunta) => (
            <PreguntaEvaluacion
              key={pregunta.id_pregunta}
              pregunta={pregunta}
              escala={escalas.get(pregunta.id_escala)}
              respuesta={respuestas[pregunta.id_pregunta] ?? null}
              editable={editable}
              error={errores[pregunta.id_pregunta]}
              onCambiar={onCambiar}
            />
          ))}
        </section>
      ))}
    </Tarjeta>
  );
}
