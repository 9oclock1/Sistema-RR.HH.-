import { useState } from "react";
import { Alerta, Boton, CampoAreaTexto, CampoTexto, Modal, ModalConfirmacion, Selector } from "../../components/ui";
import { mapearErroresApi } from "../../utils/erroresApi";
import { CAMPOS_FORMULARIO, formularioAPayload, formularioVacio, hoyLaPaz, validarFormulario } from "./convocatorias";

const ID_FORMULARIO = "convocatoria-formulario";
const idCampo = (campo) => `cv-${campo}`;

const enfocarPrimerError = (errores) => {
  const campo = CAMPOS_FORMULARIO.find((c) => errores[c]);
  document.getElementById(idCampo(campo))?.focus();
};

export default function ConvocatoriaFormulario({ cargos, sucursales, onGuardar, onCancelar }) {
  const [valores, setValores] = useState(() => formularioVacio());
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const hoy = hoyLaPaz();

  const cambiar = (campo) => (evento) => {
    const { value } = evento.target;
    setValores((actuales) => ({ ...actuales, [campo]: value }));
    setErrores((actuales) => {
      if (!actuales[campo]) return actuales;
      const siguientes = { ...actuales };
      delete siguientes[campo];
      return siguientes;
    });
  };

  const propsCampo = (campo, etiqueta) => ({
    id: idCampo(campo),
    name: campo,
    etiqueta,
    value: valores[campo],
    onChange: cambiar(campo),
    error: errores[campo],
    requerido: true,
    disabled: enviando,
  });

  const alEnviar = (evento) => {
    evento.preventDefault();
    setErrorGeneral(null);
    const encontrados = validarFormulario(valores, hoy);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      enfocarPrimerError(encontrados);
      return;
    }
    setConfirmando(true);
  };

  const publicar = async () => {
    setEnviando(true);
    try {
      await onGuardar(formularioAPayload(valores));
    } catch (error) {
      const { porCampo, generales } = mapearErroresApi(error.errores ?? [], CAMPOS_FORMULARIO);
      setConfirmando(false);
      setErrores(porCampo);
      if (generales.length > 0) setErrorGeneral(generales.join(" "));
      else if (Object.keys(porCampo).length === 0) setErrorGeneral(error.message);
      else enfocarPrimerError(porCampo);
      setEnviando(false);
    }
  };

  const cargo = cargos.find((c) => c.id_cargo === valores.id_cargo);

  return (
    <>
      <Modal
        abierto
        titulo="Publicar convocatoria interna"
        tamano="lg"
        onCerrar={onCancelar}
        bloqueado={enviando || confirmando}
        pie={
          <>
            <Boton variante="sutil" onClick={onCancelar} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton variante="primario" type="submit" form={ID_FORMULARIO} disabled={enviando}>
              Publicar convocatoria
            </Boton>
          </>
        }
      >
        <form id={ID_FORMULARIO} className="cv-formulario" onSubmit={alEnviar} noValidate>
          {errorGeneral && (
            <Alerta tono="peligro" role="alert" titulo="No se pudo publicar la convocatoria">
              {errorGeneral}
            </Alerta>
          )}

          <div className="cv-formulario__campos">
            <Selector
              {...propsCampo("id_cargo", "Cargo que se convoca")}
              textoVacio="Seleccione un cargo del catálogo…"
              opciones={cargos.map((c) => ({ valor: c.id_cargo, etiqueta: `${c.nombre} — ${c.departamento}` }))}
              data-autofocus
            />
            <Selector
              {...propsCampo("id_sucursal", "Sucursal")}
              textoVacio="Seleccione la sucursal…"
              opciones={sucursales.map((s) => ({ valor: s.id_sucursal, etiqueta: s.nombre }))}
            />
            <CampoTexto
              {...propsCampo("titulo", "Título")}
              className="cv-formulario__ancho"
              maxLength={120}
              ayuda="Cómo verán la convocatoria los empleados."
            />
            <CampoAreaTexto
              {...propsCampo("descripcion_requisitos", "Requisitos")}
              className="cv-formulario__ancho"
              filas={4}
              maxLength={2000}
              ayuda="Formación, experiencia y condiciones para postular."
            />
            <CampoTexto
              {...propsCampo("meses_antiguedad_minima", "Antigüedad mínima (meses)")}
              type="number"
              inputMode="numeric"
              min={0}
              max={600}
              step={1}
              ayuda="0 si no se exige antigüedad."
            />
            <CampoTexto
              {...propsCampo("nota_minima_desempeno", "Nota mínima de desempeño")}
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={0.5}
              ayuda="Sobre 100, según las evaluaciones de desempeño."
            />
            <CampoTexto {...propsCampo("fecha_inicio_postulacion", "Inicio de postulaciones")} type="date" min={hoy} />
            <CampoTexto
              {...propsCampo("fecha_cierre_postulacion", "Cierre de postulaciones")}
              type="date"
              min={valores.fecha_inicio_postulacion || hoy}
              ayuda="Al llegar esta fecha la convocatoria deja de aceptar postulaciones."
            />
          </div>
        </form>
      </Modal>

      {confirmando && (
        <ModalConfirmacion
          abierto
          titulo="Confirmar publicación"
          textoConfirmar="Publicar y notificar"
          procesando={enviando}
          onConfirmar={publicar}
          onCancelar={() => !enviando && setConfirmando(false)}
        >
          Se publicará la convocatoria «{valores.titulo.trim()}»{cargo ? ` para el cargo ${cargo.nombre}` : ""} y se notificará a todos los
          empleados activos mediante el módulo de mensajería. Solo ellos podrán verla.
        </ModalConfirmacion>
      )}
    </>
  );
}
