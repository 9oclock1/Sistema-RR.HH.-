import { Boton, CampoTexto, Modal, Selector } from "../../components/ui";
import useFormulario from "../conceptos/useFormulario";
import { FORMAS_BONO, TIPOS_META, mesActual } from "./formato";

const ETIQUETAS = {
  periodo: "Periodo",
  tipo_meta: "Tipo de meta",
  umbral_cumplimiento: "Umbral de cumplimiento (%)",
  forma_calculo: "Forma de cálculo",
  valor: "Valor del bono",
};

const opciones = (catalogo) =>
  Object.entries(catalogo).map(([valor, etiqueta]) => ({
    valor,
    etiqueta: typeof etiqueta === "string" ? etiqueta : etiqueta.etiqueta,
  }));

const desdeRegla = (r) => ({
  periodo: r?.periodo?.slice(0, 7) ?? mesActual(),
  tipo_meta: r?.tipo_meta ?? "VENTAS",
  umbral_cumplimiento: String(r?.umbral_cumplimiento ?? "100"),
  forma_calculo: r?.forma_calculo ?? "MONTO_FIJO",
  valor: String(r?.valor ?? ""),
});

const ID_FORMULARIO = "regla-bono-formulario";

export default function ReglaFormulario({ regla, onGuardar, onCancelar }) {
  const editando = Boolean(regla);
  const { valores, enviar, enviando, propsCampo, resumen } = useFormulario({
    inicial: desdeRegla(regla),
    etiquetas: ETIQUETAS,
    prefijo: "regla-bono",
    onGuardar: ({ umbral_cumplimiento, valor, ...datos }) =>
      onGuardar({ ...datos, umbral_cumplimiento: Number(umbral_cumplimiento), valor: Number(valor) }),
  });
  const { forma_calculo: forma } = valores;

  return (
    <Modal
      abierto
      titulo={editando ? "Editar regla de bono" : "Nueva regla de bono por productividad"}
      onCerrar={onCancelar}
      bloqueado={enviando}
      pie={
        <>
          <Boton variante="sutil" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form={ID_FORMULARIO} cargando={enviando}>
            {enviando ? "Guardando…" : "Guardar"}
          </Boton>
        </>
      }
    >
      <form id={ID_FORMULARIO} className="concepto-formulario" onSubmit={enviar} noValidate>
        {resumen}
        <fieldset className="concepto-grupo">
          <legend>Meta y periodo</legend>
          <div className="concepto-grupo__campos">
            <CampoTexto {...propsCampo("periodo")} type="month" requerido disabled={editando} data-autofocus />
            <Selector
              {...propsCampo("tipo_meta")}
              requerido
              disabled={editando}
              opciones={opciones(TIPOS_META)}
              ayuda={editando ? "No se puede cambiar después de crear la regla." : undefined}
            />
          </div>
        </fieldset>
        <fieldset className="concepto-grupo">
          <legend>Umbral y bono</legend>
          <div className="concepto-grupo__campos">
            <CampoTexto
              {...propsCampo("umbral_cumplimiento")}
              type="number"
              inputMode="decimal"
              min="0.01"
              max="1000"
              step="0.01"
              requerido
              ayuda="Porcentaje de la cuota asignada que debe alcanzar para recibir el bono. 100 = cumplir toda la cuota."
            />
            <Selector {...propsCampo("forma_calculo")} requerido opciones={opciones(FORMAS_BONO)} />
            <CampoTexto
              {...propsCampo("valor")}
              etiqueta={forma === "PORCENTAJE" ? "Porcentaje del haber básico (%)" : "Monto fijo (Bs)"}
              type="number"
              inputMode="decimal"
              min="0"
              step={forma === "PORCENTAJE" ? "0.0001" : "0.01"}
              requerido
              className="concepto-grupo__ancho"
            />
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
