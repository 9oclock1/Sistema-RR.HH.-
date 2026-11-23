import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Download, FileSpreadsheet, FileText, FlaskConical, Landmark } from "lucide-react";
import { descargarReporteContable, generarReporteContable } from "../../api/reporteContable";
import { listarAguinaldos, simularConfirmacionAguinaldo } from "../../api/aguinaldo";
import { listarPlanillas, simularConfirmacionPlanilla } from "../../api/planillas";
import {
  Alerta,
  Boton,
  CampoTexto,
  EncabezadoPagina,
  EstadoVacio,
  Etiqueta,
  Selector,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import { useRol, useUsuario } from "../../context/sesion";
import { formatearBs } from "../planillas/formato";
import "../planillas/planillas.css";
import "../conceptos/conceptos.css";

const DESTINOS_SIMULAR = ["contabilidad", "pagos"];

const RECURSOS = [
  { valor: "planilla", etiqueta: "Planilla mensual" },
  { valor: "aguinaldo", etiqueta: "Planilla de aguinaldos" },
];

const CONCILIACION = {
  registrado: { etiqueta: "Registrado", tono: "exito" },
  pendiente: { etiqueta: "Pendiente", tono: "aviso" },
  con_error: { etiqueta: "Con error", tono: "peligro" },
};

const mesAnterior = () => {
  const hoy = new Date();
  const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  return `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, "0")}`;
};

const mesActual = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
};

const gestionAnterior = () => {
  const hoy = new Date();
  return hoy <= new Date(`${hoy.getFullYear()}-11-30T00:00:00`) ? hoy.getFullYear() - 1 : hoy.getFullYear();
};

function Conciliacion({ titulo, datos }) {
  const info = CONCILIACION[datos.estado];
  return (
    <div className="planilla-estado" role="status">
      <span className="conceptos-nota">{titulo}</span>
      <Etiqueta tono={info.tono}>{info.etiqueta}</Etiqueta>
      {datos.referencia && <span className="conceptos-nota">Ref. {datos.referencia}</span>}
      {datos.motivo && <span className="conceptos-nota">{datos.motivo}</span>}
    </div>
  );
}

function TablaCentro({ centro }) {
  return (
    <Tarjeta className="conceptos-tarjeta">
      <h3 className="planilla-cifra" style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
        {centro.centro_costo}
      </h3>
      <table className="ds-tabla" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Cuenta</th>
            <th>Nombre</th>
            <th style={{ textAlign: "right" }}>Debe</th>
            <th style={{ textAlign: "right" }}>Haber</th>
          </tr>
        </thead>
        <tbody>
          {centro.renglones.map((r) => (
            <tr key={`${r.cuenta.codigo}-${r.debe}-${r.haber}`}>
              <td>{r.cuenta.codigo}</td>
              <td>{r.cuenta.nombre}</td>
              <td className="planilla-cifra" style={{ textAlign: "right" }}>{r.debe > 0 ? formatearBs(r.debe) : "—"}</td>
              <td className="planilla-cifra" style={{ textAlign: "right" }}>{r.haber > 0 ? formatearBs(r.haber) : "—"}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2}>
              <strong>Total {centro.centro_costo}</strong>
            </td>
            <td className="planilla-cifra" style={{ textAlign: "right" }}>
              <strong>{formatearBs(centro.total_debe)}</strong>
            </td>
            <td className="planilla-cifra" style={{ textAlign: "right" }}>
              <strong>{formatearBs(centro.total_haber)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </Tarjeta>
  );
}

export default function ReporteContablePage() {
  const avisar = useAvisos();
  const rol = useRol();
  const idEmpleado = useUsuario();
  const identidad = { idEmpleado, rol };
  const [recurso, setRecurso] = useState("planilla");
  const [periodo, setPeriodo] = useState(mesAnterior);
  const [gestion, setGestion] = useState(gestionAnterior);
  const [sucursal, setSucursal] = useState("");
  const [carga, setCarga] = useState(null);
  const [intento, setIntento] = useState(0);
  const [descargando, setDescargando] = useState(null);
  const [simulando, setSimulando] = useState(false);

  const identificador = recurso === "planilla" ? periodo : gestion;
  const anioValido = Number.isInteger(gestion) && gestion >= 2000 && gestion <= 2100;
  const valido = recurso === "planilla" ? /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo) : anioValido;

  useEffect(() => {
    if (!valido) return undefined;
    let vigente = true;
    setCarga(null);
    generarReporteContable(recurso, identificador, identidad)
      .then((reporte) => vigente && setCarga({ recurso, identificador, reporte }))
      .catch((e) => vigente && setCarga({ recurso, identificador, error: e.message, codigo: e.codigo }));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurso, identificador, valido, intento, idEmpleado, rol]);

  const actual = valido && carga?.recurso === recurso && carga?.identificador === identificador ? carga : null;
  const cargando = valido && !actual;
  const reporte = actual?.reporte ?? null;

  const centrosFiltrados = useMemo(() => {
    if (!reporte) return [];
    if (!sucursal) return reporte.centros_costo;
    return reporte.centros_costo.filter((c) => c.centro_costo === sucursal);
  }, [reporte, sucursal]);

  const opcionesSucursal = useMemo(
    () => (reporte?.centros_costo ?? []).map((c) => ({ valor: c.centro_costo, etiqueta: c.centro_costo })),
    [reporte]
  );

  // El reporte exige el recurso CERRADA (ambas confirmaciones ya llegaron): mientras eso no pase, no hay
  // nada que mostrar. Este botón simula que Contabilidad y Pagos aceptan, pero de la misma forma real que ya
  // usan las pantallas de Planillas/Aguinaldos: PUBLICA la confirmación en Pub/Sub (no la aplica directo), y
  // la suscripción real de este mismo servicio la recibe y la cierra, igual que una confirmación genuina.
  const simularAceptacion = async () => {
    setSimulando(true);
    try {
      const recursoActual =
        recurso === "planilla"
          ? (await listarPlanillas(periodo))[0]
          : (await listarAguinaldos()).find((a) => a.gestion === gestion);
      if (!recursoActual) throw new Error("No se encontró el recurso para simular la aceptación.");
      const simular = recurso === "planilla" ? simularConfirmacionPlanilla : simularConfirmacionAguinaldo;
      const pendientes = DESTINOS_SIMULAR.filter((d) => recursoActual.integraciones[d].estado !== "CONFIRMADA");
      if (pendientes.length === 0) {
        avisar({ tono: "info", titulo: "Ya estaba todo confirmado", mensaje: "Debería cerrarse en unos segundos." });
      } else {
        await Promise.all(pendientes.map((d) => simular(recursoActual.id_planilla ?? recursoActual.id_aguinaldo, d, { resultado: "CONFIRMADA" }, identidad)));
        avisar({
          tono: "info",
          titulo: "Simulación enviada",
          mensaje: "Se publicó la aceptación de Contabilidad y Pagos; el reporte se podrá generar en unos segundos.",
        });
      }
      setTimeout(() => setIntento((n) => n + 1), 2500);
    } catch (e) {
      avisar({ tono: "peligro", titulo: "No se pudo simular la aceptación", mensaje: e.message });
    } finally {
      setSimulando(false);
    }
  };

  const descargar = async (formato) => {
    setDescargando(formato);
    try {
      const blob = await descargarReporteContable(recurso, identificador, formato, identidad);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      const sufijo = recurso === "planilla" ? periodo : `gestion-${gestion}`;
      enlace.download = `reporte-contable_${recurso}_${sufijo}.${formato}`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      avisar({ tono: "peligro", titulo: "No se pudo descargar el reporte", mensaje: e.message });
    } finally {
      setDescargando(null);
    }
  };

  return (
    <section className="conceptos" aria-labelledby="reporte-contable-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Planillas" }]}
        enlace={Link}
        titulo="Reporte contable consolidado"
        idTitulo="reporte-contable-titulo"
        descripcion="Gastos y pasivos de nómina agrupados por cuenta contable y centro de costo, con el estado de conciliación de Contabilidad y Pagos."
      />

      <Tarjeta className="conceptos-tarjeta">
        <div className="planilla-barra">
          <Selector
            id="reporte-recurso"
            etiqueta="Recurso"
            value={recurso}
            onChange={(e) => {
              setRecurso(e.target.value);
              setSucursal("");
            }}
            opciones={RECURSOS}
          />
          {recurso === "planilla" ? (
            <CampoTexto
              id="reporte-periodo"
              etiqueta="Periodo"
              type="month"
              value={periodo}
              max={mesActual()}
              onChange={(e) => setPeriodo(e.target.value)}
            />
          ) : (
            <CampoTexto
              id="reporte-gestion"
              etiqueta="Gestión (año de cierre)"
              type="number"
              min="2000"
              max="2100"
              value={gestion}
              onChange={(e) => setGestion(Number(e.target.value))}
            />
          )}
          {opcionesSucursal.length > 1 && (
            <Selector
              id="reporte-sucursal"
              etiqueta="Centro de costo"
              value={sucursal}
              onChange={(e) => setSucursal(e.target.value)}
              opciones={opcionesSucursal}
              textoVacio="Todas"
            />
          )}
          {reporte && (
            <div className="planilla-barra__acciones">
              <Boton variante="sutil" icono={FileSpreadsheet} cargando={descargando === "xlsx"} onClick={() => descargar("xlsx")}>
                Excel
              </Boton>
              <Boton variante="sutil" icono={FileText} cargando={descargando === "pdf"} onClick={() => descargar("pdf")}>
                PDF
              </Boton>
            </div>
          )}
        </div>

        {actual?.error ? (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudo generar el reporte"
            acciones={
              <>
                {actual.codigo === "NO_CERRADA" && (
                  <Boton tamano="sm" variante="sutil" icono={FlaskConical} cargando={simulando} onClick={simularAceptacion}>
                    Simular aceptación
                  </Boton>
                )}
                <Boton tamano="sm" onClick={() => setIntento((n) => n + 1)}>
                  Reintentar
                </Boton>
              </>
            }
          >
            {actual.error}
          </Alerta>
        ) : cargando ? (
          <p className="conceptos-nota">Generando reporte…</p>
        ) : !reporte ? (
          <EstadoVacio icono={Landmark} titulo="Elija un periodo o gestión válidos" mensaje="El reporte se genera para un periodo o gestión en concreto." />
        ) : (
          <div className="planilla-contenido">
            <div className="planilla-estado" role="status">
              <Etiqueta tono="info">{reporte.estado}</Etiqueta>
              <span className="conceptos-nota">{reporte.colaboradores} colaboradores</span>
            </div>
            <div className="vigencias-resumen planilla-totales">
              <Conciliacion titulo="Contabilidad" datos={reporte.conciliacion.contabilidad} />
              <Conciliacion titulo="Pagos" datos={reporte.conciliacion.pagos} />
            </div>

            {centrosFiltrados.length === 0 ? (
              <EstadoVacio icono={Download} titulo="Sin gastos en este periodo" mensaje="No hay montos registrados para consolidar." />
            ) : (
              centrosFiltrados.map((centro) => <TablaCentro key={centro.centro_costo} centro={centro} />)
            )}

            <dl className="vigencias-resumen planilla-totales">
              <div>
                <dt>Total debe</dt>
                <dd className="planilla-cifra">{formatearBs(reporte.totales.total_debe)}</dd>
              </div>
              <div>
                <dt>Total haber</dt>
                <dd className="planilla-cifra">{formatearBs(reporte.totales.total_haber)}</dd>
              </div>
              <div>
                <dt>Cuadre</dt>
                <dd>
                  <Etiqueta tono={reporte.totales.cuadra ? "exito" : "peligro"}>{reporte.totales.cuadra ? "Cuadra" : "No cuadra"}</Etiqueta>
                </dd>
              </div>
            </dl>
          </div>
        )}
      </Tarjeta>
    </section>
  );
}
