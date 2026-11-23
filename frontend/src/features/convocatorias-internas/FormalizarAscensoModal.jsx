import { useState } from "react";
import { Alerta, Boton, CampoAreaTexto, CampoTexto, Modal } from "../../components/ui";
import { formalizarAscenso } from "../../api/convocatoriasInternas";
import { mapearErroresApi } from "../../utils/erroresApi";
import {
  CAMPOS_ASCENSO,
  formatearFecha,
  formularioAscensoAPayload,
  formularioAscensoVacio,
  hoyLaPaz,
  validarFormularioAscenso,
} from "./convocatorias";

const ID_FORMULARIO = "formalizar-ascenso";
const idCampo = (campo) => `asc-${campo}`;

const enfocarPrimerError = (errores) => {
  const campo = CAMPOS_ASCENSO.find((c) => errores[c]);
  document.getElementById(idCampo(campo))?.focus();
};

// KAN-84: el Administrador formaliza el ascenso del postulante apto seleccionado. Con vigencia hoy el cargo cambia
// enseguida; con vigencia futura queda programado. En ambos casos se registra la adenda, se cierra la convocatoria
// y se avisa al empleado.
export default function FormalizarAscensoModal({ convocatoria, postulacion, onFormalizado, onCancelar }) {
  const hoy = hoyLaPaz();
  const [valores, setValores] = useState(() => formularioAscensoVacio(hoy));
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

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

  const propsCampo = (campo, etiqueta, requerido = false) => ({
    id: idCampo(campo),
    name: campo,
    etiqueta,
    value: valores[campo],
    onChange: cambiar(campo),
    error: errores[campo],
    requerido,
    disabled: enviando,
  });

  const alEnviar = async (evento) => {
    evento.preventDefault();
    setErrorGeneral(null);
    const encontrados = validarFormularioAscenso(valores, hoy);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      enfocarPrimerError(encontrados);
      return;
    }

    setEnviando(true);
    try {
      const resultado = await formalizarAscenso(convocatoria.id_convocatoria, postulacion.id_postulacion, formularioAscensoAPayload(valores));
      onFormalizado(resultado);
    } catch (error) {
      const { porCampo, generales } = mapearErroresApi(error.errores ?? [], CAMPOS_ASCENSO);
      setErrores(porCampo);
      if (generales.length > 0) setErrorGeneral(generales.join(" "));
      else if (Object.keys(porCampo).length === 0) setErrorGeneral(error.message);
      else enfocarPrimerError(porCampo);
      setEnviando(false);
    }
  };

  const programado = valores.fecha_vigencia > hoy;

  return (
    <Modal
      abierto
      titulo={`Formalizar ascenso de ${postulacion.nombre_completo}`}
      tamano="md"
      onCerrar={onCancelar}
      bloqueado={enviando}
      pie={
        <>
          <Boton variante="sutil" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form={ID_FORMULARIO} cargando={enviando}>
            Formalizar ascenso
          </Boton>
        </>
      }
    >
      <form id={ID_FORMULARIO} className="cv-formulario" onSubmit={alEnviar} noValidate>
        {errorGeneral && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo formalizar el ascenso">
            {errorGeneral}
          </Alerta>
        )}

        <p className="cv-sutil">
          {postulacion.nombre_completo} pasará de {postulacion.cargo_actual} a <strong>{convocatoria.cargo}</strong> en {convocatoria.sucursal}, con
          el nivel salarial y el jefe directo de ese cargo. El cambio se registra como adenda en su historial contractual, la
          convocatoria se cierra y se le avisa por mensajería.
        </p>

        <div className="cv-formulario__campos">
          <CampoTexto
            {...propsCampo("fecha_vigencia", "Fecha de vigencia", true)}
            type="date"
            min={hoy}
            data-autofocus
            ayuda={
              programado
                ? `El cargo cambiará automáticamente el ${formatearFecha(valores.fecha_vigencia)}; la planilla usa el nuevo haber desde esa fecha.`
                : "El cargo cambia hoy mismo."
            }
          />
          <CampoTexto
            {...propsCampo("haber_mensual_pactado", "Nuevo haber mensual (Bs)")}
            inputMode="decimal"
            ayuda="Opcional. Por defecto, el salario referencial del cargo (o el haber actual, si es mayor)."
          />
          <CampoTexto
            {...propsCampo("numero_contrato", "Número de la adenda")}
            maxLength={40}
            ayuda="Opcional. Si lo deja vacío se genera uno."
          />
          <CampoAreaTexto
            {...propsCampo("observaciones", "Observaciones")}
            className="cv-formulario__ancho"
            filas={3}
            maxLength={1000}
            ayuda="Se agregan a la justificación de la adenda."
          />
        </div>
      </form>
    </Modal>
  );
}
