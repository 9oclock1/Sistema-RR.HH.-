import { useEffect, useState } from "react";
import { CalendarSearch, RefreshCw } from "lucide-react";
import { listarBonos, procesarPeriodo } from "../../api/bonosProductividad";
import { Alerta, Boton, CampoTexto, Etiqueta, EstadoVacio, Tabla, useAvisos } from "../../components/ui";
import { formatearValor } from "../conceptos/formato";
import { TIPOS_META, formatearMes, formatearPorcentaje, mesActual, mesAnterior } from "./formato";
import SolicitudCierre from "./SolicitudCierre";

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const COLUMNAS = [
  { clave: "empleado", titulo: "Colaborador", celda: (b) => b.empleado.nombre_completo },
  {
    clave: "tipo_meta",
    titulo: "Meta",
    ancho: "16%",
    celda: (b) => <Etiqueta tono={TIPOS_META[b.regla.tipo_meta].tono}>{TIPOS_META[b.regla.tipo_meta].etiqueta}</Etiqueta>,
  },
  {
    clave: "cumplimiento",
    titulo: "Cumplimiento",
    ancho: "16%",
    celda: (b) => (
      <div className="conceptos-nombre">
        <span>{formatearPorcentaje(b.porcentaje_cumplimiento)}</span>
        <span className="conceptos-nota">Umbral: {formatearPorcentaje(b.regla.umbral_cumplimiento)}</span>
      </div>
    ),
  },
  {
    clave: "ventas",
    titulo: "Ventas / cuota",
    ancho: "20%",
    celda: (b) => `${formatearValor(b.metrica.monto_ventas, "MONTO_FIJO")} / ${formatearValor(b.metrica.cuota_asignada, "MONTO_FIJO")}`,
  },
  {
    clave: "monto",
    titulo: "Monto",
    ancho: "14%",
    alinear: "fin",
    celda: (b) =>
      b.monto === null ? <span className="conceptos-nota">En la planilla</span> : formatearValor(b.monto, "MONTO_FIJO"),
  },
];

export default function ResultadosPeriodo({ hayReglas }) {
  const avisar = useAvisos();
  const [periodo, setPeriodo] = useState(mesAnterior);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [errorProceso, setErrorProceso] = useState(null);
  const [intento, setIntento] = useState(0);
  const [procesando, setProcesando] = useState(false);
  const valido = PERIODO_RE.test(periodo) && periodo <= mesActual();

  useEffect(() => {
    if (!valido) return undefined;
    let vigente = true;
    listarBonos(periodo)
      .then((respuesta) => vigente && setDatos(respuesta))
      .catch((e) => vigente && setError({ periodo, mensaje: e.message }));
    return () => {
      vigente = false;
    };
  }, [periodo, valido, intento]);

  const reintentar = () => {
    setError(null);
    setIntento((n) => n + 1);
  };

  const procesar = async () => {
    setProcesando(true);
    setErrorProceso(null);
    try {
      await procesarPeriodo(periodo);
      const respuesta = await listarBonos(periodo);
      setDatos(respuesta);
      avisar({
        tono: "exito",
        titulo: `${formatearMes(periodo)} procesado`,
        mensaje: respuesta.bonos.length === 1 ? "1 bono de productividad" : `${respuesta.bonos.length} bonos de productividad`,
      });
    } catch (e) {
      setErrorProceso({ periodo, mensaje: e.message });
    } finally {
      setProcesando(false);
    }
  };

  const actual = valido && datos?.periodo?.slice(0, 7) === periodo ? datos : null;
  const errorCarga = error?.periodo === periodo ? error.mensaje : null;
  const errorAlProcesar = errorProceso?.periodo === periodo ? errorProceso.mensaje : null;
  const cargando = valido && !actual && !errorCarga;

  return (
    <div className="condiciones-bonos">
      <div className="conceptos-filtros condiciones-periodo">
        <CampoTexto
          id="productividad-periodo"
          etiqueta="Periodo"
          type="month"
          value={periodo}
          max={mesActual()}
          onChange={(evento) => setPeriodo(evento.target.value)}
          error={periodo && !valido ? "Elija un mes hasta el actual." : undefined}
        />
        <Boton variante="primario" icono={RefreshCw} cargando={procesando} disabled={!valido || !hayReglas} onClick={procesar}>
          {procesando ? "Procesando…" : "Volver a procesar"}
        </Boton>
      </div>
      <p className="concepto-nota">
        Aplica las reglas activas del periodo a las métricas de ventas recibidas de Marketplace y Ventas. Se procesa
        automáticamente al recibir el cierre de ventas del periodo; use este botón si cambió una regla después.
      </p>
      <SolicitudCierre periodo={periodo} valido={valido} />

      {errorAlProcesar && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo procesar el periodo" onCerrar={() => setErrorProceso(null)}>
          {errorAlProcesar}
        </Alerta>
      )}

      {errorCarga ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar los resultados"
          acciones={
            <Boton tamano="sm" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          {errorCarga}
        </Alerta>
      ) : (
        <>
          {actual && actual.bonos.length > 0 && (
            <dl className="vigencias-resumen condiciones-totales">
              <div>
                <dt>Bonos</dt>
                <dd>{actual.totales.bonos}</dd>
              </div>
              <div>
                <dt>Colaboradores</dt>
                <dd>{actual.totales.colaboradores}</dd>
              </div>
              <div>
                <dt>Total en monto fijo</dt>
                <dd>{formatearValor(actual.totales.monto_fijo, "MONTO_FIJO")}</dd>
              </div>
            </dl>
          )}
          <Tabla
            className="condiciones-tabla-bonos"
            descripcion={`Bonos de productividad de ${valido ? formatearMes(periodo) : "el periodo"}`}
            columnas={COLUMNAS}
            filas={actual?.bonos ?? []}
            claveFila="id_bono"
            cargando={cargando}
            filasCargando={3}
            vacio={
              <EstadoVacio
                icono={CalendarSearch}
                titulo="Nadie superó el umbral en el mes"
                mensaje={
                  hayReglas
                    ? "Aún no llegaron métricas de ventas que superen el umbral, o el mes no se procesó."
                    : "Primero registre una regla de bono por productividad."
                }
              />
            }
          />
        </>
      )}
    </div>
  );
}
