import { Boton, CampoAreaTexto, CampoTexto, Casilla, Modal, Selector } from "../../components/ui";
import { BASES, FORMAS, TIPOS, hoyLaPaz, opciones } from "./formato";
import useFormulario from "./useFormulario";

const ETIQUETAS = {
  codigo: "Código",
  nombre: "Nombre",
  tipo: "Tipo",
  forma_calculo: "Forma de cálculo",
  base_calculo: "Se calcula sobre",
  valor: "Valor",
  vigente_desde: "Vigente desde",
  vigente_hasta: "Vigente hasta",
  cuenta_contable_codigo: "Código de cuenta",
  cuenta_contable_nombre: "Nombre de cuenta",
  descripcion: "Descripción",
  es_de_ley: "Concepto de ley",
  esta_activo: "Activo",
};

const desdeConcepto = (concepto) => ({
  codigo: concepto?.codigo ?? "",
  nombre: concepto?.nombre ?? "",
  tipo: concepto?.tipo ?? "",
  forma_calculo: concepto?.forma_calculo ?? "",
  base_calculo: concepto?.base_calculo ?? "TOTAL_GANADO",
  valor: "",
  vigente_desde: hoyLaPaz(),
  vigente_hasta: "",
  cuenta_contable_codigo: concepto?.cuenta_contable_codigo ?? "",
  cuenta_contable_nombre: concepto?.cuenta_contable_nombre ?? "",
  descripcion: concepto?.descripcion ?? "",
  es_de_ley: concepto?.es_de_ley ?? false,
  esta_activo: concepto?.esta_activo ?? true,
});

const ID_FORMULARIO = "concepto-formulario";

export default function ConceptoFormulario({ concepto, onGuardar, onCancelar }) {
  const editando = Boolean(concepto);
  const { valores, cambiar, enviar, enviando, propsCampo, resumen } = useFormulario({
    inicial: desdeConcepto(concepto),
    etiquetas: ETIQUETAS,
    prefijo: "concepto",
    onGuardar: ({ valor, ...datos }) =>
      onGuardar({ ...datos, ...(editando ? {} : { valor: valor === "" ? null : Number(valor) }) }),
  });
  const esPorcentaje = valores.forma_calculo === "PORCENTAJE";

  return (
    <Modal
      abierto
      titulo={editando ? `Editar ${concepto.codigo}` : "Nuevo concepto"}
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
          <legend>Concepto</legend>
          <div className="concepto-grupo__campos">
            <CampoTexto
              {...propsCampo("codigo")}
              requerido
              maxLength={20}
              autoComplete="off"
              autoCapitalize="characters"
              ayuda="Sin espacios, por ejemplo BONO-TE."
              data-autofocus
            />
            <CampoTexto {...propsCampo("nombre")} requerido maxLength={80} autoComplete="off" />
            <Selector
              {...propsCampo("tipo")}
              requerido
              disabled={editando}
              textoVacio="Seleccione…"
              opciones={opciones(TIPOS)}
              ayuda={editando ? "No se puede cambiar después de crear el concepto." : undefined}
            />
            <Selector
              {...propsCampo("forma_calculo")}
              requerido
              disabled={editando}
              textoVacio="Seleccione…"
              opciones={opciones(FORMAS)}
              ayuda={editando ? "No se puede cambiar después de crear el concepto." : undefined}
            />
            {esPorcentaje && (
              <Selector {...propsCampo("base_calculo")} requerido opciones={opciones(BASES)} />
            )}
            <CampoAreaTexto
              {...propsCampo("descripcion")}
              className="concepto-grupo__ancho"
              filas={2}
              maxLength={250}
            />
          </div>
          <Casilla
            name="es_de_ley"
            etiqueta={ETIQUETAS.es_de_ley}
            ayuda="Aporte o descuento fijado por la normativa laboral."
            checked={valores.es_de_ley}
            onChange={cambiar}
          />
        </fieldset>

        {!editando && (
          <fieldset className="concepto-grupo">
            <legend>Valor y vigencia</legend>
            <div className="concepto-grupo__campos">
              <CampoTexto
                {...propsCampo("valor")}
                etiqueta={esPorcentaje ? "Porcentaje (%)" : "Monto (Bs)"}
                type="number"
                inputMode="decimal"
                min="0"
                step={esPorcentaje ? "0.0001" : "0.01"}
                requerido
                className="concepto-grupo__ancho"
              />
              <CampoTexto {...propsCampo("vigente_desde")} type="date" requerido />
              <CampoTexto {...propsCampo("vigente_hasta")} type="date" ayuda="Vacío si no tiene fecha de fin." />
            </div>
          </fieldset>
        )}

        <fieldset className="concepto-grupo">
          <legend>Cuenta contable</legend>
          <p className="concepto-nota">Opcional. Con cuenta, el concepto entra en el asiento contable de la planilla.</p>
          <div className="concepto-grupo__campos">
            <CampoTexto
              {...propsCampo("cuenta_contable_codigo")}
              maxLength={20}
              inputMode="decimal"
              autoComplete="off"
              ayuda="Por ejemplo 2.1.3.01."
            />
            <CampoTexto {...propsCampo("cuenta_contable_nombre")} maxLength={80} autoComplete="off" />
          </div>
        </fieldset>

        {editando && (
          <>
            <p className="concepto-nota">Para cambiar el valor, registre una nueva vigencia desde el historial.</p>
            <Casilla
              name="esta_activo"
              etiqueta={ETIQUETAS.esta_activo}
              ayuda="Los conceptos inactivos no se aplican en planillas nuevas."
              checked={valores.esta_activo}
              onChange={cambiar}
            />
          </>
        )}
      </form>
    </Modal>
  );
}
