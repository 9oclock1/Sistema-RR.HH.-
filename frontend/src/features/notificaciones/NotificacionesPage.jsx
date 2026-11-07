import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Bell, CheckCheck, CircleCheck, CircleX, ExternalLink, Mail, MailX } from "lucide-react";
import { listarNotificaciones, marcarLeida, marcarTodasLeidas } from "../../api/notificaciones";
import {
  Alerta,
  Boton,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  Pestanas,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import Revisor from "../marcaje/Revisor";
import useRevisor from "../marcaje/useRevisor";
import { avisarCambioNotificaciones } from "./eventosNotificaciones";
import "../marcaje/marcaje.css";
import "./notificaciones.css";

const TAMANO_PAGINA = 15;

const TIPOS = {
  SOLICITUD_APROBADA: { icono: CircleCheck, tono: "exito", texto: "Aprobada" },
  SOLICITUD_RECHAZADA: { icono: CircleX, tono: "peligro", texto: "Rechazada" },
};

const fechaCompleta = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  dateStyle: "long",
  timeStyle: "short",
});

function EstadoCorreo({ estado }) {
  if (estado === "ENVIADO") {
    return (
      <Etiqueta tono="exito" icono={Mail}>
        Correo enviado
      </Etiqueta>
    );
  }
  if (estado === "FALLIDO") {
    return (
      <Etiqueta tono="aviso" icono={MailX}>
        Correo no enviado
      </Etiqueta>
    );
  }
  return null;
}

function Aviso({ notificacion, onLeer }) {
  const tipo = TIPOS[notificacion.tipo] ?? { icono: Bell, tono: "info", texto: "Aviso" };
  const Icono = tipo.icono;
  return (
    <li className={`nt-aviso ${notificacion.leida ? "" : "nt-aviso--nuevo"}`}>
      <Icono className={`ds-icono nt-aviso__icono nt-aviso__icono--${tipo.tono}`} aria-hidden="true" />
      <div className="nt-aviso__cuerpo">
        <h3 className="nt-aviso__titulo">
          {!notificacion.leida && <span className="ds-solo-lector">Sin leer. </span>}
          {notificacion.titulo}
        </h3>
        {/* La justificación del rechazo viene en líneas aparte: se conservan los saltos. */}
        <p className="nt-aviso__mensaje">{notificacion.mensaje}</p>
        <p className="nt-aviso__meta">
          <time dateTime={notificacion.creado_en}>{fechaCompleta.format(new Date(notificacion.creado_en))}</time>
          <EstadoCorreo estado={notificacion.correo_estado} />
        </p>
      </div>
      <div className="nt-aviso__acciones">
        {notificacion.enlace && (
          <Boton
            as={Link}
            to={notificacion.enlace}
            tamano="sm"
            variante={notificacion.leida ? "predeterminado" : "primario"}
            icono={ExternalLink}
            onClick={() => onLeer(notificacion)}
            aria-label={`Ver la solicitud: ${notificacion.titulo}`}
          >
            Ver solicitud
          </Boton>
        )}
        {!notificacion.leida && (
          <Boton
            tamano="sm"
            variante="sutil"
            icono={CheckCheck}
            onClick={() => onLeer(notificacion)}
            aria-label={`Marcar como leída: ${notificacion.titulo}`}
          >
            Marcar leída
          </Boton>
        )}
      </div>
    </li>
  );
}

function Cargando() {
  return (
    <div className="nt-carga" role="status" aria-label="Cargando notificaciones">
      {[0, 1, 2].map((indice) => (
        <Esqueleto key={indice} forma="bloque" alto="4.5rem" />
      ))}
    </div>
  );
}

// Lista del empleado identificado. Se monta de nuevo al cambiar de empleado, así nunca muestra alertas ajenas.
function Bandeja({ idEmpleado }) {
  const avisar = useAvisos();
  const [filtro, setFiltro] = useState("todas");
  const [estado, setEstado] = useState({ items: null, total: 0, noLeidas: 0, error: null, cargandoMas: false });
  // Descarta la respuesta de una consulta vieja si el usuario ya cambió de pestaña.
  const consulta = useRef(0);

  const cargar = useCallback(
    async (soloNoLeidas, desplazamiento) => {
      const mia = ++consulta.current;
      try {
        const respuesta = await listarNotificaciones(idEmpleado, { soloNoLeidas, limite: TAMANO_PAGINA, desplazamiento });
        if (mia !== consulta.current) return;
        setEstado((previo) => {
          const conocidas = new Set((desplazamiento ? previo.items : []).map((n) => n.id_notificacion));
          const nuevas = respuesta.notificaciones.filter((n) => !conocidas.has(n.id_notificacion));
          return {
            items: desplazamiento ? [...previo.items, ...nuevas] : nuevas,
            total: respuesta.total,
            noLeidas: respuesta.no_leidas,
            error: null,
            cargandoMas: false,
          };
        });
      } catch (falla) {
        if (mia !== consulta.current) return;
        setEstado((previo) => ({ ...previo, error: falla.message, cargandoMas: false }));
      }
    },
    [idEmpleado]
  );

  useEffect(() => {
    cargar(false, 0);
  }, [cargar]);

  const cambiarFiltro = (nuevo) => {
    if (nuevo === filtro) return;
    setFiltro(nuevo);
    setEstado((previo) => ({ ...previo, items: null, error: null, cargandoMas: false }));
    cargar(nuevo === "no_leidas", 0);
  };

  const reintentar = () => {
    setEstado((previo) => ({ ...previo, items: previo.items, error: null }));
    cargar(filtro === "no_leidas", estado.items?.length ?? 0);
  };

  const verMas = () => {
    setEstado((previo) => ({ ...previo, cargandoMas: true, error: null }));
    cargar(filtro === "no_leidas", estado.items.length);
  };

  // En la pestaña «Sin leer» la alerta leída se queda a la vista hasta actualizar, para no mover la lista bajo el cursor.
  const leer = async (notificacion) => {
    if (notificacion.leida) return;
    const marcar = (leida, delta) =>
      setEstado((previo) => ({
        ...previo,
        noLeidas: Math.max(0, previo.noLeidas + delta),
        items: previo.items?.map((n) => (n.id_notificacion === notificacion.id_notificacion ? { ...n, leida } : n)),
      }));
    marcar(true, -1);
    try {
      await marcarLeida(idEmpleado, notificacion.id_notificacion);
      avisarCambioNotificaciones();
    } catch (falla) {
      marcar(false, 1);
      avisar({ tono: "peligro", titulo: "No se pudo marcar como leída", mensaje: falla.message });
    }
  };

  const leerTodas = async () => {
    try {
      await marcarTodasLeidas(idEmpleado);
      setEstado((previo) => ({ ...previo, noLeidas: 0, items: previo.items?.map((n) => ({ ...n, leida: true })) }));
      avisarCambioNotificaciones();
    } catch (falla) {
      avisar({ tono: "peligro", titulo: "No se pudieron marcar las alertas", mensaje: falla.message });
    }
  };

  const { items, total, noLeidas, error, cargandoMas } = estado;
  const hayMas = items !== null && items.length < total;

  let contenido;
  if (error && items === null) {
    contenido = (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudieron cargar las notificaciones"
        acciones={
          <Boton tamano="sm" onClick={reintentar}>
            Reintentar
          </Boton>
        }
      >
        {error}
      </Alerta>
    );
  } else if (items === null) {
    contenido = <Cargando />;
  } else if (items.length === 0) {
    contenido = (
      <EstadoVacio
        icono={Bell}
        titulo={filtro === "no_leidas" ? "No tiene notificaciones sin leer" : "No tiene notificaciones"}
        mensaje="Aquí verá si sus solicitudes de vacaciones, permisos y licencias fueron aprobadas o rechazadas."
      />
    );
  } else {
    contenido = (
      <>
        <ul className="nt-lista">
          {items.map((notificacion) => (
            <Aviso key={notificacion.id_notificacion} notificacion={notificacion} onLeer={leer} />
          ))}
        </ul>
        {error && (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudieron cargar más notificaciones"
            acciones={
              <Boton tamano="sm" onClick={reintentar}>
                Reintentar
              </Boton>
            }
          >
            {error}
          </Alerta>
        )}
        <div className="nt-pie">
          <p className="nt-pie__conteo" role="status">
            Mostrando {items.length} de {total}
          </p>
          {hayMas && (
            <Boton onClick={verMas} cargando={cargandoMas}>
              Ver más
            </Boton>
          )}
        </div>
      </>
    );
  }

  return (
    <Tarjeta
      nivelTitulo={2}
      titulo="Mis notificaciones"
      acciones={
        <Boton icono={CheckCheck} disabled={noLeidas === 0} onClick={leerTodas}>
          Marcar todas como leídas
        </Boton>
      }
    >
      <Pestanas
        etiqueta="Filtro de notificaciones"
        activa={filtro}
        onCambiar={cambiarFiltro}
        pestanas={[
          { id: "todas", etiqueta: "Todas", contenido },
          { id: "no_leidas", etiqueta: "Sin leer", contador: noLeidas, contenido },
        ]}
      />
    </Tarjeta>
  );
}

// Vista completa de las alertas de resultado de solicitudes (RF-34): el historial detrás de la campana del encabezado.
export default function NotificacionesPage() {
  const { revisor, verificando, identificar, cambiar } = useRevisor();

  return (
    <section className="nt-pagina" aria-labelledby="nt-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Comunicaciones" }]}
        enlace={Link}
        titulo="Notificaciones"
        idTitulo="nt-titulo"
        descripcion="Resultado de sus solicitudes de vacaciones, permisos y licencias, con la justificación cuando se rechazan."
      />

      {!verificando && (
        <div className="nt-identidad">
          {revisor ? (
            <Revisor revisor={revisor} etiqueta="Empleado" onCambiar={cambiar} />
          ) : (
            <Revisor etiqueta="Empleado" onIdentificado={identificar} />
          )}
        </div>
      )}

      {revisor && <Bandeja key={revisor.id} idEmpleado={revisor.id} />}
    </section>
  );
}
