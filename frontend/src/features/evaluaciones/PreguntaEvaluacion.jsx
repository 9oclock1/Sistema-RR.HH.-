import { Eraser } from "lucide-react";
import { Boton, GrupoRadios } from "../../components/ui";
import { idCampoPregunta } from "./formato";

export default function PreguntaEvaluacion({ pregunta, escala, respuesta, editable, error, onCambiar }) {
  const opciones = escala.niveles.map((nivel) => ({
    valor: nivel.id_nivel,
    etiqueta: escala.tipo === "CUANTITATIVA" ? `${nivel.valor} · ${nivel.etiqueta}` : nivel.etiqueta,
  }));

  return (
    <div className="ev-pregunta">
      <GrupoRadios
        id={idCampoPregunta(pregunta.id_pregunta)}
        leyenda={
          <>
            {pregunta.texto}
            {!pregunta.es_obligatoria && <span className="ev-opcional"> (opcional)</span>}
          </>
        }
        requerido={pregunta.es_obligatoria}
        opciones={opciones}
        value={respuesta}
        onChange={(idNivel) => onCambiar(pregunta.id_pregunta, idNivel)}
        disabled={!editable}
        error={error}
      />
      {editable && respuesta && (
        <Boton
          variante="sutil"
          tamano="sm"
          icono={Eraser}
          className="ev-pregunta__borrar"
          aria-label={`Borrar la respuesta de: ${pregunta.texto}`}
          onClick={() => onCambiar(pregunta.id_pregunta, null)}
        >
          Borrar respuesta
        </Boton>
      )}
    </div>
  );
}
