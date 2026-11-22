import { useMemo, useState } from "react";
import { Alerta, Boton, CampoAreaTexto, CampoTexto, Modal, ModalConfirmacion, Selector } from "../../components/ui";
import ZonaRespaldo from "./ZonaRespaldo";
import { hoyLaPaz, validarFormularioDesvinculacion } from "./formato";
import useFormulario from "./useFormulario";

const ETIQUETAS = {
  id_empleado: "Colaborador",
  codigo_causal: "Causal de desvinculación",
  fecha_retiro: "Fecha de retiro",
  observaciones: "Observaciones",
  documento: "Documento de respaldo",
};

const INICIAL = {
  id_empleado: "",
  codigo_causal: "",
  fecha_retiro: hoyLaPaz(),
  observaciones: "",
  documento: null,
};

const ID_FORMULARIO = "desvinculacion-formulario";

export default function DesvinculacionFormulario({ empleados, causales, onGuardar, onCancelar }) {
  const [confirmacionAbierta, setConfirmacionAbierta] = useState(false);

  const { valores, establecerCampo, marcarErrores, enviar, enviando, propsCampo, resumen } = useFormulario({
    inicial: INICIAL,
    etiquetas: ETIQUETAS,
    prefijo: "desv",
    onGuardar: (datos) => {
      const formData = new FormData();
      formData.append("id_empleado", datos.id_empleado);
      formData.append("codigo_causal", datos.codigo_causal);
      formData.append("fecha_retiro", datos.fecha_retiro);
      if (datos.observaciones.trim()) {
        formData.append("observaciones", datos.observaciones.trim());
      }
      if (datos.documento) {
        formData.append("documento", datos.documento);
      }
      return onGuardar(formData);
    },
  });

  const empleadosActivos = useMemo(
    () => empleados.filter((e) => e.activo),
    [empleados]
  );

  const empleadoSeleccionado = useMemo(
    () => empleadosActivos.find((e) => e.id_empleado === valores.id_empleado),
    [empleadosActivos, valores.id_empleado]
  );

  const causalSeleccionada = useMemo(
    () => causales.find((c) => c.codigo === valores.codigo_causal),
    [causales, valores.codigo_causal]
  );

  const manejarSubmit = (evento) => {
    evento.preventDefault();
    const errores = validarFormularioDesvinculacion(valores);
    if (Object.keys(errores).length > 0) {
      marcarErrores(errores);
      return;
    }
    setConfirmacionAbierta(true);
  };

  const confirmarRegistro = async () => {
    try {
      await enviar(valores);
    } catch {
      setConfirmacionAbierta(false);
    }
  };

  const nombreConfirmacion = empleadoSeleccionado?.nombre_completo ?? "este colaborador";

  return (
    <>
      <Modal
        abierto
        titulo="Registrar baja de colaborador"
        onCerrar={onCancelar}
        bloqueado={enviando || confirmacionAbierta}
        pie={
          <>
            <Boton variante="sutil" onClick={onCancelar} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton variante="primario" type="submit" form={ID_FORMULARIO} cargando={enviando} disabled={enviando}>
              {enviando ? "Registrando…" : "Registrar baja"}
            </Boton>
          </>
        }
      >
        <form id={ID_FORMULARIO} className="desv-formulario" onSubmit={manejarSubmit} noValidate>
          {resumen}

          <div className="desv-formulario__campos">
            <Selector
              {...propsCampo("id_empleado")}
              requerido
              textoVacio="Seleccione un colaborador activo…"
              className="desv-formulario__ancho"
              opciones={empleadosActivos.map((e) => ({
                valor: e.id_empleado,
                etiqueta: `${e.nombre_completo} — ${e.numero_documento} (${e.cargo})`,
              }))}
              data-autofocus
            />

            <Selector
              {...propsCampo("codigo_causal")}
              requerido
              textoVacio="Seleccione la causal…"
              opciones={causales.map((c) => ({
                valor: c.codigo,
                etiqueta: c.nombre,
              }))}
            />

            <CampoTexto
              {...propsCampo("fecha_retiro")}
              type="date"
              max={hoyLaPaz()}
              requerido
              ayuda="No puede ser posterior a hoy."
            />
          </div>

          {causalSeleccionada && (
            <Alerta
              tono={causalSeleccionada.corresponde_desahucio ? "aviso" : "info"}
              titulo={
                causalSeleccionada.corresponde_desahucio
                  ? "Corresponde el pago de desahucio"
                  : "No corresponde el pago de desahucio"
              }
            >
              {causalSeleccionada.descripcion}
            </Alerta>
          )}

          <ZonaRespaldo
            id="desv-documento"
            archivo={valores.documento}
            onCambiar={(archivo) => establecerCampo("documento", archivo)}
            error={propsCampo("documento").error}
            deshabilitado={enviando}
          />

          <CampoAreaTexto
            {...propsCampo("observaciones")}
            filas={2}
            maxLength={500}
            ayuda="Opcional. Máximo 500 caracteres."
          />
        </form>
      </Modal>

      {confirmacionAbierta && (
        <ModalConfirmacion
          abierto
          titulo="Confirmar registro de baja"
          textoConfirmar="Confirmar baja"
          procesando={enviando}
          onConfirmar={confirmarRegistro}
          onCancelar={() => !enviando && setConfirmacionAbierta(false)}
        >
          Se iniciará el proceso de liquidación de {nombreConfirmacion} y quedará dado de baja en la lista de empleados.
        </ModalConfirmacion>
      )}
    </>
  );
}
