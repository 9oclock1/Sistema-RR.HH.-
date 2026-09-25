import { useCallback, useEffect, useRef, useState } from "react";
import { consultarJornada, registrarEntrada } from "../../api/marcajes";
import IdentificacionEmpleado from "./IdentificacionEmpleado";
import Reloj from "./Reloj";
import { formatearFechaJornada, formatearHora } from "./formato";
import { guardarEmpleado, leerEmpleado, olvidarEmpleado } from "./sesionEmpleado";
import "./marcaje.css";

const esRechazoDeIdentidad = (error) => error.estado === 401 || error.estado === 403;

const describirOrigen = ({ origen_codigo, codigo_dispositivo }) =>
  origen_codigo === "BIOMETRICO" ? `Lector biométrico ${codigo_dispositivo}` : "Portal";

function IconoConfirmado() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function MarcajePage() {
  const [idInicial] = useState(leerEmpleado);
  const [idEmpleado, setIdEmpleado] = useState(idInicial);
  const [jornada, setJornada] = useState(null);
  const [cargando, setCargando] = useState(Boolean(idInicial));
  const [errorIdentificacion, setErrorIdentificacion] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const [marcando, setMarcando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [recienMarcado, setRecienMarcado] = useState(false);
  const [enfocarIdentificacion, setEnfocarIdentificacion] = useState(false);
  const refConfirmacion = useRef(null);

  const cargar = useCallback(
    (id) =>
      consultarJornada(id)
        .then((datos) => {
          guardarEmpleado(id);
          setIdEmpleado(id);
          setJornada(datos);
          setErrorCarga(null);
        })
        .catch((error) => {
          if (!esRechazoDeIdentidad(error)) {
            setErrorCarga(error.message);
            return;
          }
          olvidarEmpleado();
          setIdEmpleado(null);
          setJornada(null);
          setErrorCarga(null);
          setErrorIdentificacion(error.message);
        })
        .finally(() => setCargando(false)),
    []
  );

  useEffect(() => {
    if (idInicial) cargar(idInicial);
  }, [cargar, idInicial]);

  useEffect(() => {
    if (recienMarcado) refConfirmacion.current?.focus();
  }, [recienMarcado]);

  const identificar = (id) => {
    setErrorIdentificacion(null);
    setErrorCarga(null);
    setCargando(true);
    cargar(id);
  };

  const reintentar = () => {
    setErrorCarga(null);
    setCargando(true);
    cargar(idEmpleado);
  };

  const cambiarEmpleado = () => {
    olvidarEmpleado();
    setIdEmpleado(null);
    setJornada(null);
    setAviso(null);
    setRecienMarcado(false);
    setEnfocarIdentificacion(true);
  };

  const marcar = async () => {
    setMarcando(true);
    setAviso(null);
    try {
      const entrada = await registrarEntrada(idEmpleado);
      setJornada((actual) => ({ ...actual, fecha_jornada: entrada.fecha_jornada, entrada }));
      setRecienMarcado(true);
    } catch (error) {
      if (error.estado === 409) {
        await consultarJornada(idEmpleado).then(setJornada, () => {});
        setAviso({ tipo: "info", texto: error.message });
        setRecienMarcado(true);
      } else {
        setAviso({ tipo: "error", texto: error.message });
      }
    } finally {
      setMarcando(false);
    }
  };

  const entrada = jornada?.entrada;

  return (
    <section className="marcaje" aria-labelledby="marcaje-titulo">
      <div className="pagina-encabezado">
        <div>
          <h1 id="marcaje-titulo">Marcaje de asistencia</h1>
          <p className="subtitulo">Registre el inicio de su jornada laboral.</p>
        </div>
      </div>

      {errorCarga && (
        <div className="alerta alerta-error" role="alert">
          <p>{errorCarga}</p>
          {idEmpleado && (
            <button type="button" className="boton boton-compacto" onClick={reintentar} disabled={cargando}>
              Reintentar
            </button>
          )}
        </div>
      )}

      {idEmpleado && !jornada && cargando && (
        <p className="nota" role="status">
          Verificando empleado…
        </p>
      )}

      {!idEmpleado && (
        <IdentificacionEmpleado
          error={errorIdentificacion}
          procesando={cargando}
          enfocar={enfocarIdentificacion}
          onIdentificar={identificar}
          onEditar={() => setErrorIdentificacion(null)}
        />
      )}

      {jornada && (
        <div className="tarjeta marcaje-tarjeta">
          <div className="marcaje-empleado">
            <div>
              <p className="marcaje-etiqueta">Empleado</p>
              <h2>
                {jornada.empleado.nombres} {jornada.empleado.apellidos}
              </h2>
            </div>
            <button type="button" className="boton boton-texto" onClick={cambiarEmpleado}>
              Cambiar empleado
            </button>
          </div>

          <div className="reloj">
            <p className="marcaje-etiqueta">Hora actual en Bolivia</p>
            <Reloj />
            <p className="reloj-fecha">Jornada del {formatearFechaJornada(jornada.fecha_jornada)}</p>
          </div>

          <div className="marcaje-avisos" aria-live="polite">
            {aviso && (
              <div className={`alerta alerta-${aviso.tipo}`} role={aviso.tipo === "error" ? "alert" : undefined}>
                <p>{aviso.texto}</p>
              </div>
            )}
          </div>

          {entrada ? (
            <div className="confirmacion" ref={refConfirmacion} tabIndex={-1}>
              <IconoConfirmado />
              <div>
                <p className="confirmacion-titulo">Entrada registrada</p>
                <p className="confirmacion-hora">
                  <time dateTime={entrada.fecha_hora_marcaje}>{formatearHora(entrada.fecha_hora_marcaje)}</time>
                </p>
                <p className="confirmacion-detalle">Origen: {describirOrigen(entrada)}</p>
              </div>
            </div>
          ) : (
            <div className="marcaje-accion">
              <button
                type="button"
                className="boton boton-primario boton-grande"
                onClick={marcar}
                disabled={marcando}
                aria-describedby="marcaje-nota"
              >
                {marcando ? "Registrando…" : "Marcar entrada"}
              </button>
              <p id="marcaje-nota" className="campo-ayuda">
                Se guarda la hora del servidor en el momento de marcar.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
