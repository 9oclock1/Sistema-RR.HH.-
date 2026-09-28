import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, Clock, Inbox, Mail, MailOpen, Search, ShieldAlert } from "lucide-react";
import { abrirMensaje, confirmarRecepcion, consultarBandeja, obtenerDestinatariosDisponibles } from "../../api/comunicaciones";
import {
  Alerta,
  Avatar,
  Boton,
  CampoTexto,
  Contador,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  Modal,
  Selector,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import { formatearFecha, formatearFechaLarga } from "./formatoFecha";
import "./comunicaciones.css";

const EMPLEADO_PREDETERMINADO = "4192f252-acf0-4522-a109-e051cad9a50b"; // Ana Quispe Mamani

export default function BandejaMensajesPage() {
  const avisar = useAvisos();

  // Empleado activo para consultar la bandeja (simulación de sesión)
  const [idEmpleado, setIdEmpleado] = useState(
    () => localStorage.getItem("rrhh.idEmpleado") || EMPLEADO_PREDETERMINADO
  );

  const [listaEmpleados, setListaEmpleados] = useState([]);
  const [mensajes, setMensajes] = useState([]);
  const [totalNoLeidos, setTotalNoLeidos] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState("todos"); // 'todos' | 'no_leidos' | 'leidos'
  const [busqueda, setBusqueda] = useState("");

  // Mensaje seleccionado para visualización detallada en Modal
  const [mensajeSeleccionado, setMensajeSeleccionado] = useState(null);
  const [confirmandoRecepcion, setConfirmandoRecepcion] = useState(false);

  // Cargar lista de empleados para el selector
  useEffect(() => {
    obtenerDestinatariosDisponibles()
      .then((datos) => {
        if (datos?.empleados) setListaEmpleados(datos.empleados);
      })
      .catch(() => {
        /* fallback silencioso */
      });
  }, []);

  // Cargar bandeja del empleado con limpieza de efecto
  useEffect(() => {
    if (!idEmpleado) return;
    let cancelado = false;

    consultarBandeja(idEmpleado, { estado: filtroEstado, busqueda })
      .then((datos) => {
        if (cancelado) return;
        setMensajes(datos.mensajes || []);
        setTotalNoLeidos(datos.no_leidos || 0);
        setErrorCarga(null);
      })
      .catch((err) => {
        if (cancelado) return;
        setErrorCarga(err.message || "No se pudo cargar la bandeja de mensajes.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [idEmpleado, filtroEstado, busqueda]);

  const recargarBandeja = () => {
    setCargando(true);
    setErrorCarga(null);
    consultarBandeja(idEmpleado, { estado: filtroEstado, busqueda })
      .then((datos) => {
        setMensajes(datos.mensajes || []);
        setTotalNoLeidos(datos.no_leidos || 0);
      })
      .catch((err) => {
        setErrorCarga(err.message || "No se pudo cargar la bandeja de mensajes.");
      })
      .finally(() => setCargando(false));
  };

  // Al cambiar empleado en el selector de pruebas
  const handleCambiarEmpleado = (nuevoId) => {
    setIdEmpleado(nuevoId);
    try {
      localStorage.setItem("rrhh.idEmpleado", nuevoId);
    } catch {
      // Sin almacenamiento local disponible
    }
    setMensajeSeleccionado(null);
    setCargando(true);
  };

  // RF-66 AC 3: Al abrir un mensaje, se marca como leído automáticamente
  const handleAbrirMensaje = async (mensaje) => {
    setMensajeSeleccionado(mensaje);

    try {
      const detalle = await abrirMensaje(mensaje.id_destinatario, idEmpleado);
      setMensajeSeleccionado(detalle);

      // Si estaba no leído, actualizar estado local y contador
      if (mensaje.estado_codigo === "NO_LEIDO") {
        setMensajes((prev) =>
          prev.map((m) =>
            m.id_destinatario === mensaje.id_destinatario
              ? { ...m, id_estado: 2, estado_codigo: "LEIDO", estado_nombre: "Leído", fecha_lectura: detalle.fecha_lectura }
              : m
          )
        );
        setTotalNoLeidos((count) => Math.max(0, count - 1));
      }
    } catch (err) {
      avisar({ tono: "peligro", titulo: "Error al abrir mensaje", mensaje: err.message });
    }
  };

  // RF-67 AC 1 & 2: Confirmación explícita de recepción
  const handleConfirmarRecepcion = async () => {
    if (!mensajeSeleccionado) return;
    setConfirmandoRecepcion(true);

    try {
      const resultado = await confirmarRecepcion(mensajeSeleccionado.id_destinatario, idEmpleado);
      setMensajeSeleccionado((prev) => ({
        ...prev,
        id_estado: 3,
        estado_codigo: "CONFIRMADO",
        estado_nombre: "Confirmado",
        fecha_confirmacion: resultado.fecha_confirmacion,
        solicita_confirmacion: false,
      }));

      // Actualizar en la lista de mensajes
      setMensajes((prev) =>
        prev.map((m) =>
          m.id_destinatario === mensajeSeleccionado.id_destinatario
            ? { ...m, id_estado: 3, estado_codigo: "CONFIRMADO", estado_nombre: "Confirmado", fecha_confirmacion: resultado.fecha_confirmacion }
            : m
        )
      );

      avisar({
        tono: "exito",
        titulo: "Recepción confirmada",
        mensaje: "Su constancia de lectura ha sido registrada para auditoría.",
      });
    } catch (err) {
      avisar({ tono: "peligro", titulo: "Error al confirmar", mensaje: err.message });
    } finally {
      setConfirmandoRecepcion(false);
    }
  };

  const opcionesEmpleados = useMemo(() => {
    const opciones = listaEmpleados.map((emp) => ({
      valor: emp.id_empleado,
      etiqueta: `${emp.nombres} ${emp.apellidos} (${emp.cargo || "Empleado"})${emp.activo ? "" : " - Inactivo"}`,
    }));

    // Opción para probar usuario nuevo sin mensajes (RF-66 AC 4)
    opciones.push({
      valor: "00000000-0000-0000-0000-000000000099",
      etiqueta: "Empleado Nuevo (Sin mensajes)",
    });

    return opciones;
  }, [listaEmpleados]);

  // Color de etiqueta según tipo de comunicación
  const obtenerTonoTipo = (tipoCodigo) => {
    switch (tipoCodigo) {
      case "COMUNICADO":
        return "info";
      case "CIRCULAR":
        return "morado";
      case "REGLAMENTO":
        return "aviso";
      case "DIRECTA":
      default:
        return "neutral";
    }
  };

  const empleadoActual = listaEmpleados.find((e) => e.id_empleado === idEmpleado);
  const nombreEmpleado = empleadoActual
    ? `${empleadoActual.nombres} ${empleadoActual.apellidos}`
    : "Empleado Activo";

  return (
    <section className="comunicaciones" aria-labelledby="bandeja-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Comunicaciones" }]}
        enlace={Link}
        titulo="Bandeja de mensajes"
        idTitulo="bandeja-titulo"
        descripcion="Consulte sus comunicaciones directas, notificaciones del sistema y comunicados corporativos."
        acciones={
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "var(--font-size-small)", color: "var(--color-text-secondary)" }}>
              No leídos:
            </span>
            <Contador>{totalNoLeidos}</Contador>
          </div>
        }
      />

      {/* Selector de identidad para pruebas de visualización de portal */}
      <div className="comunicaciones-selector-empleado">
        <div className="comunicaciones-selector-empleado__info">
          <Avatar nombre={nombreEmpleado} tamano="md" decorativo />
          <div>
            <strong>Viendo bandeja como:</strong> {nombreEmpleado}
          </div>
        </div>
        <div className="comunicaciones-selector-empleado__control">
          <Selector
            etiqueta=""
            opciones={opcionesEmpleados}
            value={idEmpleado}
            onChange={(e) => handleCambiarEmpleado(e.target.value)}
            style={{ width: "320px" }}
          />
        </div>
      </div>

      {/* Tarjeta principal con filtros y lista */}
      <Tarjeta>
        <div className="bandeja-filtros">
          <div className="bandeja-filtros__estados" role="tablist" aria-label="Filtro de mensajes">
            <Boton
              tamano="sm"
              variante={filtroEstado === "todos" ? "primario" : "predeterminado"}
              onClick={() => {
                setCargando(true);
                setFiltroEstado("todos");
              }}
            >
              Todos ({mensajes.length})
            </Boton>
            <Boton
              tamano="sm"
              variante={filtroEstado === "no_leidos" ? "primario" : "predeterminado"}
              onClick={() => {
                setCargando(true);
                setFiltroEstado("no_leidos");
              }}
            >
              No leídos {totalNoLeidos > 0 && <Contador>{totalNoLeidos}</Contador>}
            </Boton>
            <Boton
              tamano="sm"
              variante={filtroEstado === "leidos" ? "primario" : "predeterminado"}
              onClick={() => {
                setCargando(true);
                setFiltroEstado("leidos");
              }}
            >
              Leídos
            </Boton>
          </div>

          <div className="bandeja-filtros__busqueda">
            <CampoTexto
              placeholder="Buscar por asunto o contenido…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              icono={Search}
            />
          </div>
        </div>

        {errorCarga && (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudo cargar la bandeja"
            acciones={
              <Boton tamano="sm" onClick={recargarBandeja}>
                Reintentar
              </Boton>
            }
          >
            {errorCarga}
          </Alerta>
        )}

        {cargando ? (
          <div className="bandeja-lista" aria-busy="true">
            <Esqueleto alto="68px" />
            <Esqueleto alto="68px" />
            <Esqueleto alto="68px" />
          </div>
        ) : mensajes.length === 0 ? (
          // RF-66 AC 4: Dado que un empleado no tiene mensajes, se muestra un estado "vacío"
          <EstadoVacio
            icono={Inbox}
            titulo="Bandeja vacía"
            mensaje={
              busqueda
                ? "No se encontraron mensajes que coincidan con la búsqueda."
                : "No tiene mensajes ni comunicados pendientes en este momento."
            }
            accion={
              busqueda ? (
                <Boton tamano="sm" onClick={() => setBusqueda("")}>
                  Limpiar búsqueda
                </Boton>
              ) : null
            }
          />
        ) : (
          // RF-66 AC 1: Listados en orden del más reciente al más antiguo
          <div className="bandeja-lista" role="feed" aria-label="Lista de mensajes recibidos">
            {mensajes.map((mensaje) => {
              const noLeido = mensaje.estado_codigo === "NO_LEIDO";
              const confirmado = mensaje.estado_codigo === "CONFIRMADO";
              const requiereConfirmar = mensaje.requiere_confirmacion && !confirmado;

              return (
                <button
                  type="button"
                  key={mensaje.id_destinatario}
                  className={`mensaje-tarjeta ${noLeido ? "mensaje-tarjeta--no-leido" : ""}`}
                  onClick={() => handleAbrirMensaje(mensaje)}
                  aria-label={`${noLeido ? "Mensaje no leído: " : "Mensaje: "}${mensaje.asunto}`}
                >
                  <div className="mensaje-tarjeta__cabecera">
                    <div className="mensaje-tarjeta__remitente-grupo">
                      {noLeido ? (
                        <Mail
                          className="ds-icono"
                          style={{ color: "var(--color-primary)" }}
                          aria-label="No leído"
                        />
                      ) : (
                        <MailOpen
                          className="ds-icono"
                          style={{ color: "var(--color-text-subtle)" }}
                          aria-label="Leído"
                        />
                      )}
                      <span className="mensaje-tarjeta__remitente">
                        {mensaje.remitente_nombre || "Administración de RRHH"}
                      </span>
                    </div>

                    <div className="mensaje-tarjeta__etiquetas">
                      {/* Tipo de comunicación */}
                      <Etiqueta tono={obtenerTonoTipo(mensaje.tipo_codigo)}>
                        {mensaje.tipo_nombre || mensaje.tipo_codigo}
                      </Etiqueta>

                      {/* Alcance */}
                      {mensaje.alcance_codigo && mensaje.alcance_codigo !== "INDIVIDUAL" && (
                        <Etiqueta tono="neutral">{mensaje.alcance_nombre || mensaje.alcance_codigo}</Etiqueta>
                      )}

                      {/* Indicador obligatorio o confirmado (RF-67) */}
                      {confirmado ? (
                        <Etiqueta tono="exito" icono={CheckCircle2}>
                          Confirmado
                        </Etiqueta>
                      ) : requiereConfirmar ? (
                        <Etiqueta tono="peligro" icono={ShieldAlert}>
                          Obligatorio
                        </Etiqueta>
                      ) : null}

                      {/* Estado visual de no leído (RF-66 AC 2) */}
                      {noLeido && (
                        <Etiqueta tono="info">
                          Nuevo
                        </Etiqueta>
                      )}

                      <time className="mensaje-tarjeta__fecha" dateTime={mensaje.fecha_envio}>
                        {formatearFecha(mensaje.fecha_envio)}
                      </time>
                    </div>
                  </div>

                  <h3 className="mensaje-tarjeta__asunto">{mensaje.asunto}</h3>
                  <p className="mensaje-tarjeta__extracto">{mensaje.contenido}</p>
                </button>
              );
            })}
          </div>
        )}
      </Tarjeta>

      {/* Modal para visualizar contenido del mensaje (RF-66 AC 3, RF-67 AC 1, 4) */}
      <Modal
        abierto={Boolean(mensajeSeleccionado)}
        titulo={mensajeSeleccionado?.asunto || "Comunicación"}
        onCerrar={() => setMensajeSeleccionado(null)}
        tamano="md"
        pie={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", width: "100%" }}>
            <Boton onClick={() => setMensajeSeleccionado(null)}>Cerrar</Boton>
          </div>
        }
      >
        {mensajeSeleccionado && (
          <div className="mensaje-modal-cuerpo">
            {/* Metadatos del remitente y fecha */}
            <div className="mensaje-modal-meta">
              <div className="mensaje-modal-meta__fila">
                <div className="mensaje-modal-meta__remitente">
                  <Avatar nombre={mensajeSeleccionado.remitente_nombre || "RRHH"} tamano="md" decorativo />
                  <div className="mensaje-modal-meta__texto-remitente">
                    <span className="mensaje-modal-meta__nombre">
                      {mensajeSeleccionado.remitente_nombre || "Administración de RRHH"}
                    </span>
                    <span className="mensaje-modal-meta__cargo">
                      Enviado el {formatearFechaLarga(mensajeSeleccionado.fecha_envio)}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
                  <Etiqueta tono={obtenerTonoTipo(mensajeSeleccionado.tipo_codigo)}>
                    {mensajeSeleccionado.tipo_nombre || mensajeSeleccionado.tipo_codigo}
                  </Etiqueta>
                  {mensajeSeleccionado.alcance_nombre && (
                    <Etiqueta tono="neutral">{mensajeSeleccionado.alcance_nombre}</Etiqueta>
                  )}
                </div>
              </div>
            </div>

            {/* Aviso de confirmación obligatoria (RF-67 AC 1) */}
            {mensajeSeleccionado.solicita_confirmacion ? (
              <div className="mensaje-modal-confirmacion-banner">
                <Alerta
                  tono="aviso"
                  titulo="Confirmación de lectura requerida"
                  acciones={
                    <Boton
                      variante="primario"
                      tamano="sm"
                      onClick={handleConfirmarRecepcion}
                      cargando={confirmandoRecepcion}
                      icono={CheckCircle2}
                    >
                      Confirmar recepción
                    </Boton>
                  }
                >
                  Este comunicado ha sido clasificado como de cumplimiento obligatorio. Debe confirmar explícitamente
                  que ha leído y comprendido su contenido.
                </Alerta>
              </div>
            ) : mensajeSeleccionado.estado_codigo === "CONFIRMADO" ? (
              <Alerta tono="exito" titulo="Recepción confirmada">
                Usted confirmó la recepción de este documento el{" "}
                <strong>{formatearFechaLarga(mensajeSeleccionado.fecha_confirmacion)}</strong>.
              </Alerta>
            ) : null}

            {/* Contenido íntegro del mensaje */}
            <div className="mensaje-modal-contenido">{mensajeSeleccionado.contenido}</div>

            {/* Pie con fecha de lectura registrada (RF-66 AC 3) */}
            {mensajeSeleccionado.fecha_lectura && (
              <p style={{ margin: 0, fontSize: "var(--font-size-small)", color: "var(--color-text-subtle)" }}>
                <Clock className="ds-icono" aria-hidden="true" style={{ verticalAlign: "middle", marginRight: 4 }} />
                Leído el {formatearFechaLarga(mensajeSeleccionado.fecha_lectura)}
              </p>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
