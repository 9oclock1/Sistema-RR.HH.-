import { Trash2 } from "lucide-react";
import { Boton, CampoAreaTexto, CampoTexto, Casilla, Selector } from "../../components/ui";

// ruta: prefijo con el que el servidor reporta los errores, p. ej. "secciones[0].criterios[1].preguntas[2]".
// escalas: catálogo de escalas de valoración con sus niveles.
export default function PreguntaEditor({ pregunta, numero, ruta, errores, escalas, soloLectura, onCambiar, onEliminar }) {
  const error = (campo) => errores[`${ruta}.${campo}`];
  const idCampo = (campo) => `${ruta}.${campo}`;
  const cambiar = (campo) => (evento) => onCambiar({ ...pregunta, [campo]: evento.target.value }, [campo]);
  const escala = escalas.find((e) => e.id_escala === pregunta.id_escala);

  return (
    <li className="plantilla-pregunta">
      <div className="plantilla-pregunta__cabecera">
        <span className="plantilla-pregunta__numero">Pregunta {numero}</span>
        {!soloLectura && (
          <Boton
            variante="sutil"
            tamano="sm"
            soloIcono
            icono={Trash2}
            aria-label={`Eliminar pregunta ${numero}`}
            title="Eliminar pregunta"
            onClick={onEliminar}
          />
        )}
      </div>

      <div className="plantilla-pregunta__campos">
        <CampoAreaTexto
          id={idCampo("texto")}
          etiqueta="Pregunta"
          className="plantilla-ancho"
          requerido
          filas={2}
          maxLength={500}
          value={pregunta.texto}
          onChange={cambiar("texto")}
          error={error("texto")}
        />
        <CampoTexto
          id={idCampo("peso_porcentual")}
          etiqueta="Peso (%)"
          requerido
          type="number"
          inputMode="decimal"
          min="0.01"
          max="100"
          step="0.01"
          value={pregunta.peso_porcentual}
          onChange={cambiar("peso_porcentual")}
          error={error("peso_porcentual")}
          ayuda="Porcentaje de la nota final."
        />
        <Selector
          id={idCampo("id_escala")}
          etiqueta="Escala de valoración"
          requerido
          textoVacio="Seleccione una escala"
          opciones={escalas.map((e) => ({ valor: e.id_escala, etiqueta: e.nombre }))}
          value={pregunta.id_escala}
          onChange={cambiar("id_escala")}
          error={error("id_escala")}
        />
      </div>

      <Casilla
        id={idCampo("es_obligatoria")}
        etiqueta="Respuesta obligatoria"
        ayuda="Si es opcional y no se responde, su peso se reparte entre las preguntas respondidas."
        checked={pregunta.es_obligatoria}
        onChange={(evento) => onCambiar({ ...pregunta, es_obligatoria: evento.target.checked }, ["es_obligatoria"])}
      />

      {escala && (
        <div className="plantilla-escala-vista">
          <span className="plantilla-niveles__titulo">
            {escala.tipo === "CUALITATIVA" ? "Escala cualitativa" : "Escala cuantitativa"}: lo que verá el evaluador
          </span>
          <ol className="plantilla-escala-vista__niveles">
            {escala.niveles.map((nivel) => (
              <li key={nivel.id_nivel ?? nivel.valor}>
                <span className="plantilla-nivel__valor">{Number(nivel.valor).toLocaleString("es-BO")}</span>
                {nivel.etiqueta}
              </li>
            ))}
          </ol>
        </div>
      )}
    </li>
  );
}
