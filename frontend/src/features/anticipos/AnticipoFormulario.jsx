import { Boton, CampoAreaTexto, CampoTexto, Modal, Selector } from "../../components/ui";
import { TIPOS, hoyLaPaz, opciones } from "./formato";
import useFormulario from "./useFormulario";

const ETIQUETAS = {
  id_empleado: "Colaborador",
  tipo: "Tipo",
  monto: "Monto",
  numero_cuotas: "Número de cuotas",
  mes_inicio: "Mes de inicio",
  motivo: "Motivo",
};

const VACIO = {
  id_empleado: "",
  tipo: "",
  monto: "",
  numero_cuotas: "",
  // Formato "AAAA-MM" para el input type="month"; se completa con "-01" al enviar.
  mes_inicio: hoyLaPaz().slice(0, 7),
  motivo: "",
};

const ID_FORMULARIO = "anticipo-formulario";

export default function AnticipoFormulario({ empleados, onGuardar, onCancelar }) {
  const { enviar, enviando, propsCampo, resumen } = useFormulario({
    inicial: VACIO,
    etiquetas: ETIQUETAS,
    prefijo: "anticipo",
    onGuardar: ({ monto, numero_cuotas, motivo, mes_inicio, ...datos }) =>
      onGuardar({
        ...datos,
        monto: monto === "" ? null : Number(monto),
        numero_cuotas: numero_cuotas === "" ? null : Number(numero_cuotas),
        // El input type="month" entrega "AAAA-MM"; el backend exige el día 01 explícito.
        mes_inicio: mes_inicio ? `${mes_inicio}-01` : null,
        motivo: motivo.trim() || null,
      }),
  });

  return (
    <Modal
      abierto
      titulo="Nuevo anticipo o préstamo"
      onCerrar={onCancelar}
      bloqueado={enviando}
      pie={
        <>
          <Boton variante="sutil" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form={ID_FORMULARIO} cargando={enviando}>
            {enviando ? "Registrando…" : "Registrar"}
          </Boton>
        </>
      }
    >
      <form id={ID_FORMULARIO} className="anticipo-formulario" onSubmit={enviar} noValidate>
        {resumen}

        <div className="anticipo-formulario__campos">
          <Selector
            {...propsCampo("id_empleado")}
            requerido
            textoVacio="Seleccione…"
            className="anticipo-formulario__ancho"
            opciones={empleados.map((e) => ({
              valor: e.id_empleado,
              etiqueta: `${e.nombre_completo} — ${e.numero_documento}`,
            }))}
            data-autofocus
          />
          <Selector {...propsCampo("tipo")} requerido textoVacio="Seleccione…" opciones={opciones(TIPOS)} />
          <CampoTexto
            {...propsCampo("monto")}
            etiqueta="Monto (Bs)"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            requerido
          />
          <CampoTexto
            {...propsCampo("numero_cuotas")}
            type="number"
            inputMode="numeric"
            min="1"
            max="60"
            requerido
          />
          <CampoTexto
            {...propsCampo("mes_inicio")}
            type="month"
            requerido
            ayuda="Mes en que empieza a descontarse la primera cuota."
          />
          <CampoAreaTexto
            {...propsCampo("motivo")}
            className="anticipo-formulario__ancho"
            filas={2}
            maxLength={250}
          />
        </div>
        <p className="anticipo-nota">
          El sistema calcula la cuota y la rechaza si supera el porcentaje máximo de descuento permitido sobre el
          líquido pagable del colaborador.
        </p>
      </form>
    </Modal>
  );
}
