import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowLeftRight, LogIn, LogOut } from "lucide-react";
import { consultarJornada, registrarEntrada, registrarSalida } from "../../api/marcajes";
import {
  Alerta,
  Avatar,
  Boton,
  EncabezadoPagina,
  Esqueleto,
  ModalConfirmacion,
  Tarjeta,
} from "../../components/ui";
import IdentificacionEmpleado from "./IdentificacionEmpleado";
import Reloj from "./Reloj";
import ResumenJornada from "./ResumenJornada";
import { describirOrigen, formatearFechaJornada, formatearHora } from "./formato";
import { guardarEmpleado, leerEmpleado, olvidarEmpleado } from "./sesionEmpleado";
import "./marcaje.css";

const esRechazoDeIdentidad = (error) => error.estado === 401 || error.estado === 403;

function CargandoJornada() {
  return (
    <Tarjeta className="marcaje-tarjeta" aria-busy="true">
      <p className="ds-solo-lector" role="status">
        Verificando empleado…
      </p>
      <div className="marcaje-empleado">
        <Esqueleto forma="circulo" ancho="var(--size-avatar-lg)" alto="var(--size-avatar-lg)" />
        <div className="marcaje-empleado__datos">
          <Esqueleto ancho="30%" />
          <Esqueleto ancho="55%" />
        </div>
      </div>
      <Esqueleto forma="bloque" />
    </Tarjeta>
  );
}

export default function MarcajePage() {
  const [idInicial] = useState(leerEmpleado);
  const [idEmpleado, setIdEmpleado] = useState(idInicial);
  const [jornada, setJornada] = useState(null);
  const [cargando, setCargando] = useState(Boolean(idInicial));
  const [errorIdentificacion, setErrorIdentificacion] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const [marcando, setMarcando] = useState(null);
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [marcajesRealizados, setMarcajesRealizados] = useState(0);
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
    if (marcajesRealizados) refConfirmacion.current?.focus();
  }, [marcajesRealizados]);

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
    setEnfocarIdentificacion(true);
  };

  const marcar = async (tipo) => {
    setMarcando(tipo);
    setAviso(null);
    try {
      if (tipo === "entrada") {
        const entrada = await registrarEntrada(idEmpleado);
        setJornada((actual) => ({ ...actual, fecha_jornada: entrada.fecha_jornada, entrada }));
      } else {
        const resumen = await registrarSalida(idEmpleado);
        setJornada((actual) => ({ ...actual, ...resumen }));
      }
      setMarcajesRealizados((total) => total + 1);
    } catch (error) {
      if (error.estado === 409) {
        await consultarJornada(idEmpleado).then(setJornada, () => {});
        setAviso({ tono: "info", texto: error.message });
        setMarcajesRealizados((total) => total + 1);
      } else {
        setAviso({ tono: "peligro", texto: error.message });
      }
    } finally {
      setMarcando(null);
      setConfirmandoSalida(false);
    }
  };

  const entrada = jornada?.entrada;
  const salida = jornada?.salida;
  const nombre = jornada ? `${jornada.empleado.nombres} ${jornada.empleado.apellidos}` : "";

  return (
    <section className="marcaje" aria-labelledby="marcaje-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Asistencia" }]}
        enlace={Link}
        titulo="Marcaje de asistencia"
        idTitulo="marcaje-titulo"
        descripcion="Registre el inicio y el fin de su jornada laboral."
      />

      <div className="marcaje-columna">
        {errorCarga && (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudo consultar la jornada"
            acciones={
              idEmpleado && (
                <Boton tamano="sm" onClick={reintentar} cargando={cargando}>
                  Reintentar
                </Boton>
              )
            }
          >
            {errorCarga}
          </Alerta>
        )}

        {idEmpleado && !jornada && cargando && <CargandoJornada />}

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
          <Tarjeta className="marcaje-tarjeta">
            <div className="marcaje-empleado">
              <Avatar nombre={nombre} tamano="lg" decorativo />
              <div className="marcaje-empleado__datos">
                <p className="marcaje-etiqueta">Empleado</p>
                <h2 className="marcaje-empleado__nombre">{nombre}</h2>
              </div>
              <Boton variante="sutil" icono={ArrowLeftRight} onClick={cambiarEmpleado}>
                Cambiar empleado
              </Boton>
            </div>

            <div className="marcaje-reloj">
              <p className="marcaje-etiqueta">Hora actual en Bolivia</p>
              <Reloj />
              <p className="marcaje-reloj__fecha">Jornada del {formatearFechaJornada(jornada.fecha_jornada)}</p>
            </div>

            <div className="marcaje-avisos" aria-live="polite">
              {aviso && (
                <Alerta tono={aviso.tono} role={aviso.tono === "peligro" ? "alert" : undefined}>
                  {aviso.texto}
                </Alerta>
              )}
            </div>

            {salida ? (
              <ResumenJornada jornada={jornada} ref={refConfirmacion} />
            ) : entrada ? (
              <>
                <Alerta ref={refConfirmacion} tabIndex={-1} tono="exito" titulo="Entrada registrada">
                  <p>
                    <time className="marcaje-hora" dateTime={entrada.fecha_hora_marcaje}>
                      {formatearHora(entrada.fecha_hora_marcaje)}
                    </time>
                  </p>
                  <p>Origen: {describirOrigen(entrada)}</p>
                </Alerta>
                <div className="marcaje-accion">
                  <Boton
                    variante="primario"
                    icono={LogOut}
                    onClick={() => setConfirmandoSalida(true)}
                    disabled={Boolean(marcando)}
                    aria-describedby="salida-nota"
                  >
                    Marcar salida
                  </Boton>
                  <p id="salida-nota" className="marcaje-nota">
                    Al marcar la salida se cierra su jornada.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="marcaje-accion">
                  <Boton
                    variante="primario"
                    icono={LogIn}
                    onClick={() => marcar("entrada")}
                    cargando={marcando === "entrada"}
                    disabled={Boolean(marcando)}
                    aria-describedby="marcaje-nota"
                  >
                    {marcando === "entrada" ? "Registrando…" : "Marcar entrada"}
                  </Boton>
                  <p id="marcaje-nota" className="marcaje-nota">
                    Se guarda la hora del servidor en el momento de marcar.
                  </p>
                </div>
                <div className="marcaje-alternativa">
                  <p id="salida-sin-entrada-nota">¿Olvidó marcar su entrada y ya termina su jornada?</p>
                  <Boton
                    icono={LogOut}
                    onClick={() => setConfirmandoSalida(true)}
                    disabled={Boolean(marcando)}
                    aria-describedby="salida-sin-entrada-nota"
                  >
                    Marcar salida
                  </Boton>
                </div>
              </>
            )}
          </Tarjeta>
        )}
      </div>

      <ModalConfirmacion
        abierto={confirmandoSalida}
        titulo={entrada ? "¿Registrar su salida?" : "Salida sin entrada registrada"}
        variante={entrada ? "primario" : "peligro"}
        textoConfirmar={entrada ? "Marcar salida" : "Registrar salida"}
        procesando={marcando === "salida"}
        onConfirmar={() => marcar("salida")}
        onCancelar={() => setConfirmandoSalida(false)}
      >
        {entrada ? (
          <>
            Se guardará la hora actual como fin de la jornada que inició a las{" "}
            <strong>{formatearHora(entrada.fecha_hora_marcaje)}</strong>. Después no podrá volver a marcar en esta
            jornada.
          </>
        ) : (
          <>
            No tiene entrada registrada en esta jornada. La salida quedará <strong>pendiente de justificación</strong> y
            no podrá marcar entrada después. Si está iniciando su jornada, cancele y use «Marcar entrada».
          </>
        )}
      </ModalConfirmacion>
    </section>
  );
}
