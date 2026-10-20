import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { Bell, BellOff, CheckCheck, CircleCheck, CircleX } from "lucide-react";
import { Alerta, Boton, EstadoVacio, Esqueleto, useAvisos } from "../../components/ui";
import { formatearFecha } from "../comunicaciones/formatoFecha";
import { useEmpleado } from "../marcaje/sesionEmpleado";
import { useNotificaciones } from "./useNotificaciones";
import "./notificaciones.css";

const MAXIMO_VISIBLE = 99;

const ICONO_TIPO = { SOLICITUD_APROBADA: CircleCheck, SOLICITUD_RECHAZADA: CircleX };
const CLASE_TIPO = { SOLICITUD_APROBADA: "exito", SOLICITUD_RECHAZADA: "peligro" };

function etiquetaCampana(noLeidas) {
  if (noLeidas === 0) return "Notificaciones";
  return `Notificaciones, ${noLeidas} sin leer`;
}

// Campana del encabezado con el contador de alertas sin leer y el panel desplegable de avisos.
export default function CampanaNotificaciones() {
  const avisar = useAvisos();
  const idEmpleado = useEmpleado();
  const { noLeidas, items, cargando, error, cargar, leer, leerTodas } = useNotificaciones(idEmpleado);
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);
  const boton = useRef(null);
  const idPanel = useId();

  // Mientras el panel está abierto, la lista se mantiene al día con el contador.
  useEffect(() => {
    if (abierto) cargar();
  }, [abierto, noLeidas, cargar]);

  useEffect(() => {
    if (!abierto) return undefined;
    const cerrarAlHacerClicFuera = (evento) => {
      if (!raiz.current?.contains(evento.target)) setAbierto(false);
    };
    const cerrarConEscape = (evento) => {
      if (evento.key !== "Escape") return;
      setAbierto(false);
      boton.current?.focus();
    };
    document.addEventListener("pointerdown", cerrarAlHacerClicFuera);
    document.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.removeEventListener("pointerdown", cerrarAlHacerClicFuera);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [abierto]);

  const abrirNotificacion = (notificacion) => {
    leer(notificacion);
    setAbierto(false);
  };

  const marcarTodas = () =>
    leerTodas().catch((falla) =>
      avisar({ tono: "peligro", titulo: "No se pudieron marcar las alertas", mensaje: falla.message })
    );

  return (
    <div className="campana" ref={raiz}>
      <Boton
        ref={boton}
        variante="sutil"
        soloIcono
        icono={Bell}
        aria-label={etiquetaCampana(noLeidas)}
        aria-expanded={abierto}
        aria-controls={idPanel}
        aria-haspopup="dialog"
        onClick={() => setAbierto((actual) => !actual)}
      />
      {noLeidas > 0 && (
        <span className="campana__contador" aria-hidden="true">
          {noLeidas > MAXIMO_VISIBLE ? `${MAXIMO_VISIBLE}+` : noLeidas}
        </span>
      )}

      {abierto && (
        <section id={idPanel} className="campana__panel" role="dialog" aria-label="Notificaciones">
          <header className="campana__encabezado">
            <h2 className="campana__titulo">Notificaciones</h2>
            <Boton variante="sutil" tamano="sm" icono={CheckCheck} disabled={noLeidas === 0} onClick={marcarTodas}>
              Marcar todas como leídas
            </Boton>
          </header>

          <div className="campana__cuerpo">
            {!idEmpleado && (
              <EstadoVacio
                icono={BellOff}
                titulo="Aún no se identificó"
                mensaje="Ingrese su identificador de empleado en un módulo como «Licencias y permisos» para ver sus alertas."
              />
            )}

            {idEmpleado && error && (
              <Alerta
                tono="peligro"
                role="alert"
                titulo="No se pudieron cargar las alertas"
                acciones={
                  <Boton tamano="sm" onClick={cargar}>
                    Reintentar
                  </Boton>
                }
              >
                {error}
              </Alerta>
            )}

            {idEmpleado && !error && items === null && (
              <div className="campana__carga" role="status" aria-label="Cargando notificaciones">
                {[0, 1, 2].map((indice) => (
                  <Esqueleto key={indice} forma="bloque" alto="3.5rem" />
                ))}
              </div>
            )}

            {idEmpleado && !error && items?.length === 0 && !cargando && (
              <EstadoVacio
                icono={Bell}
                titulo="No tiene notificaciones"
                mensaje="Aquí verá si sus solicitudes fueron aprobadas o rechazadas."
              />
            )}

            {idEmpleado && !error && items?.length > 0 && (
              <ul className="campana__lista">
                {items.map((notificacion) => {
                  const Icono = ICONO_TIPO[notificacion.tipo] ?? Bell;
                  return (
                    <li key={notificacion.id_notificacion}>
                      <Link
                        to={notificacion.enlace ?? "/"}
                        className={`campana__aviso ds-foco ${notificacion.leida ? "" : "campana__aviso--nuevo"}`}
                        onClick={() => abrirNotificacion(notificacion)}
                      >
                        <Icono
                          className={`ds-icono campana__icono campana__icono--${CLASE_TIPO[notificacion.tipo] ?? "info"}`}
                          aria-hidden="true"
                        />
                        <span className="campana__texto">
                          <span className="campana__aviso-titulo">
                            {!notificacion.leida && <span className="ds-solo-lector">Sin leer. </span>}
                            {notificacion.titulo}
                          </span>
                          <span className="campana__aviso-mensaje">{notificacion.mensaje}</span>
                          <span className="campana__aviso-fecha">{formatearFecha(notificacion.creado_en)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      <p className="ds-solo-lector" role="status">
        {noLeidas > 0 ? `${noLeidas} notificaciones sin leer` : ""}
      </p>
    </div>
  );
}
