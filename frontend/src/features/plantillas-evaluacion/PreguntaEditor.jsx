import { Plus, Trash2 } from "lucide-react";
import { Boton, CampoAreaTexto, CampoTexto, Selector } from "../../components/ui";
import { escalaPredeterminada, nuevoNivel, TIPOS_ESCALA } from "./plantilla";

// ruta: prefijo con el que el servidor reporta los errores, p. ej. "criterios[0].preguntas[1]".
export default function PreguntaEditor({ pregunta, numero, ruta, errores, soloLectura, onCambiar, onEliminar }) {
  const error = (campo) => errores[`${ruta}.${campo}`];
  const idCampo = (campo) => `${ruta}.${campo}`;
  const cambiar = (campo) => (evento) => onCambiar({ ...pregunta, [campo]: evento.target.value }, [campo]);

  const cambiarTipo = (evento) => {
    const tipo = evento.target.value;
    onCambiar({ ...pregunta, tipo_escala: tipo, ...escalaPredeterminada(tipo) }, null);
  };

  const cambiarNivel = (indice, campo) => (evento) => {
    const niveles = pregunta.niveles.map((n, i) => (i === indice ? { ...n, [campo]: evento.target.value } : n));
    onCambiar({ ...pregunta, niveles }, [`niveles[${indice}].${campo}`, "niveles"]);
  };

  const agregarNivel = () => onCambiar({ ...pregunta, niveles: [...pregunta.niveles, nuevoNivel(pregunta.niveles)] }, null);
  const quitarNivel = (indice) => onCambiar({ ...pregunta, niveles: pregunta.niveles.filter((_, i) => i !== indice) }, null);

  const esLikert = pregunta.tipo_escala === "LIKERT";

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
          id={idCampo("enunciado")}
          etiqueta="Enunciado"
          className="plantilla-ancho"
          requerido
          filas={2}
          maxLength={500}
          value={pregunta.enunciado}
          onChange={cambiar("enunciado")}
          error={error("enunciado")}
        />
        <CampoTexto
          id={idCampo("peso")}
          etiqueta="Peso (%)"
          requerido
          type="number"
          inputMode="decimal"
          min="0.01"
          max="100"
          step="0.01"
          value={pregunta.peso}
          onChange={cambiar("peso")}
          error={error("peso")}
          ayuda="Porcentaje de la nota final."
        />
        <Selector
          id={idCampo("tipo_escala")}
          etiqueta="Escala de valoración"
          requerido
          opciones={TIPOS_ESCALA}
          value={pregunta.tipo_escala}
          onChange={cambiarTipo}
          error={error("tipo_escala")}
        />
      </div>

      {pregunta.tipo_escala === "NUMERICA" ? (
        <div className="plantilla-pregunta__campos">
          <CampoTexto
            id={idCampo("valor_minimo")}
            etiqueta="Valor mínimo"
            requerido
            type="number"
            inputMode="decimal"
            step="0.01"
            value={pregunta.valor_minimo}
            onChange={cambiar("valor_minimo")}
            error={error("valor_minimo")}
          />
          <CampoTexto
            id={idCampo("valor_maximo")}
            etiqueta="Valor máximo"
            requerido
            type="number"
            inputMode="decimal"
            step="0.01"
            value={pregunta.valor_maximo}
            onChange={cambiar("valor_maximo")}
            error={error("valor_maximo")}
          />
        </div>
      ) : (
        <fieldset className="plantilla-niveles">
          <legend className="plantilla-niveles__titulo">
            {esLikert ? "Etiqueta de cada nivel" : "Niveles, del más bajo al más alto"}
          </legend>
          <p className="plantilla-niveles__ayuda">
            {esLikert
              ? "El evaluador verá estas etiquetas al calificar."
              : "El valor numérico de cada nivel se usa para calcular la nota."}
          </p>
          {error("niveles") && (
            <p className="plantilla-error" role="alert">
              {error("niveles")}
            </p>
          )}
          <div className="plantilla-nivel plantilla-nivel--encabezado" aria-hidden="true">
            <span className="plantilla-nivel__numero">Valor</span>
            <span className="plantilla-nivel__etiqueta">Etiqueta</span>
          </div>
          <ol className="plantilla-niveles__lista">
            {pregunta.niveles.map((nivel, indice) => (
              <li key={nivel.clave} className="plantilla-nivel">
                {esLikert ? (
                  <span className="plantilla-nivel__numero plantilla-nivel__valor" aria-hidden="true">
                    {nivel.valor}
                  </span>
                ) : (
                  <CampoTexto
                    id={idCampo(`niveles[${indice}].valor`)}
                    aria-label={`Valor del nivel ${indice + 1}`}
                    className="plantilla-nivel__numero"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={nivel.valor}
                    onChange={cambiarNivel(indice, "valor")}
                    error={error(`niveles[${indice}].valor`)}
                  />
                )}
                <CampoTexto
                  id={idCampo(`niveles[${indice}].etiqueta`)}
                  aria-label={esLikert ? `Etiqueta del nivel ${nivel.valor}` : `Etiqueta del nivel ${indice + 1}`}
                  className="plantilla-nivel__etiqueta"
                  required
                  maxLength={80}
                  value={nivel.etiqueta}
                  onChange={cambiarNivel(indice, "etiqueta")}
                  error={error(`niveles[${indice}].etiqueta`)}
                />
                {!esLikert && !soloLectura && (
                  <Boton
                    variante="sutil"
                    soloIcono
                    icono={Trash2}
                    className="plantilla-nivel__quitar"
                    aria-label={`Quitar nivel ${indice + 1}`}
                    title="Quitar nivel"
                    onClick={() => quitarNivel(indice)}
                    disabled={pregunta.niveles.length <= 2}
                  />
                )}
              </li>
            ))}
          </ol>
          {!esLikert && !soloLectura && (
            <Boton
              variante="sutil"
              tamano="sm"
              icono={Plus}
              onClick={agregarNivel}
              disabled={pregunta.niveles.length >= 10}
            >
              Agregar nivel
            </Boton>
          )}
        </fieldset>
      )}
    </li>
  );
}
