import { Boton, CampoAreaTexto, CampoTexto, Casilla, Modal, Selector } from "../../components/ui";
import { hoyLaPaz, opciones } from "../conceptos/formato";
import useFormulario from "../conceptos/useFormulario";
import { FORMAS_CONDICION, TIPOS_CONDICION, etiquetaValor } from "./formato";

const ETIQUETAS = {
  codigo: "Código",
  nombre: "Nombre",
  tipo_condicion: "Condición",
  minutos_nocturnos_minimos: "Minutos nocturnos mínimos",
  forma_calculo: "Forma de cálculo",
  valor: "Valor",
  vigente_desde: "Vigente desde",
  vigente_hasta: "Vigente hasta",
  descripcion: "Descripción",
  cuenta_contable_codigo: "Código de cuenta",
  cuenta_contable_nombre: "Nombre de cuenta",
  esta_activo: "Activa",
};

const MINUTOS_PREDETERMINADOS = 240;

const desdeCondicion = (c) => ({
  codigo: c?.codigo ?? "",
  nombre: c?.nombre ?? "",
  tipo_condicion: c?.tipo_condicion ?? "",
  minutos_nocturnos_minimos: String(c?.minutos_nocturnos_minimos ?? MINUTOS_PREDETERMINADOS),
  forma_calculo: c?.forma_calculo ?? "MONTO_FIJO",
  valor: "",
  vigente_desde: hoyLaPaz(),
  vigente_hasta: "",
  descripcion: c?.descripcion ?? "",
  cuenta_contable_codigo: c?.cuenta_contable_codigo ?? "",
  cuenta_contable_nombre: c?.cuenta_contable_nombre ?? "",
  esta_activo: c?.esta_activo ?? true,
});

const numeroONulo = (valor) => (valor === "" ? null : Number(valor));

const ID_FORMULARIO = "condicion-formulario";

export default function CondicionFormulario({ condicion, onGuardar, onCancelar }) {
  const editando = Boolean(condicion);
  const { valores, cambiar, enviar, enviando, propsCampo, resumen } = useFormulario({
    inicial: desdeCondicion(condicion),
    etiquetas: ETIQUETAS,
    prefijo: "condicion",
    onGuardar: ({ valor, vigente_desde, vigente_hasta, minutos_nocturnos_minimos, ...datos }) =>
      onGuardar({
        ...datos,
        minutos_nocturnos_minimos:
          datos.tipo_condicion === "TRASNOCHE" ? numeroONulo(minutos_nocturnos_minimos) : null,
        ...(editando ? {} : { valor: numeroONulo(valor), vigente_desde, vigente_hasta }),
      }),
  });
  const { tipo_condicion: tipo, forma_calculo: forma } = valores;
  const esPorcentaje = forma === "PORCENTAJE";

  return (
    <Modal
      abierto
      titulo={editando ? `Editar ${condicion.codigo}` : "Nueva condición especial"}
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
          <legend>Condición</legend>
          <div className="concepto-grupo__campos">
            <CampoTexto
              {...propsCampo("codigo")}
              requerido
              maxLength={20}
              autoComplete="off"
              autoCapitalize="characters"
              ayuda="Sin espacios, por ejemplo BONO-FRIO."
              data-autofocus
            />
            <CampoTexto {...propsCampo("nombre")} requerido maxLength={80} autoComplete="off" />
            <Selector
              {...propsCampo("tipo_condicion")}
              className="concepto-grupo__ancho"
              requerido
              disabled={editando}
              textoVacio="Seleccione…"
              opciones={opciones(TIPOS_CONDICION)}
              ayuda={
                editando
                  ? "No se puede cambiar después de crear la condición."
                  : (TIPOS_CONDICION[tipo]?.ayuda ?? "Trasnoche y feriado se detectan solos; las demás se asignan.")
              }
            />
            {tipo === "TRASNOCHE" && (
              <CampoTexto
                {...propsCampo("minutos_nocturnos_minimos")}
                type="number"
                inputMode="numeric"
                min="1"
                max="600"
                step="1"
                requerido
                ayuda="Trabajados entre las 20:00 y las 06:00 para que la jornada cuente. 240 = 4 horas."
              />
            )}
            <Selector
              {...propsCampo("forma_calculo")}
              requerido
              disabled={editando}
              opciones={opciones(FORMAS_CONDICION)}
              ayuda={editando ? "No se puede cambiar después de crear la condición." : undefined}
            />
            <CampoAreaTexto
              {...propsCampo("descripcion")}
              className="concepto-grupo__ancho"
              filas={2}
              maxLength={250}
            />
          </div>
        </fieldset>

        {!editando && (
          <fieldset className="concepto-grupo">
            <legend>Valor y vigencia</legend>
            <div className="concepto-grupo__campos">
              <CampoTexto
                {...propsCampo("valor")}
                etiqueta={etiquetaValor(forma, tipo)}
                type="number"
                inputMode="decimal"
                min="0"
                step={esPorcentaje ? "0.0001" : "0.01"}
                requerido
                className="concepto-grupo__ancho"
                ayuda={
                  tipo === "ASIGNACION"
                    ? "Se prorratea por los días del mes en que la asignación está vigente."
                    : undefined
                }
              />
              <CampoTexto {...propsCampo("vigente_desde")} type="date" requerido />
              <CampoTexto {...propsCampo("vigente_hasta")} type="date" ayuda="Vacío si no tiene fecha de fin." />
            </div>
          </fieldset>
        )}

        <fieldset className="concepto-grupo">
          <legend>Cuenta contable</legend>
          <p className="concepto-nota">Opcional. Con cuenta, el bono entra en el asiento contable de la planilla.</p>
          <div className="concepto-grupo__campos">
            <CampoTexto
              {...propsCampo("cuenta_contable_codigo")}
              maxLength={20}
              inputMode="decimal"
              autoComplete="off"
              ayuda="Por ejemplo 5.1.1.05."
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
              ayuda="Las condiciones inactivas no se aplican al procesar un periodo."
              checked={valores.esta_activo}
              onChange={cambiar}
            />
          </>
        )}
      </form>
    </Modal>
  );
}
