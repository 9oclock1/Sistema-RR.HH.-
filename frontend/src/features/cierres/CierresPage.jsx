import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Lock, RotateCcw, SearchX, Send, UserX } from "lucide-react";
import {
  cerrarDesvinculacion,
  configurarSinRespuestaCierre,
  listarCierres,
  listarMensajesCierre,
  obtenerCierre,
  reenviarCierre,
  reprocesarMensajeCierre,
  simularRespuestaCierre,
} from "../../api/cierres";
import {
  Alerta,
  Boton,
  CampoTexto,
  Casilla,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  Modal,
  ModalConfirmacion,
  Selector,
  Tabla,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import { useRol } from "../../context/sesion";
import { puedeAcceder } from "../../utils/permisos";
import {
  ESTADOS_ENVIO,
  ESTADOS_FINIQUITO,
  ESTADOS_MENSAJE,
  ESTADOS_REVOCACION,
  FILTROS_ESTADO_CIERRE,
  SISTEMAS_POR_DESTINO,
  estadoCierreLista,
  formatearBs,
  formatearFecha,
  formatearFechaHora,
  nombreSistema,
  opciones,
} from "./formato";
import "./cierres.css";

const POLLING_MS = 4000;
const MAX_REENVIOS_PLAZO = 3;

function ListaCierres() {
  const [filas, setFilas] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(
    () =>
      listarCierres({ estado: filtroEstado })
        .then((datos) => {
          setFilas(datos);
          setError(null);
        })
        .catch((err) => setError(err.message))
        .finally(() => setCargando(false)),
    [filtroEstado]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiarFiltro = (e) => {
    setCargando(true);
    setFiltroEstado(e.target.value);
  };

  const reintentar = () => {
    setCargando(true);
    setError(null);
    cargar();
  };

  const columnas = [
    {
      clave: "colaborador",
      titulo: "Colaborador",
      celda: (p) => (
        <div className="cie-nombre">
          <span>{p.nombre_empleado}</span>
          {p.fecha_ingreso && <span className="cie-nota">Ingreso: {formatearFecha(p.fecha_ingreso)}</span>}
        </div>
      ),
    },
    {
      clave: "causal",
      titulo: "Causal",
      ancho: "18%",
      celda: (p) => p.causal?.nombre ?? "—",
    },
    {
      clave: "fecha_retiro",
      titulo: "Fecha de retiro",
      ancho: "12%",
      celda: (p) => formatearFecha(p.fecha_retiro),
    },
    {
      clave: "finiquito",
      titulo: "Finiquito",
      ancho: "18%",
      celda: (p) => {
        const cfg = ESTADOS_FINIQUITO[p.finiquito?.estado] ?? ESTADOS_FINIQUITO.APROBADO;
        return (
          <div className="cie-nombre">
            <Etiqueta tono={cfg.tono}>{cfg.etiqueta}</Etiqueta>
            {p.finiquito?.numero_documento && <span className="cie-nota">{p.finiquito.numero_documento}</span>}
          </div>
        );
      },
    },
    {
      clave: "cierre",
      titulo: "Estado del cierre",
      ancho: "16%",
      celda: (p) => {
        const cfg = estadoCierreLista(p);
        return <Etiqueta tono={cfg.tono}>{cfg.etiqueta}</Etiqueta>;
      },
    },
    {
      clave: "acciones",
      titulo: <span className="ds-solo-lector">Acciones</span>,
      ancho: "100px",
      alinear: "fin",
      celda: (p) => (
        <Boton
          as={Link}
          to={`/desvinculacion/cierre/${p.id_proceso}`}
          variante="predeterminado"
          tamano="sm"
        >
          Abrir
        </Boton>
      ),
    },
  ];

  const vacio = filtroEstado ? (
    <EstadoVacio
      icono={SearchX}
      titulo="Ningún cierre coincide con el filtro"
      accion={
        <Boton
          onClick={() => {
            setCargando(true);
            setFiltroEstado("");
          }}
        >
          Limpiar filtro
        </Boton>
      }
    />
  ) : (
    <EstadoVacio
      icono={UserX}
      titulo="Aún no hay procesos listos para cierre definitivo"
      mensaje="Cuando un finiquito sea aprobado o pagado aparecerá aquí para cerrar definitivamente la desvinculación."
      accion={
        <Boton as={Link} to="/desvinculacion/finiquitos" variante="primario">
          Ir a Finiquitos
        </Boton>
      }
    />
  );

  return (
    <section className="cie-pagina" aria-labelledby="cie-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Desvinculación" }]}
        enlace={Link}
        titulo="Cierre y accesos"
        idTitulo="cie-titulo"
        descripcion="Cierre definitivo de la desvinculación, inactivación del colaborador, revocación de su cuenta y bloqueo de accesos en los sistemas operativos."
      />

      {error ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar los cierres"
          acciones={
            <Boton tamano="sm" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          {error}
        </Alerta>
      ) : (
        <Tarjeta>
          <div className="cie-filtros">
            <Selector
              id="cie-filtro-estado"
              name="estado"
              etiqueta="Estado del cierre"
              value={filtroEstado}
              onChange={cambiarFiltro}
              textoVacio="Todos"
              opciones={opciones(FILTROS_ESTADO_CIERRE)}
            />
            {!cargando && (
              <p className="cie-total-registros" role="status">
                {filas.length} {filas.length === 1 ? "proceso" : "procesos"}
              </p>
            )}
          </div>

          <Tabla
            className="cie-tabla-lista"
            descripcion="Procesos de desvinculación con finiquito aprobado o pagado"
            columnas={columnas}
            filas={filas}
            claveFila="id_proceso"
            cargando={cargando}
            filasCargando={4}
            vacio={vacio}
          />
        </Tarjeta>
      )}
    </section>
  );
}

function TarjetaSistema({
  rev,
  ahoraMs,
  puedeGestionar,
  simulacionActiva,
  sinRespuesta,
  procesando,
  onReenviar,
  onSimular,
  onAbrirRechazo,
  onToggleSinRespuesta,
}) {
  const titulo = SISTEMAS_POR_DESTINO[rev.destino] ?? rev.modulo;
  const envio = rev.envio;
  const cfgEnvio = envio ? ESTADOS_ENVIO[envio.estado] ?? ESTADOS_ENVIO.PENDIENTE : ESTADOS_ENVIO.PENDIENTE;
  const cfgRev = ESTADOS_REVOCACION[rev.estado] ?? ESTADOS_REVOCACION.PENDIENTE;
  const puedeReenviar =
    puedeGestionar &&
    (rev.estado === "RECHAZADA" || rev.estado === "VENCIDA" || envio?.estado === "FALLIDO");

  const venceMs = rev.plazo_vence_en ? Date.parse(rev.plazo_vence_en) : 0;
  const segundosRestantes =
    rev.estado === "ENVIADA" && venceMs > 0 ? Math.max(0, Math.ceil((venceMs - ahoraMs) / 1000)) : null;

  return (
    <Tarjeta
      titulo={titulo}
      nivelTitulo={3}
      acciones={
        puedeReenviar && (
          <Boton
            tamano="sm"
            variante="primario"
            icono={Send}
            cargando={procesando === `reenviar-${rev.destino}`}
            onClick={() => onReenviar(rev.destino)}
          >
            Reenviar
          </Boton>
        )
      }
    >
      <div className="cie-filas">
        <div className="cie-fila">
          <div className="cie-fila__cabecera">
            <span>Envío al broker</span>
            <Etiqueta tono={cfgEnvio.tono}>{cfgEnvio.etiqueta}</Etiqueta>
          </div>
          {envio ? (
            <>
              <span className="cie-nota">
                Intentos: {envio.intentos}
                {envio.entregado_en ? ` · Enviado el ${formatearFechaHora(envio.entregado_en)}` : ""}
                {!envio.entregado_en && envio.proximo_intento_en
                  ? ` · Próximo intento: ${formatearFechaHora(envio.proximo_intento_en)}`
                  : ""}
              </span>
              {envio.ultimo_error && <span className="cie-nota">Último error: {envio.ultimo_error}</span>}
            </>
          ) : (
            <span className="cie-nota">Pendiente de envío.</span>
          )}
        </div>

        <div className="cie-fila">
          <div className="cie-fila__cabecera">
            <span>Plazo y reenvíos</span>
            <span className="cie-nota">
              Reenvíos: {rev.reenvios_por_plazo} de {MAX_REENVIOS_PLAZO}
            </span>
          </div>
          {segundosRestantes !== null ? (
            <span className="cie-nota">Tiempo restante del plazo: {segundosRestantes} s</span>
          ) : (
            <span className="cie-nota">
              {rev.estado === "PENDIENTE" ? "En espera de confirmación de Pub/Sub." : "Sin plazo activo."}
            </span>
          )}
        </div>

        <div className="cie-fila">
          <div className="cie-fila__cabecera">
            <span>Respuesta externa</span>
            <Etiqueta tono={cfgRev.tono}>{cfgRev.etiqueta}</Etiqueta>
          </div>
          {rev.referencia && <span className="cie-nota">Referencia: {rev.referencia}</span>}
          {rev.motivo && <span className="cie-nota">Motivo: {rev.motivo}</span>}
          {rev.respondida_en && <span className="cie-nota">Recibida el {formatearFechaHora(rev.respondida_en)}</span>}
          {Array.isArray(rev.recursos_revocados) && rev.recursos_revocados.length > 0 && (
            <ul className="cie-recursos">
              {rev.recursos_revocados.map((rec, i) => (
                <li key={`${rec.tipo}-${rec.identificador}-${i}`}>
                  {rec.tipo}: <strong>{rec.identificador}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {puedeGestionar && simulacionActiva && (
        <div className="cie-simulador">
          <span className="cie-nota">Simular respuesta de {titulo}</span>
          <div className="cie-simulador__botones">
            <Boton
              tamano="sm"
              disabled={rev.estado === "CONFIRMADA"}
              cargando={procesando === `sim-${rev.destino}-CONFIRMADA`}
              onClick={() => onSimular(rev.destino, "CONFIRMADA")}
            >
              Confirmación
            </Boton>
            <Boton
              tamano="sm"
              disabled={rev.estado === "CONFIRMADA"}
              cargando={procesando === `sim-${rev.destino}-RECHAZADA`}
              onClick={() => onAbrirRechazo(rev.destino)}
            >
              Rechazo
            </Boton>
            <Boton
              tamano="sm"
              cargando={procesando === `sim-${rev.destino}-DUPLICADO`}
              onClick={() => onSimular(rev.destino, "DUPLICADO")}
            >
              Duplicado
            </Boton>
            <Boton
              tamano="sm"
              cargando={procesando === `sim-${rev.destino}-INVALIDO`}
              onClick={() => onSimular(rev.destino, "INVALIDO")}
            >
              Mensaje inválido
            </Boton>
          </div>
          <Casilla
            id={`cie-sin-resp-${rev.destino}`}
            etiqueta="No responder (simular falta de confirmación)"
            checked={sinRespuesta}
            disabled={procesando === `sin-resp-${rev.destino}`}
            onChange={(e) => onToggleSinRespuesta(rev.destino, e.target.checked)}
          />
        </div>
      )}
    </Tarjeta>
  );
}

function DetalleCierre({ idProceso }) {
  const avisar = useAvisos();
  const rol = useRol();
  const puedeGestionar = puedeAcceder(rol, ["admin"]);

  const [detalle, setDetalle] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [errorAccion, setErrorAccion] = useState(null);
  const [procesando, setProcesando] = useState(null);

  const [modalCerrar, setModalCerrar] = useState(false);
  const [modalRechazo, setModalRechazo] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState(null);
  const [refrescoHasta, setRefrescoHasta] = useState(0);
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());

  const cargar = useCallback(
    ({ silencioso = false } = {}) =>
      Promise.all([obtenerCierre(idProceso), listarMensajesCierre(idProceso)])
        .then(([det, msgs]) => {
          setDetalle(det);
          setMensajes(msgs);
          setErrorCarga(null);
        })
        .catch((err) => {
          if (!silencioso) setErrorCarga(err.message);
        })
        .finally(() => {
          if (!silencioso) setCargando(false);
        }),
    [idProceso]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const reintentarDetalle = () => {
    setCargando(true);
    setErrorCarga(null);
    cargar();
  };

  const hayEnCurso = (detalle?.revocaciones ?? []).some(
    (r) => r.estado === "PENDIENTE" || r.estado === "ENVIADA"
  );
  const refrescoManualActivo = refrescoHasta > ahoraMs;
  const debeRefrescar = hayEnCurso || refrescoManualActivo;

  useEffect(() => {
    if (!debeRefrescar) return undefined;
    const id = setInterval(() => {
      cargar({ silencioso: true });
    }, POLLING_MS);
    return () => clearInterval(id);
  }, [debeRefrescar, cargar]);

  const hayCuentaRegresiva = (detalle?.revocaciones ?? []).some((r) => r.estado === "ENVIADA");

  useEffect(() => {
    if (!hayCuentaRegresiva && refrescoHasta <= Date.now()) return undefined;
    const id = setInterval(() => setAhoraMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hayCuentaRegresiva, refrescoHasta]);

  const ejecutarAccion = async (clave, fn, onExito) => {
    setProcesando(clave);
    setErrorAccion(null);
    try {
      const res = await fn();
      await cargar({ silencioso: true });
      onExito?.(res);
    } catch (err) {
      setErrorAccion({ mensaje: err.message, detalles: err.detalles ?? [] });
    } finally {
      setProcesando(null);
    }
  };

  const alCerrarDefinitivamente = () =>
    ejecutarAccion(
      "cerrar",
      () => cerrarDesvinculacion(idProceso),
      () => {
        setModalCerrar(false);
        setRefrescoHasta(Date.now() + 25000);
        avisar({
          tono: "exito",
          titulo: "Desvinculación cerrada definitivamente",
          mensaje: "Colaborador inactivado, cuenta revocada y eventos enviados a los sistemas operativos.",
        });
      }
    );

  const alReenviar = (destino) =>
    ejecutarAccion(
      `reenviar-${destino}`,
      () => reenviarCierre(idProceso, destino),
      () => {
        setRefrescoHasta(Date.now() + 25000);
        avisar({
          tono: "info",
          titulo: "Revocación reenviada",
          mensaje: "Nuevo mensaje encolado en ucb-sis323-sub-f.",
        });
      }
    );

  const alSimular = (destino, escenario, motivo = null) =>
    ejecutarAccion(
      `sim-${destino}-${escenario}`,
      () => simularRespuestaCierre(idProceso, { destino, escenario, ...(motivo ? { motivo } : {}) }),
      () => {
        setModalRechazo(null);
        setMotivoRechazo("");
        setErrorMotivo(null);
        setRefrescoHasta(Date.now() + 20000);
        avisar({
          tono: "info",
          titulo: "Respuesta simulada publicada en ucb-sis323-sub-f",
          mensaje: "Se actualizará automáticamente en unos segundos.",
        });
      }
    );

  const confirmarRechazo = () => {
    const limpio = motivoRechazo.trim();
    if (!limpio) {
      setErrorMotivo("Ingrese el motivo del rechazo.");
      return;
    }
    setErrorMotivo(null);
    alSimular(modalRechazo, "RECHAZADA", limpio);
  };

  const alToggleSinRespuesta = (destino, activo) =>
    ejecutarAccion(
      `sin-resp-${destino}`,
      () => configurarSinRespuestaCierre(destino, activo),
      () => {
        avisar({
          tono: activo ? "aviso" : "info",
          titulo: activo ? `${SISTEMAS_POR_DESTINO[destino]} en modo sin respuesta` : `${SISTEMAS_POR_DESTINO[destino]} responderá normalmente`,
        });
      }
    );

  const alReprocesar = (idEntrante) =>
    ejecutarAccion(
      `reprocesar-${idEntrante}`,
      () => reprocesarMensajeCierre(idEntrante),
      () => avisar({ tono: "exito", titulo: "Mensaje reprocesado correctamente" })
    );

  if (cargando && !detalle) {
    return (
      <section className="cie-pagina" aria-busy="true">
        <Esqueleto forma="bloque" ancho="40%" alto="32px" />
        <Esqueleto forma="bloque" ancho="100%" alto="140px" />
        <Esqueleto forma="bloque" ancho="100%" alto="240px" />
      </section>
    );
  }

  if (errorCarga) {
    return (
      <section className="cie-pagina">
        <EncabezadoPagina
          migas={[
            { etiqueta: "Inicio", href: "/" },
            { etiqueta: "Desvinculación" },
            { etiqueta: "Cierre y accesos", href: "/desvinculacion/cierre" },
          ]}
          enlace={Link}
          titulo="Cierre y accesos"
        />
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudo cargar el cierre"
          acciones={
            <Boton tamano="sm" onClick={reintentarDetalle}>
              Reintentar
            </Boton>
          }
        >
          {errorCarga}
        </Alerta>
      </section>
    );
  }

  const {
    proceso,
    finiquito,
    empleado,
    acceso,
    cierre,
    revocaciones = [],
    requisitos,
    simulacion_activa: simActiva,
    destinos_sin_respuesta: destinosSinResp = [],
  } = detalle;

  const cfgFin = finiquito ? ESTADOS_FINIQUITO[finiquito.estado] ?? ESTADOS_FINIQUITO.APROBADO : null;
  const cfgCierre = cierre
    ? FILTROS_ESTADO_CIERRE[cierre.estado_revocaciones] ?? FILTROS_ESTADO_CIERRE.EN_PROCESO
    : FILTROS_ESTADO_CIERRE.PENDIENTE_CIERRE;

  const colsMensajes = [
    {
      clave: "recibido_en",
      titulo: "Fecha",
      ancho: "15%",
      celda: (m) => formatearFechaHora(m.recibido_en),
    },
    {
      clave: "sistema",
      titulo: "Sistema",
      ancho: "20%",
      celda: (m) => nombreSistema(m.origen, m.destino),
    },
    {
      clave: "tipo_evento",
      titulo: "Tipo",
      ancho: "22%",
      celda: (m) => m.tipo_evento ?? "—",
    },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "14%",
      celda: (m) => {
        const cfg = ESTADOS_MENSAJE[m.estado] ?? ESTADOS_MENSAJE.RECIBIDO;
        return <Etiqueta tono={cfg.tono}>{cfg.etiqueta}</Etiqueta>;
      },
    },
    {
      clave: "intentos",
      titulo: "Intentos",
      ancho: "8%",
      alinear: "fin",
      celda: (m) => m.intentos,
    },
    {
      clave: "ultimo_error",
      titulo: "Último error",
      celda: (m) => m.ultimo_error || "—",
    },
    ...(puedeGestionar
      ? [
          {
            clave: "acciones",
            titulo: <span className="ds-solo-lector">Acciones</span>,
            ancho: "120px",
            alinear: "fin",
            celda: (m) =>
              m.estado === "EN_DLQ" ? (
                <Boton
                  tamano="sm"
                  icono={RotateCcw}
                  cargando={procesando === `reprocesar-${m.id_entrante}`}
                  onClick={() => alReprocesar(m.id_entrante)}
                >
                  Reprocesar
                </Boton>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <section className="cie-pagina" aria-labelledby="cie-detalle-titulo">
      <EncabezadoPagina
        migas={[
          { etiqueta: "Inicio", href: "/" },
          { etiqueta: "Desvinculación" },
          { etiqueta: "Cierre y accesos", href: "/desvinculacion/cierre" },
          { etiqueta: proceso.nombre_empleado },
        ]}
        enlace={Link}
        titulo={proceso.nombre_empleado}
        idTitulo="cie-detalle-titulo"
        descripcion={`${proceso.causal?.nombre ?? "—"} · Ingreso: ${formatearFecha(proceso.fecha_ingreso)} · Retiro: ${formatearFecha(proceso.fecha_retiro)}`}
        acciones={
          <div className="cie-acciones-barra">
            <Boton as={Link} to={`/desvinculacion/finiquitos/${idProceso}`} variante="predeterminado">
              Ver finiquito
            </Boton>
            {puedeGestionar && requisitos?.puede_cerrar && (
              <Boton
                variante="peligro"
                icono={Lock}
                cargando={procesando === "cerrar"}
                onClick={() => setModalCerrar(true)}
              >
                Cerrar definitivamente
              </Boton>
            )}
          </div>
        }
      />

      {errorAccion && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudo completar la operación"
          onCerrar={() => setErrorAccion(null)}
        >
          {errorAccion.mensaje}
          {errorAccion.detalles?.length > 0 && (
            <ul className="cie-lista-errores">
              {errorAccion.detalles.map((d, i) => (
                <li key={`${d.campo ?? i}-${d.mensaje}`}>{d.mensaje}</li>
              ))}
            </ul>
          )}
        </Alerta>
      )}

      {!cierre && requisitos && !requisitos.puede_cerrar && (
        <Alerta
          tono="aviso"
          titulo="Cierre no disponible todavía"
          acciones={
            <Boton as={Link} to={`/desvinculacion/finiquitos/${idProceso}`} tamano="sm">
              Ir a Finiquitos
            </Boton>
          }
        >
          {requisitos.motivo}
        </Alerta>
      )}

      {cierre?.estado_revocaciones === "COMPLETADO" && (
        <Alerta tono="exito" titulo="Cierre y revocación completados">
          Todos los sistemas operativos confirmaron la revocación de accesos.
        </Alerta>
      )}

      {cierre?.estado_revocaciones === "CON_ALERTAS" && (
        <Alerta tono="peligro" titulo="Cierre con alertas">
          Uno o más sistemas rechazaron o no confirmaron la revocación dentro del plazo. Revise las tarjetas inferiores y use «Reenviar» cuando corresponda.
        </Alerta>
      )}

      <div className="cie-resumen-grid">
        <Tarjeta titulo="Finiquito y cierre" nivelTitulo={2}>
          <div className="cie-estado-tarjeta">
            <div className="cie-estado-tarjeta__cabecera">
              <span>Finiquito</span>
              {finiquito ? (
                <Etiqueta tono={cfgFin.tono}>{cfgFin.etiqueta}</Etiqueta>
              ) : (
                <Etiqueta tono="neutral">Sin generar</Etiqueta>
              )}
            </div>
            {finiquito && (
              <span className="cie-nota">
                <span className="cie-numero-doc">{finiquito.numero_documento ?? "Borrador"}</span> · Líquido:{" "}
                <strong className="cie-monto">{formatearBs(finiquito.liquido_pagable)}</strong>
              </span>
            )}
            <div className="cie-estado-tarjeta__cabecera">
              <span>Estado del cierre</span>
              <Etiqueta tono={cfgCierre.tono}>{cfgCierre.etiqueta}</Etiqueta>
            </div>
            {cierre && <span className="cie-nota">Cerrado el {formatearFechaHora(cierre.cerrado_en)}</span>}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Estado del colaborador" nivelTitulo={2}>
          <div className="cie-estado-tarjeta">
            <div className="cie-estado-tarjeta__cabecera">
              <span>EmployeeService</span>
              {empleado === null ? (
                <Etiqueta tono="neutral">No disponible</Etiqueta>
              ) : empleado.activo ? (
                <Etiqueta tono="info">Activo</Etiqueta>
              ) : (
                <Etiqueta tono="exito">Baja</Etiqueta>
              )}
            </div>
            <span className="cie-nota">
              {empleado === null
                ? "No se pudo consultar el estado en EmployeeService."
                : empleado.activo
                  ? "El colaborador sigue activo en el directorio hasta el cierre definitivo."
                  : "El colaborador se encuentra inactivo (BAJA)."}
            </span>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Cuenta del ERP" nivelTitulo={2}>
          <div className="cie-estado-tarjeta">
            <div className="cie-estado-tarjeta__cabecera">
              <span>AuthService</span>
              {acceso === null ? (
                <Etiqueta tono="neutral">No disponible</Etiqueta>
              ) : !acceso.tiene_cuenta ? (
                <Etiqueta tono="neutral">Sin cuenta</Etiqueta>
              ) : acceso.esta_activo ? (
                <Etiqueta tono="info">Activa</Etiqueta>
              ) : (
                <Etiqueta tono="exito">Revocada</Etiqueta>
              )}
            </div>
            <span className="cie-nota">
              {acceso === null
                ? "No se pudo consultar la cuenta en AuthService."
                : !acceso.tiene_cuenta
                  ? "El colaborador no registra cuenta de acceso al portal."
                  : acceso.esta_activo
                    ? "La cuenta y las sesiones permanecen habilitadas."
                    : `Credenciales y tokens revocados${acceso.revocado_en ? ` el ${formatearFechaHora(acceso.revocado_en)}` : ""}.`}
            </span>
          </div>
        </Tarjeta>
      </div>

      <div className="cie-sistemas-encabezado">
        <h2 className="cie-seccion-titulo">Revocación en sistemas operativos</h2>
      </div>

      {!cierre ? (
        <Tarjeta>
          <EstadoVacio
            icono={Lock}
            titulo="Cierre definitivo pendiente"
            mensaje="Al ejecutar el cierre definitivo se inactivará al colaborador, se revocará su cuenta del ERP y se publicará el evento hacia Ventas/POS, Inventarios, Entregas y CRM."
          />
        </Tarjeta>
      ) : (
        <div className="cie-sistemas-grid">
          {revocaciones.map((rev) => (
            <TarjetaSistema
              key={rev.destino}
              rev={rev}
              ahoraMs={ahoraMs}
              puedeGestionar={puedeGestionar}
              simulacionActiva={simActiva}
              sinRespuesta={destinosSinResp.includes(rev.destino)}
              procesando={procesando}
              onReenviar={alReenviar}
              onSimular={alSimular}
              onAbrirRechazo={(dest) => {
                setModalRechazo(dest);
                setMotivoRechazo("");
                setErrorMotivo(null);
              }}
              onToggleSinRespuesta={alToggleSinRespuesta}
            />
          ))}
        </div>
      )}

      <Tarjeta titulo="Mensajes recibidos" nivelTitulo={2}>
        <Tabla
          descripcion="Mensajes recibidos de los sistemas operativos sobre revocación de accesos"
          columnas={colsMensajes}
          filas={mensajes}
          claveFila="id_entrante"
          vacio={<p className="cie-nota">Aún no se recibieron mensajes externos para este cierre.</p>}
        />
      </Tarjeta>

      <ModalConfirmacion
        abierto={modalCerrar}
        titulo="Cerrar definitivamente la desvinculación"
        textoConfirmar="Cerrar definitivamente"
        variante="peligro"
        procesando={procesando === "cerrar"}
        onConfirmar={alCerrarDefinitivamente}
        onCancelar={() => setModalCerrar(false)}
      >
        El colaborador <strong>{proceso.nombre_empleado}</strong> pasará a estado Baja, su cuenta y sesiones del ERP serán revocadas de inmediato y se notificará a Ventas/POS, Inventarios, Entregas y CRM para bloquear sus accesos. Esta acción no se puede deshacer.
      </ModalConfirmacion>

      <Modal
        abierto={Boolean(modalRechazo)}
        titulo={`Simular rechazo de ${SISTEMAS_POR_DESTINO[modalRechazo] ?? "sistema externo"}`}
        tamano="sm"
        bloqueado={Boolean(procesando)}
        onCerrar={() => setModalRechazo(null)}
        pie={
          <>
            <Boton variante="sutil" onClick={() => setModalRechazo(null)} disabled={Boolean(procesando)}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              cargando={procesando === `sim-${modalRechazo}-RECHAZADA`}
              onClick={confirmarRechazo}
            >
              Publicar rechazo
            </Boton>
          </>
        }
      >
        <CampoTexto
          id="cie-motivo-rechazo"
          etiqueta="Motivo del rechazo"
          requerido
          placeholder="La terminal móvil sigue asignada a un turno"
          value={motivoRechazo}
          onChange={(e) => setMotivoRechazo(e.target.value)}
          error={errorMotivo}
          data-autofocus
        />
      </Modal>
    </section>
  );
}

export default function CierresPage() {
  const { idProceso } = useParams();
  return idProceso ? <DetalleCierre idProceso={idProceso} /> : <ListaCierres />;
}
