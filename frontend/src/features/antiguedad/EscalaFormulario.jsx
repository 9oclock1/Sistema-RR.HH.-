import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alerta, Boton, CampoAreaTexto, CampoTexto, Modal } from "../../components/ui";
import { hoyLaPaz } from "./formato";

const TRAMO_VACIO = { anios_desde: "", anios_hasta: "", porcentaje: "" };

export default function EscalaFormulario({ onGuardar, onCancelar }) {
  const [vigenteDesde, setVigenteDesde] = useState(hoyLaPaz());
  const [motivo, setMotivo] = useState("");
  const [tramos, setTramos] = useState([{ ...TRAMO_VACIO }, { anios_desde: "", anios_hasta: "", porcentaje: "" }]);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cambiarTramo = (indice, campo, valor) =>
    setTramos((actuales) => actuales.map((t, i) => (i === indice ? { ...t, [campo]: valor } : t)));

  const agregarTramo = () => setTramos((actuales) => [...actuales, { ...TRAMO_VACIO }]);
  const quitarTramo = (indice) => setTramos((actuales) => actuales.filter((_, i) => i !== indice));

  const enviar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await onGuardar({
        vigente_desde: vigenteDesde,
        motivo: motivo.trim() || null,
        tramos: tramos.map((t) => ({
          anios_desde: t.anios_desde === "" ? null : Number(t.anios_desde),
          anios_hasta: t.anios_hasta === "" ? null : Number(t.anios_hasta),
          porcentaje: t.porcentaje === "" ? null : Number(t.porcentaje),
        })),
      });
    } catch (err) {
      const detalles = err.detalles ?? [];
      setError({ general: detalles.length ? null : err.message, detalles });
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto
      titulo="Nueva vigencia de la escala"
      onCerrar={onCancelar}
      bloqueado={enviando}
      pie={
        <>
          <Boton variante="sutil" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form="escala-formulario" cargando={enviando}>
            {enviando ? "Guardando…" : "Guardar"}
          </Boton>
        </>
      }
    >
      <form id="escala-formulario" className="antiguedad-escala-formulario" onSubmit={enviar} noValidate>
        {error && (
          <Alerta tono="peligro" role="alert" titulo={error.general ?? "Revise los tramos marcados."}>
            {error.detalles.length > 0 && (
              <ul>
                {error.detalles.map((d, i) => (
                  <li key={i}>{d.mensaje}</li>
                ))}
              </ul>
            )}
          </Alerta>
        )}

        <div className="antiguedad-escala-formulario__campos">
          <CampoTexto
            id="escala-vigente-desde"
            etiqueta="Vigente desde"
            type="date"
            requerido
            value={vigenteDesde}
            onChange={(e) => setVigenteDesde(e.target.value)}
            data-autofocus
          />
          <CampoAreaTexto
            id="escala-motivo"
            etiqueta="Motivo"
            className="antiguedad-escala-formulario__ancho"
            filas={2}
            maxLength={250}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            ayuda="Por ejemplo, la norma que actualiza la escala."
          />
        </div>

        <fieldset className="antiguedad-tramos">
          <legend>Tramos de la escala</legend>
          <p className="antiguedad-nota">
            Cada tramo debe continuar justo donde termina el anterior; solo el último puede quedar sin tope.
          </p>
          {tramos.map((tramo, indice) => (
            <div className="antiguedad-tramos__fila" key={indice}>
              <CampoTexto
                id={`tramo-${indice}-desde`}
                etiqueta="Desde (años)"
                type="number"
                min="0"
                requerido
                value={tramo.anios_desde}
                onChange={(e) => cambiarTramo(indice, "anios_desde", e.target.value)}
              />
              <CampoTexto
                id={`tramo-${indice}-hasta`}
                etiqueta="Hasta (años)"
                type="number"
                min="0"
                value={tramo.anios_hasta}
                onChange={(e) => cambiarTramo(indice, "anios_hasta", e.target.value)}
                ayuda="Vacío si no tiene tope."
              />
              <CampoTexto
                id={`tramo-${indice}-porcentaje`}
                etiqueta="Porcentaje (%)"
                type="number"
                min="0"
                max="100"
                step="0.01"
                requerido
                value={tramo.porcentaje}
                onChange={(e) => cambiarTramo(indice, "porcentaje", e.target.value)}
              />
              <Boton
                variante="sutil"
                soloIcono
                icono={Trash2}
                aria-label={`Quitar tramo ${indice + 1}`}
                title="Quitar tramo"
                onClick={() => quitarTramo(indice)}
                disabled={tramos.length <= 1}
                type="button"
              />
            </div>
          ))}
          <Boton variante="sutil" icono={Plus} onClick={agregarTramo} type="button">
            Agregar tramo
          </Boton>
        </fieldset>
      </form>
    </Modal>
  );
}
