import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowLeftRight } from "lucide-react";
import { consultarSaldo, listarSolicitudes } from "../../api/solicitudesVacacion";
import { Alerta, Avatar, Boton, EncabezadoPagina, Esqueleto, Tarjeta } from "../../components/ui";
import IdentificacionEmpleado from "../marcaje/IdentificacionEmpleado";
import { guardarEmpleado, leerEmpleado, olvidarEmpleado } from "../marcaje/sesionEmpleado";
import DetalleSolicitudVacacion from "./DetalleSolicitudVacacion";
import SaldoVacaciones from "./SaldoVacaciones";
import SolicitudFormulario from "./SolicitudFormulario";
import TablaSolicitudes from "./TablaSolicitudes";
import { formatearFecha, formatearPeriodo, plural } from "./formato";
// Estilos de la tarjeta de identificación, compartida con el marcaje.
import "../marcaje/marcaje.css";
import "./solicitudVacaciones.css";

const esRechazoDeIdentidad = (error) => error.estado === 401 || error.estado === 403;

function CargandoSaldo() {
  return (
    <Tarjeta className="solicitud-vacaciones-tarjeta" aria-busy="true">
      <p className="ds-solo-lector" role="status">
        Consultando saldo de vacaciones…
      </p>
      <Esqueleto ancho="30%" />
      <Esqueleto forma="bloque" />
    </Tarjeta>
  );
}

export default function SolicitudVacacionesPage() {
  const [idInicial] = useState(leerEmpleado);
  const [idEmpleado, setIdEmpleado] = useState(idInicial);
  const [saldo, setSaldo] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(Boolean(idInicial));
  const [errorIdentificacion, setErrorIdentificacion] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const [registrada, setRegistrada] = useState(null);
  const [enfocarIdentificacion, setEnfocarIdentificacion] = useState(false);
  const refConfirmacion = useRef(null);
  const refDetalle = useRef(null);
  // RF-34: las alertas de resultado abren esta pantalla con ?solicitud=<id>.
  const [parametros, setParametros] = useSearchParams();
  const idDetalle = parametros.get("solicitud");
  const detalle = solicitudes.find((s) => s.id_solicitud === idDetalle);

  const cargar = useCallback(
    (id) =>
      Promise.all([consultarSaldo(id), listarSolicitudes(id)])
        .then(([datosSaldo, datosSolicitudes]) => {
          guardarEmpleado(id);
          setIdEmpleado(id);
          setSaldo(datosSaldo);
          setSolicitudes(datosSolicitudes);
          setErrorCarga(null);
        })
        .catch((error) => {
          if (!esRechazoDeIdentidad(error)) {
            setErrorCarga(error.message);
            return;
          }
          olvidarEmpleado();
          setIdEmpleado(null);
          setSaldo(null);
          setErrorIdentificacion(error.message);
        })
        .finally(() => setCargando(false)),
    []
  );

  useEffect(() => {
    if (idInicial) cargar(idInicial);
  }, [cargar, idInicial]);

  useEffect(() => {
    if (registrada) refConfirmacion.current?.focus();
  }, [registrada]);

  useEffect(() => {
    if (detalle) refDetalle.current?.focus();
  }, [detalle]);

  const verDetalle = (solicitud) => setParametros({ solicitud: solicitud.id_solicitud });
  const cerrarDetalle = () => setParametros({});

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
    setSaldo(null);
    setSolicitudes([]);
    setRegistrada(null);
    setEnfocarIdentificacion(true);
  };

  const alRegistrar = (solicitud) => {
    setRegistrada(solicitud);
    cargar(idEmpleado);
  };

  const empleado = saldo?.empleado;
  const nombre = empleado ? `${empleado.nombres} ${empleado.apellidos}` : "";

  return (
    <section className="solicitud-vacaciones" aria-labelledby="vacaciones-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Asistencia" }]}
        enlace={Link}
        titulo="Solicitud de vacaciones"
        idTitulo="vacaciones-titulo"
        descripcion="Consulte su saldo y solicite vacaciones indicando el periodo."
      />

      <div className="solicitud-vacaciones-columna">
        {errorCarga && (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudo consultar sus vacaciones"
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

        {idEmpleado && !saldo && cargando && <CargandoSaldo />}

        {!idEmpleado && (
          <IdentificacionEmpleado
            error={errorIdentificacion}
            procesando={cargando}
            enfocar={enfocarIdentificacion}
            onIdentificar={identificar}
            onEditar={() => setErrorIdentificacion(null)}
          />
        )}

        {saldo && (
          <>
            <Tarjeta className="solicitud-vacaciones-tarjeta">
              <div className="marcaje-empleado">
                <Avatar nombre={nombre} tamano="lg" decorativo />
                <div className="marcaje-empleado__datos">
                  <p className="marcaje-etiqueta">Colaborador</p>
                  <h2 className="marcaje-empleado__nombre">{nombre}</h2>
                </div>
                <Boton variante="sutil" icono={ArrowLeftRight} onClick={cambiarEmpleado}>
                  Cambiar empleado
                </Boton>
              </div>
            </Tarjeta>

            {registrada && (
              <Alerta
                ref={refConfirmacion}
                tabIndex={-1}
                tono={registrada.aviso_notificacion ? "aviso" : "exito"}
                titulo="Solicitud enviada"
                onCerrar={() => setRegistrada(null)}
              >
                <p>
                  {formatearPeriodo(registrada.fecha_inicio, registrada.fecha_fin)} ·{" "}
                  {plural(registrada.dias_habiles, "día hábil", "días hábiles")}. Quedó en estado{" "}
                  <strong>pendiente</strong>.
                </p>
                <p>
                  {registrada.aviso_notificacion ??
                    `Se notificó a su supervisor, ${registrada.supervisor.nombres} ${registrada.supervisor.apellidos}.`}
                </p>
              </Alerta>
            )}

            <SaldoVacaciones saldo={saldo} />

            {saldo.habilitado ? (
              <SolicitudFormulario
                key={idEmpleado}
                idEmpleado={idEmpleado}
                saldo={saldo}
                supervisor={empleado.supervisor}
                onRegistrada={alRegistrar}
              />
            ) : (
              <Alerta tono="aviso" titulo="Aún no puede solicitar vacaciones">
                Se requiere un año de antigüedad. Podrá solicitarlas desde el {formatearFecha(saldo.habilitado_desde)}.
              </Alerta>
            )}

            {detalle && <DetalleSolicitudVacacion ref={refDetalle} solicitud={detalle} onCerrar={cerrarDetalle} />}
            {idDetalle && !detalle && !cargando && (
              <Alerta tono="aviso" titulo="No se encontró la solicitud" onCerrar={cerrarDetalle}>
                La solicitud indicada no existe o pertenece a otro empleado.
              </Alerta>
            )}

            <TablaSolicitudes
              solicitudes={solicitudes}
              cargando={cargando && solicitudes.length === 0}
              onVerDetalle={verDetalle}
            />
          </>
        )}
      </div>
    </section>
  );
}
