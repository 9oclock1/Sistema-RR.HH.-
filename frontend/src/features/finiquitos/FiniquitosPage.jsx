import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSignature,
  RefreshCw,
  RotateCcw,
  SearchX,
  Send,
  WifiOff,
} from "lucide-react";
import {
  aprobarFiniquito,
  descargarPdfFiniquito,
  generarFiniquito,
  listarFiniquitos,
  listarMensajesFiniquito,
  obtenerFiniquito,
  reenviarFiniquito,
  reprocesarMensajeFiniquito,
  simularCaidaBrokerFiniquito,
  simularRespuestaFiniquito,
} from "../../api/finiquitos";
import {
  Alerta,
  Boton,
  CampoTexto,
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
  ESTADOS_RESPUESTA,
  formatearBs,
  formatearFecha,
  formatearFechaHora,
  nombreSistema,
  opciones,
} from "./formato";
import "./finiquitos.css";

const POLLING_MS = 4000;

function ListaFiniquitos() {
  const [filas, setFilas] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(
    () =>
      listarFiniquitos({ estado_finiquito: filtroEstado })
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
        <div className="fin-nombre">
          <span>{p.nombre_empleado}</span>
          {p.fecha_ingreso && <span className="fin-nota">Ingreso: {formatearFecha(p.fecha_ingreso)}</span>}
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
      ancho: "11%",
      celda: (p) => formatearFecha(p.fecha_retiro),
    },
    {
      clave: "finiquito",
      titulo: "Finiquito",
      ancho: "12%",
      celda: (p) => {
        const clave = p.finiquito?.estado ?? "SIN_GENERAR";
        const cfg = ESTADOS_FINIQUITO[clave] ?? ESTADOS_FINIQUITO.SIN_GENERAR;
        return (
          <div className="fin-nombre">
            <Etiqueta tono={cfg.tono}>{cfg.etiqueta}</Etiqueta>
            {p.finiquito?.numero_documento && <span className="fin-nota">{p.finiquito.numero_documento}</span>}
          </div>
        );
      },
    },
    {
      clave: "liquido",
      titulo: "Líquido",
      ancho: "11%",
      alinear: "fin",
      celda: (p) => (
        <span className="fin-monto">{p.finiquito ? formatearBs(p.finiquito.liquido_pagable) : "—"}</span>
      ),
    },
    {
      clave: "pagos",
      titulo: "Pagos",
      ancho: "11%",
      celda: (p) => {
        if (!p.finiquito) return <span className="fin-nota">—</span>;
        const cfg = ESTADOS_RESPUESTA[p.finiquito.estado_pagos] ?? ESTADOS_RESPUESTA.PENDIENTE;
        return <Etiqueta tono={cfg.tono}>{cfg.etiqueta}</Etiqueta>;
      },
    },
    {
      clave: "contabilidad",
      titulo: "Contabilidad",
      ancho: "11%",
      celda: (p) => {
        if (!p.finiquito) return <span className="fin-nota">—</span>;
        const cfg = ESTADOS_RESPUESTA[p.finiquito.estado_contabilidad] ?? ESTADOS_RESPUESTA.PENDIENTE;
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
          to={`/desvinculacion/finiquitos/${p.id_proceso}`}
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
      titulo="Ningún finiquito coincide con el filtro"
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
      icono={FileSignature}
      titulo="Aún no hay procesos de liquidación"
      mensaje="Registre una desvinculación para iniciar el cálculo y emitir el finiquito."
      accion={
        <Boton as={Link} to="/desvinculacion/bajas" variante="primario">
          Ir a Desvinculaciones
        </Boton>
      }
    />
  );

  return (
    <section className="fin-pagina" aria-labelledby="fin-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Desvinculación" }]}
        enlace={Link}
        titulo="Finiquitos"
        idTitulo="fin-titulo"
        descripcion="Emisión y aprobación del documento oficial de finiquito y seguimiento de las integraciones con Pagos y Contabilidad."
      />

      {error ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar los finiquitos"
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
          <div className="fin-filtros">
            <Selector
              id="fin-filtro-estado"
              name="estado_finiquito"
              etiqueta="Estado del finiquito"
              value={filtroEstado}
              onChange={cambiarFiltro}
              textoVacio="Todos"
              opciones={opciones(ESTADOS_FINIQUITO)}
            />
            {!cargando && (
              <p className="fin-total-registros" role="status">
                {filas.length} {filas.length === 1 ? "proceso" : "procesos"}
              </p>
            )}
          </div>

          <Tabla
            className="fin-tabla-lista"
            descripcion="Procesos de liquidación y estado de finiquito"
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

function BloqueRequisitos({ requisitos }) {
  const items = [
    {
      clave: "promedio",
      titulo: "Sueldo promedio indemnizable",
      ok: requisitos.promedio.calculado,
      estadoTexto: requisitos.promedio.calculado ? formatearBs(requisitos.promedio.monto) : "Falta calcular",
      tono: requisitos.promedio.calculado ? "exito" : "aviso",
    },
    {
      clave: "beneficios",
      titulo: "Indemnización y desahucio",
      ok: requisitos.beneficios.calculado && !requisitos.beneficios.desactualizado,
      estadoTexto: !requisitos.beneficios.calculado
        ? "Falta calcular"
        : requisitos.beneficios.desactualizado
          ? "Desactualizado"
          : formatearBs(requisitos.beneficios.total),
      tono: !requisitos.beneficios.calculado
        ? "aviso"
        : requisitos.beneficios.desactualizado
          ? "peligro"
          : "exito",
    },
    {
      clave: "saldos",
      titulo: "Duodécimas y vacaciones truncas",
      ok: requisitos.saldos.calculado && !requisitos.saldos.desactualizado,
      estadoTexto: !requisitos.saldos.calculado
        ? "Falta calcular"
        : requisitos.saldos.desactualizado
          ? "Desactualizado"
          : formatearBs(requisitos.saldos.total),
      tono: !requisitos.saldos.calculado
        ? "aviso"
        : requisitos.saldos.desactualizado
          ? "peligro"
          : "exito",
    },
  ];

  const incompleto = items.some((i) => !i.ok);

  return (
    <Tarjeta titulo="Requisitos del finiquito" nivelTitulo={2}>
      {incompleto && (
        <Alerta
          tono="aviso"
          titulo="Requisitos pendientes"
          acciones={
            <Boton as={Link} to="/desvinculacion/bajas" tamano="sm">
              Ir a Desvinculaciones
            </Boton>
          }
        >
          Calcule lo que falta en Desvinculaciones antes de generar el finiquito.
        </Alerta>
      )}
      <ul className="fin-requisitos" style={{ marginTop: incompleto ? "var(--space-3)" : 0 }}>
        {items.map((item) => (
          <li key={item.clave} className="fin-requisito">
            <div className="fin-requisito__info">
              {item.ok ? (
                <CheckCircle2 className="ds-icono fin-requisito__icono--ok" aria-hidden="true" />
              ) : (
                <AlertTriangle className="ds-icono fin-requisito__icono--pendiente" aria-hidden="true" />
              )}
              <p className="fin-requisito__titulo">{item.titulo}</p>
            </div>
            <Etiqueta tono={item.tono}>{item.estadoTexto}</Etiqueta>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

function TarjetaIntegracion({
  destino,
  titulo,
  bloque,
  estadoFiniquito,
  puedeGestionar,
  simulacionActiva,
  procesando,
  onReenviar,
  onSimular,
  onAbrirRechazo,
}) {
  const envio = bloque?.envio;
  const resp = bloque?.respuesta ?? { estado: "PENDIENTE" };
  const cfgEnvio = envio ? ESTADOS_ENVIO[envio.estado] ?? ESTADOS_ENVIO.PENDIENTE : ESTADOS_ENVIO.PENDIENTE;
  const cfgResp = ESTADOS_RESPUESTA[resp.estado] ?? ESTADOS_RESPUESTA.PENDIENTE;
  const puedeReenviar = puedeGestionar && estadoFiniquito === "APROBADO" && (resp.estado === "RECHAZADA" || envio?.estado === "FALLIDO");
  const moduloNombre = destino === "PAGOS" ? "Pagos y Facturación" : "Contabilidad";

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
            cargando={procesando === `reenviar-${destino}`}
            onClick={() => onReenviar(destino)}
          >
            Reenviar
          </Boton>
        )
      }
    >
      <div className="fin-integracion-filas">
        <div className="fin-integracion-fila">
          <div className="fin-integracion-fila__cabecera">
            <span>Envío al broker</span>
            <Etiqueta tono={cfgEnvio.tono}>{cfgEnvio.etiqueta}</Etiqueta>
          </div>
          {envio ? (
            <>
              <span className="fin-nota">
                Intentos: {envio.intentos}
                {envio.entregado_en ? ` · Enviado el ${formatearFechaHora(envio.entregado_en)}` : ""}
                {!envio.entregado_en && envio.proximo_intento_en
                  ? ` · Próximo intento: ${formatearFechaHora(envio.proximo_intento_en)}`
                  : ""}
              </span>
              {envio.ultimo_error && <span className="fin-nota">Último error: {envio.ultimo_error}</span>}
            </>
          ) : (
            <span className="fin-nota">Pendiente de aprobación.</span>
          )}
        </div>

        <div className="fin-integracion-fila">
          <div className="fin-integracion-fila__cabecera">
            <span>Respuesta externa</span>
            <Etiqueta tono={cfgResp.tono}>{cfgResp.etiqueta}</Etiqueta>
          </div>
          {resp.referencia && <span className="fin-nota">Referencia: {resp.referencia}</span>}
          {resp.motivo && <span className="fin-nota">Motivo: {resp.motivo}</span>}
          {resp.respondida_en && <span className="fin-nota">Recibida el {formatearFechaHora(resp.respondida_en)}</span>}
        </div>
      </div>

      {puedeGestionar && simulacionActiva && estadoFiniquito !== "BORRADOR" && (
        <div className="fin-simulador">
          <span className="fin-nota">Simular respuesta de {moduloNombre}</span>
          <div className="fin-simulador__botones">
            <Boton
              tamano="sm"
              disabled={estadoFiniquito === "PAGADO"}
              cargando={procesando === `sim-${destino}-CONFIRMADA`}
              onClick={() => onSimular(destino, "CONFIRMADA")}
            >
              Confirmación
            </Boton>
            <Boton
              tamano="sm"
              disabled={estadoFiniquito === "PAGADO"}
              cargando={procesando === `sim-${destino}-RECHAZADA`}
              onClick={() => onAbrirRechazo(destino)}
            >
              Rechazo
            </Boton>
            <Boton
              tamano="sm"
              cargando={procesando === `sim-${destino}-DUPLICADO`}
              onClick={() => onSimular(destino, "DUPLICADO")}
            >
              Duplicado
            </Boton>
            <Boton
              tamano="sm"
              cargando={procesando === `sim-${destino}-INVALIDO`}
              onClick={() => onSimular(destino, "INVALIDO")}
            >
              Mensaje inválido
            </Boton>
          </div>
        </div>
      )}
    </Tarjeta>
  );
}

function DetalleFiniquito({ idProceso }) {
  const avisar = useAvisos();
  const rol = useRol();
  const puedeGestionar = puedeAcceder(rol, ["admin"]);

  const [detalle, setDetalle] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [errorAccion, setErrorAccion] = useState(null);
  const [procesando, setProcesando] = useState(null);

  const [modalAprobar, setModalAprobar] = useState(false);
  const [modalCaida, setModalCaida] = useState(false);
  const [modalRechazo, setModalRechazo] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState(null);
  const [refrescoHasta, setRefrescoHasta] = useState(0);
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());

  const cargar = useCallback(
    ({ silencioso = false } = {}) =>
      Promise.all([obtenerFiniquito(idProceso), listarMensajesFiniquito(idProceso)])
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

  const estadoFin = detalle?.finiquito?.estado;
  const refrescoManualActivo = refrescoHasta > ahoraMs;
  const debeRefrescar = estadoFin === "APROBADO" || refrescoManualActivo;

  useEffect(() => {
    if (!debeRefrescar) return undefined;
    const id = setInterval(() => {
      cargar({ silencioso: true });
    }, POLLING_MS);
    return () => clearInterval(id);
  }, [debeRefrescar, cargar]);

  const caidaHastaMs = detalle?.caida_simulada_hasta ? Date.parse(detalle.caida_simulada_hasta) : 0;
  const segundosCaida = caidaHastaMs > ahoraMs ? Math.ceil((caidaHastaMs - ahoraMs) / 1000) : 0;

  useEffect(() => {
    if (caidaHastaMs <= Date.now() && refrescoHasta <= Date.now()) return undefined;
    const id = setInterval(() => setAhoraMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [caidaHastaMs, refrescoHasta]);

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

  const alGenerar = () =>
    ejecutarAccion(
      "generar",
      () => generarFiniquito(idProceso),
      () => avisar({ tono: "exito", titulo: "Borrador de finiquito generado" })
    );

  const alAprobar = () =>
    ejecutarAccion(
      "aprobar",
      () => aprobarFiniquito(idProceso),
      (res) => {
        setModalAprobar(false);
        setRefrescoHasta(Date.now() + 20000);
        avisar({
          tono: "exito",
          titulo: "Finiquito aprobado",
          mensaje: `Documento ${res.finiquito?.numero_documento ?? ""} emitido y enviado a Pagos y Contabilidad.`,
        });
      }
    );

  const alDescargarPdf = async () => {
    setProcesando("pdf");
    setErrorAccion(null);
    try {
      const blob = await descargarPdfFiniquito(idProceso);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `finiquito-${detalle?.finiquito?.numero_documento ?? idProceso}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorAccion({ mensaje: err.message, detalles: err.detalles ?? [] });
    } finally {
      setProcesando(null);
    }
  };

  const alReenviar = (destino) =>
    ejecutarAccion(
      `reenviar-${destino}`,
      () => reenviarFiniquito(idProceso, destino),
      () => {
        setRefrescoHasta(Date.now() + 20000);
        avisar({ tono: "info", titulo: "Integración reenviada", mensaje: "Nuevo mensaje encolado en ucb-sis323-sub-f." });
      }
    );

  const alSimular = (destino, escenario, motivo = null) =>
    ejecutarAccion(
      `sim-${destino}-${escenario}`,
      () => simularRespuestaFiniquito(idProceso, { destino, escenario, ...(motivo ? { motivo } : {}) }),
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

  const alSimularCaida = () =>
    ejecutarAccion(
      "caida",
      () => simularCaidaBrokerFiniquito(30),
      () => {
        setModalCaida(false);
        setAhoraMs(Date.now());
        setRefrescoHasta(Date.now() + 35000);
        avisar({
          tono: "aviso",
          titulo: "Caída del broker simulada (30 s)",
          mensaje: "Las publicaciones fallarán temporalmente y quedarán en la bandeja de salida.",
        });
      }
    );

  const alReprocesar = (idEntrante) =>
    ejecutarAccion(
      `reprocesar-${idEntrante}`,
      () => reprocesarMensajeFiniquito(idEntrante),
      () => avisar({ tono: "exito", titulo: "Mensaje reprocesado correctamente" })
    );

  if (cargando && !detalle) {
    return (
      <section className="fin-pagina" aria-busy="true">
        <Esqueleto forma="bloque" ancho="40%" alto="32px" />
        <Esqueleto forma="bloque" ancho="100%" alto="140px" />
        <Esqueleto forma="bloque" ancho="100%" alto="240px" />
      </section>
    );
  }

  if (errorCarga) {
    return (
      <section className="fin-pagina">
        <EncabezadoPagina
          migas={[
            { etiqueta: "Inicio", href: "/" },
            { etiqueta: "Desvinculación" },
            { etiqueta: "Finiquitos", href: "/desvinculacion/finiquitos" },
          ]}
          enlace={Link}
          titulo="Finiquito"
        />
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudo cargar el finiquito"
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

  const { proceso, requisitos, finiquito, integraciones, prestamos_pendientes: pendientes = [], simulacion_activa: simActiva } = detalle;
  const ingresos = (finiquito?.renglones ?? []).filter((r) => r.tipo === "INGRESO");
  const descuentos = (finiquito?.renglones ?? []).filter((r) => r.tipo === "DESCUENTO");
  const cfgEstado = ESTADOS_FINIQUITO[finiquito?.estado ?? "SIN_GENERAR"];

  const colsRenglones = [
    {
      clave: "concepto",
      titulo: "Concepto",
      celda: (r) => (
        <div className="fin-concepto-celda">
          <span>{r.concepto}</span>
          {r.detalle && <span className="fin-nota">{r.detalle}</span>}
        </div>
      ),
    },
    {
      clave: "monto",
      titulo: "Monto",
      ancho: "28%",
      alinear: "fin",
      celda: (r) => <span className="fin-monto">{formatearBs(r.monto)}</span>,
    },
  ];

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
    <section className="fin-pagina" aria-labelledby="fin-detalle-titulo">
      <EncabezadoPagina
        migas={[
          { etiqueta: "Inicio", href: "/" },
          { etiqueta: "Desvinculación" },
          { etiqueta: "Finiquitos", href: "/desvinculacion/finiquitos" },
          { etiqueta: proceso.nombre_empleado },
        ]}
        enlace={Link}
        titulo={proceso.nombre_empleado}
        idTitulo="fin-detalle-titulo"
        descripcion={`${proceso.causal?.nombre ?? "—"} · Ingreso: ${formatearFecha(proceso.fecha_ingreso)} · Retiro: ${formatearFecha(proceso.fecha_retiro)}`}
        acciones={
          <div className="fin-acciones-barra">
            {puedeGestionar && (!finiquito || finiquito.estado === "BORRADOR") && (
              <Boton
                variante={finiquito ? "predeterminado" : "primario"}
                icono={RefreshCw}
                cargando={procesando === "generar"}
                onClick={alGenerar}
              >
                {finiquito ? "Regenerar borrador" : "Generar borrador"}
              </Boton>
            )}
            {puedeGestionar && finiquito?.estado === "BORRADOR" && (
              <Boton
                variante="primario"
                icono={FileCheck2}
                cargando={procesando === "aprobar"}
                onClick={() => setModalAprobar(true)}
              >
                Aprobar finiquito
              </Boton>
            )}
            {finiquito && finiquito.estado !== "BORRADOR" && (
              <Boton
                variante="primario"
                icono={Download}
                cargando={procesando === "pdf"}
                onClick={alDescargarPdf}
              >
                Descargar PDF
              </Boton>
            )}
          </div>
        }
      />

      {errorAccion && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo completar la operación" onCerrar={() => setErrorAccion(null)}>
          {errorAccion.mensaje}
          {errorAccion.detalles?.length > 0 && (
            <ul className="fin-lista-errores">
              {errorAccion.detalles.map((d, i) => (
                <li key={`${d.campo ?? i}-${d.mensaje}`}>{d.mensaje}</li>
              ))}
            </ul>
          )}
        </Alerta>
      )}

      {finiquito?.estado === "PAGADO" && (
        <Alerta tono="exito" titulo="Finiquito pagado">
          Finiquito pagado: Pagos y Contabilidad confirmaron. El proceso quedó cerrado.
        </Alerta>
      )}

      {finiquito?.estado === "PAGADO" && pendientes.length > 0 && (
        <Alerta tono="aviso" titulo="Préstamos o anticipos sin saldar">
          Estos anticipos o préstamos no quedaron saldados con el finiquito. Se notificó al Administrador que lo aprobó.
          <ul className="fin-lista-errores">
            {pendientes.map((p) => (
              <li key={p.id_prestamo}>
                {p.tipo === "ANTICIPO" ? "Anticipo" : "Préstamo"} · Saldo pendiente: {formatearBs(p.saldo_pendiente)} ·
                Descontado en finiquito: {formatearBs(p.monto_descontado)} ({p.motivo})
              </li>
            ))}
          </ul>
        </Alerta>
      )}

      {finiquito?.estado === "PAGADO" && pendientes.length === 0 && descuentos.length > 0 && (
        <p className="fin-nota">Los anticipos y préstamos descontados quedaron saldados.</p>
      )}

      <BloqueRequisitos requisitos={requisitos} />

      <Tarjeta>
        <div className="fin-cabecera-doc">
          <div className="fin-cabecera-doc__meta">
            <h2 className="fin-integraciones-titulo">Formulario consolidado de liquidación</h2>
            <Etiqueta tono={cfgEstado.tono}>{cfgEstado.etiqueta}</Etiqueta>
            {finiquito?.numero_documento && <span className="fin-numero-doc">{finiquito.numero_documento}</span>}
          </div>
          {finiquito?.aprobado_en && (
            <span className="fin-nota">Aprobado el {formatearFechaHora(finiquito.aprobado_en)}</span>
          )}
        </div>

        {!finiquito ? (
          <EstadoVacio
            icono={FileSignature}
            titulo="El finiquito aún no fue generado"
            mensaje={
              puedeGestionar
                ? "Genere el borrador consolidado cuando los tres cálculos previos estén completos y al día."
                : "Podrá revisarlo cuando el Administrador de RRHH genere el borrador."
            }
          />
        ) : (
          <>
            <div className="fin-tablas-grid">
              <div>
                <h3 className="fin-bloque-titulo">Ingresos</h3>
                <Tabla
                  descripcion="Ingresos del finiquito"
                  columnas={colsRenglones}
                  filas={ingresos}
                  claveFila="orden"
                  vacio={<p className="fin-nota">Sin ingresos registrados.</p>}
                />
                <div className="fin-subtotal">
                  <span>Total ingresos</span>
                  <span className="fin-monto">{formatearBs(finiquito.total_ingresos)}</span>
                </div>
              </div>

              <div>
                <h3 className="fin-bloque-titulo">Descuentos</h3>
                <Tabla
                  descripcion="Descuentos del finiquito"
                  columnas={colsRenglones}
                  filas={descuentos}
                  claveFila="orden"
                  vacio={<p className="fin-nota">Sin anticipos ni préstamos por descontar.</p>}
                />
                <div className="fin-subtotal">
                  <span>Total descuentos</span>
                  <span className="fin-monto">{formatearBs(finiquito.total_descuentos)}</span>
                </div>
              </div>
            </div>

            <div className="fin-liquido">
              <p className="fin-liquido__etiqueta">Líquido a pagar</p>
              <p className="fin-liquido__valor">{formatearBs(finiquito.liquido_pagable)}</p>
            </div>
          </>
        )}
      </Tarjeta>

      <div className="fin-integraciones-encabezado">
        <h2 className="fin-integraciones-titulo">Integraciones asíncronas</h2>
        {puedeGestionar && simActiva && (
          <Boton
            variante="predeterminado"
            tamano="sm"
            icono={WifiOff}
            cargando={procesando === "caida"}
            onClick={() => setModalCaida(true)}
          >
            Simular caída del broker
          </Boton>
        )}
      </div>

      {segundosCaida > 0 && (
        <Alerta tono="aviso" titulo="Caída simulada del broker activa">
          Las publicaciones hacia Pub/Sub fallarán temporalmente y quedarán en la bandeja de salida para reintentarse.
          Recuperación en {segundosCaida} s.
        </Alerta>
      )}

      <div className="fin-integraciones-grid">
        <TarjetaIntegracion
          destino="PAGOS"
          titulo="Pagos y Facturación (grupo A)"
          bloque={integraciones.PAGOS}
          estadoFiniquito={finiquito?.estado ?? "BORRADOR"}
          puedeGestionar={puedeGestionar}
          simulacionActiva={simActiva}
          procesando={procesando}
          onReenviar={alReenviar}
          onSimular={alSimular}
          onAbrirRechazo={(dest) => {
            setModalRechazo(dest);
            setMotivoRechazo("");
            setErrorMotivo(null);
          }}
        />
        <TarjetaIntegracion
          destino="CONTABILIDAD"
          titulo="Contabilidad (grupo D)"
          bloque={integraciones.CONTABILIDAD}
          estadoFiniquito={finiquito?.estado ?? "BORRADOR"}
          puedeGestionar={puedeGestionar}
          simulacionActiva={simActiva}
          procesando={procesando}
          onReenviar={alReenviar}
          onSimular={alSimular}
          onAbrirRechazo={(dest) => {
            setModalRechazo(dest);
            setMotivoRechazo("");
            setErrorMotivo(null);
          }}
        />
      </div>

      <Tarjeta titulo="Mensajes recibidos" nivelTitulo={2}>
        <Tabla
          descripcion="Mensajes recibidos de Pagos y Contabilidad"
          columnas={colsMensajes}
          filas={mensajes}
          claveFila="id_entrante"
          vacio={<p className="fin-nota">Aún no se recibieron mensajes externos para este finiquito.</p>}
        />
      </Tarjeta>

      <ModalConfirmacion
        abierto={modalAprobar}
        titulo="Aprobar finiquito oficial"
        textoConfirmar="Aprobar finiquito"
        variante="primario"
        procesando={procesando === "aprobar"}
        onConfirmar={alAprobar}
        onCancelar={() => setModalAprobar(false)}
      >
        Se generará el documento oficial para firma, el proceso quedará bloqueado para edición y se enviará la orden de pago a Pagos y el asiento a Contabilidad.
      </ModalConfirmacion>

      <ModalConfirmacion
        abierto={modalCaida}
        titulo="Simular caída del broker"
        textoConfirmar="Iniciar caída (30 s)"
        variante="peligro"
        procesando={procesando === "caida"}
        onConfirmar={alSimularCaida}
        onCancelar={() => setModalCaida(false)}
      >
        Durante 30 segundos las publicaciones fallarán y quedarán en la bandeja de salida para reintentarse.
      </ModalConfirmacion>

      <Modal
        abierto={Boolean(modalRechazo)}
        titulo={`Simular rechazo de ${modalRechazo === "PAGOS" ? "Pagos y Facturación" : "Contabilidad"}`}
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
          id="fin-motivo-rechazo"
          etiqueta="Motivo del rechazo"
          requerido
          placeholder="La cuenta contable no existe"
          value={motivoRechazo}
          onChange={(e) => setMotivoRechazo(e.target.value)}
          error={errorMotivo}
          data-autofocus
        />
      </Modal>
    </section>
  );
}

export default function FiniquitosPage() {
  const { idProceso } = useParams();
  return idProceso ? <DetalleFiniquito idProceso={idProceso} /> : <ListaFiniquitos />;
}
