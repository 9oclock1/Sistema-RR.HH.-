import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { calcularDias, registrarSolicitud } from "../../api/solicitudesVacacion";
import { Alerta, Boton, CampoTexto, Esqueleto, ModalConfirmacion, Tarjeta } from "../../components/ui";
import { mapearErroresApi } from "../../utils/erroresApi";
import { TITULOS_PROBLEMA, formatearFechaConDia, formatearPeriodo, plural } from "./formato";

const CAMPOS = ["fecha_inicio", "fecha_fin"];
const VACIO = { fecha_inicio: "", fecha_fin: "" };
const ESPERA_CALCULO_MS = 300;

export default function SolicitudFormulario({ idEmpleado, saldo, supervisor, onRegistrada }) {
  const [fechas, setFechas] = useState(VACIO);
  const [calculo, setCalculo] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const refProblemas = useRef(null);

  const { fecha_inicio, fecha_fin } = fechas;
  const fechasCompletas = Boolean(fecha_inicio && fecha_fin);
  const ordenInvalido = fechasCompletas && fecha_fin < fecha_inicio;

  // Recalcula los días hábiles cada vez que cambian las fechas.
  useEffect(() => {
    if (!fechasCompletas || ordenInvalido) return undefined;
    let vigente = true;
    const temporizador = setTimeout(() => {
      setCalculando(true);
      calcularDias(idEmpleado, { fecha_inicio, fecha_fin })
        .then((datos) => {
          if (!vigente) return;
          setCalculo(datos);
          setErrores({});
          setErrorGeneral(null);
        })
        .catch((error) => {
          if (!vigente) return;
          setCalculo(null);
          const { porCampo, generales } = mapearErroresApi(error.detalles ?? [], CAMPOS);
          setErrores(porCampo);
          setErrorGeneral(generales[0] ?? (Object.keys(porCampo).length ? null : error.message));
        })
        .finally(() => vigente && setCalculando(false));
    }, ESPERA_CALCULO_MS);
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [idEmpleado, fecha_inicio, fecha_fin, fechasCompletas, ordenInvalido]);

  const cambiar = (evento) => {
    const { name, value } = evento.target;
    setFechas((actuales) => ({ ...actuales, [name]: value }));
    setCalculo(null);
    setErrores({});
    setErrorGeneral(null);
  };

  const problemas = calculo?.problemas ?? [];
  const erroresCampo = {
    ...errores,
    ...(ordenInvalido && { fecha_fin: "La fecha de conclusión no puede ser anterior a la de inicio." }),
  };

  const intentarEnviar = (evento) => {
    evento.preventDefault();
    if (!fechasCompletas) {
      setErrores({
        ...(!fecha_inicio && { fecha_inicio: "Ingrese la fecha de inicio." }),
        ...(!fecha_fin && { fecha_fin: "Ingrese la fecha de conclusión." }),
      });
      return;
    }
    if (problemas.length > 0) {
      refProblemas.current?.focus();
      return;
    }
    if (calculo && !calculando) setConfirmando(true);
  };

  const enviar = async () => {
    setEnviando(true);
    try {
      const solicitud = await registrarSolicitud(idEmpleado, fechas);
      setFechas(VACIO);
      setCalculo(null);
      onRegistrada(solicitud);
    } catch (error) {
      // El servidor revalida: si algo cambió (otra solicitud, saldo), se muestran los motivos del bloqueo.
      if (error.estado === 409 && error.detalles?.length) {
        setCalculo((actual) => (actual ? { ...actual, problemas: error.detalles } : actual));
        setTimeout(() => refProblemas.current?.focus());
      } else {
        setErrorGeneral(error.message);
      }
    } finally {
      setEnviando(false);
      setConfirmando(false);
    }
  };

  return (
    <Tarjeta titulo="Nueva solicitud" nivelTitulo={2} className="solicitud-vacaciones-tarjeta">
      <form className="solicitud-vacaciones-formulario" onSubmit={intentarEnviar} noValidate>
        <div className="solicitud-vacaciones-formulario__campos">
          <CampoTexto
            name="fecha_inicio"
            type="date"
            etiqueta="Fecha de inicio"
            ayuda={`Desde el ${formatearFechaConDia(saldo.fecha_minima_inicio)} (${saldo.dias_anticipacion_minima} días de anticipación).`}
            min={saldo.fecha_minima_inicio}
            value={fecha_inicio}
            onChange={cambiar}
            error={erroresCampo.fecha_inicio}
            requerido
          />
          <CampoTexto
            name="fecha_fin"
            type="date"
            etiqueta="Fecha de conclusión"
            ayuda="Último día de vacaciones, inclusive."
            min={fecha_inicio || saldo.fecha_minima_inicio}
            value={fecha_fin}
            onChange={cambiar}
            error={erroresCampo.fecha_fin}
            requerido
          />
        </div>

        <div aria-live="polite" className="solicitud-vacaciones-formulario__calculo">
          {calculando && !calculo && (
            <div className="solicitud-vacaciones-calculo" aria-busy="true">
              <p className="ds-solo-lector">Calculando días hábiles…</p>
              <Esqueleto ancho="40%" />
              <Esqueleto ancho="70%" />
            </div>
          )}
          {calculo && (
            <div className="solicitud-vacaciones-calculo" aria-busy={calculando || undefined}>
              <dl className="solicitud-vacaciones-calculo__cifras">
                <div className="solicitud-vacaciones-calculo__principal">
                  <dt>Días hábiles solicitados</dt>
                  <dd>{calculo.dias_habiles}</dd>
                </div>
                <div>
                  <dt>Días calendario</dt>
                  <dd>{calculo.dias_calendario}</dd>
                </div>
                <div>
                  <dt>Días de descanso</dt>
                  <dd>{calculo.dias_descanso}</dd>
                </div>
                <div>
                  <dt>Saldo después</dt>
                  <dd>{Math.max(0, calculo.dias_disponibles - calculo.dias_habiles)}</dd>
                </div>
              </dl>
              {calculo.feriados.length > 0 && (
                <p className="solicitud-vacaciones-nota">
                  No se cuentan {plural(calculo.feriados.length, "feriado", "feriados")}:{" "}
                  {calculo.feriados
                    .map((feriado) => `${feriado.nombre} (${formatearFechaConDia(feriado.fecha)})`)
                    .join(", ")}
                  .
                </p>
              )}
            </div>
          )}
        </div>

        {problemas.length > 0 && (
          <div className="solicitud-vacaciones-problemas" ref={refProblemas} tabIndex={-1}>
            {problemas.map((problema) => (
              <Alerta
                key={`${problema.codigo}-${problema.mensaje}`}
                tono="peligro"
                role="alert"
                titulo={TITULOS_PROBLEMA[problema.codigo] ?? "No se puede enviar"}
              >
                {problema.mensaje}
              </Alerta>
            ))}
          </div>
        )}

        {errorGeneral && (
          <Alerta tono="peligro" role="alert">
            {errorGeneral}
          </Alerta>
        )}

        <div className="solicitud-vacaciones-formulario__accion">
          <Boton variante="primario" type="submit" icono={Send} disabled={enviando}>
            Enviar solicitud
          </Boton>
          <p className="solicitud-vacaciones-nota">
            {supervisor
              ? `Quedará pendiente y se notificará a su supervisor, ${supervisor.nombres} ${supervisor.apellidos}.`
              : "Quedará pendiente. Su cargo no tiene supervisor directo asignado para notificar."}
          </p>
        </div>
      </form>

      <ModalConfirmacion
        abierto={confirmando}
        titulo="¿Enviar la solicitud de vacaciones?"
        variante="primario"
        textoConfirmar="Enviar solicitud"
        procesando={enviando}
        onConfirmar={enviar}
        onCancelar={() => setConfirmando(false)}
      >
        {calculo && fechasCompletas && (
          <>
            Solicita <strong>{plural(calculo.dias_habiles, "día hábil", "días hábiles")}</strong> del{" "}
            {formatearPeriodo(fecha_inicio, fecha_fin)}. La solicitud quedará <strong>pendiente</strong> hasta que su
            supervisor la revise.
          </>
        )}
      </ModalConfirmacion>
    </Tarjeta>
  );
}
