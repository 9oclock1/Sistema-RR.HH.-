import { useEffect, useState } from "react";
import { CalendarSearch, RefreshCw } from "lucide-react";
import { listarBonos, procesarPeriodo } from "../../api/condiciones";
import { Alerta, Boton, CampoTexto, EstadoVacio, Tabla, useAvisos } from "../../components/ui";
import { formatearFecha, formatearValor } from "../conceptos/formato";
import { describirValor, formatearDia, formatearMes, formatearMomento, mesActual } from "./formato";

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Por defecto, el mes anterior: el que se cierra en la planilla.
function mesAnterior() {
  const [anio, mes] = mesActual().split("-").map(Number);
  return mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, "0")}`;
}

function detalle(b) {
  if (b.origen === "DETECCION") {
    const jornadas = b.cantidad === 1 ? "1 jornada" : `${b.cantidad} jornadas`;
    return { texto: `${jornadas} detectada${b.cantidad === 1 ? "" : "s"}`, nota: b.fechas.map(formatearDia).join(", ") };
  }
  const dias = b.cantidad === 1 ? "1 día asignado" : `${b.cantidad} días asignados`;
  const nota = b.asignacion
    ? `Desde ${formatearFecha(b.asignacion.vigente_desde)}${b.asignacion.vigente_hasta ? ` hasta ${formatearFecha(b.asignacion.vigente_hasta)}` : ""}`
    : "Asignación eliminada";
  return { texto: dias, nota };
}

const COLUMNAS = [
  {
    clave: "empleado",
    titulo: "Colaborador",
    celda: (b) => b.empleado.nombre_completo,
  },
  {
    clave: "condicion",
    titulo: "Condición",
    ancho: "22%",
    celda: (b) => (
      <div className="conceptos-nombre">
        <span className="conceptos-codigo">{b.condicion.codigo}</span>
        <span className="conceptos-nota">{b.condicion.nombre}</span>
      </div>
    ),
  },
  {
    clave: "detalle",
    titulo: "Detalle",
    ancho: "24%",
    celda: (b) => {
      const { texto, nota } = detalle(b);
      return (
        <div className="conceptos-nombre">
          <span>{texto}</span>
          <span className="conceptos-nota">{nota}</span>
        </div>
      );
    },
  },
  {
    clave: "valor",
    titulo: "Valor",
    ancho: "18%",
    celda: (b) => describirValor(b.valor, b.condicion.forma_calculo, b.condicion.tipo_condicion),
  },
  {
    clave: "monto",
    titulo: "Monto",
    ancho: "14%",
    alinear: "fin",
    celda: (b) =>
      b.monto === null ? (
        <span className="conceptos-nota">En la planilla</span>
      ) : (
        <span className="condiciones-monto">{formatearValor(b.monto, "MONTO_FIJO")}</span>
      ),
  },
];

export default function BonosPeriodo({ hayCondiciones }) {
  const avisar = useAvisos();
  const [periodo, setPeriodo] = useState(mesAnterior);
  const [datos, setDatos] = useState(null);
  // Errores con el mes al que corresponden: al cambiar de mes dejan de mostrarse.
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
      const respuesta = await procesarPeriodo(periodo);
      setDatos(respuesta);
      avisar({
        tono: "exito",
        titulo: `${formatearMes(periodo)} procesado`,
        mensaje:
          respuesta.bonos.length === 1
            ? "1 bono por condiciones especiales"
            : `${respuesta.bonos.length} bonos por condiciones especiales`,
      });
    } catch (e) {
      setErrorProceso({ periodo, mensaje: e.message });
    } finally {
      setProcesando(false);
    }
  };

  const actual = valido && datos?.periodo === periodo ? datos : null;
  const errorCarga = error?.periodo === periodo ? error.mensaje : null;
  const errorAlProcesar = errorProceso?.periodo === periodo ? errorProceso.mensaje : null;
  const cargando = valido && !actual && !errorCarga;
  const proceso = actual?.proceso;

  return (
    <div className="condiciones-bonos">
      <div className="conceptos-filtros condiciones-periodo">
        <CampoTexto
          id="bonos-periodo"
          etiqueta="Periodo"
          type="month"
          value={periodo}
          max={mesActual()}
          onChange={(evento) => setPeriodo(evento.target.value)}
          error={periodo && !valido ? "Elija un mes hasta el actual." : undefined}
        />
        <Boton
          variante="primario"
          icono={RefreshCw}
          cargando={procesando}
          disabled={!valido || !hayCondiciones}
          onClick={procesar}
        >
          {procesando ? "Procesando…" : proceso ? "Volver a procesar" : "Procesar periodo"}
        </Boton>
        <p className="conceptos-total" role="status">
          {cargando || !actual
            ? ""
            : proceso
              ? `Procesado el ${formatearMomento(proceso.procesado_en)} · ${proceso.jornadas_analizadas} jornadas analizadas`
              : "Sin procesar"}
        </p>
      </div>
      <p className="concepto-nota">
        Detecta trasnoches y feriados en las jornadas marcadas de Asistencia y aplica las asignaciones vigentes del mes.
        Volver a procesar reemplaza los bonos del mes.
      </p>

      {errorAlProcesar && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo procesar el periodo" onCerrar={() => setErrorProceso(null)}>
          {errorAlProcesar}
        </Alerta>
      )}

      {errorCarga ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar los bonos"
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
          {proceso && actual.bonos.length > 0 && (
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
            descripcion={`Bonos por condiciones especiales de ${valido ? formatearMes(periodo) : "el periodo"}`}
            columnas={COLUMNAS}
            filas={actual?.bonos ?? []}
            claveFila="id_bono"
            cargando={cargando}
            filasCargando={3}
            vacio={
              <EstadoVacio
                icono={CalendarSearch}
                titulo={proceso ? "Nadie cumplió una condición especial en el mes" : "El mes aún no se procesó"}
                mensaje={
                  proceso
                    ? "No hubo trasnoches ni feriados trabajados, ni asignaciones vigentes."
                    : hayCondiciones
                      ? "Procese el periodo para calcular los bonos."
                      : "Primero registre una condición especial."
                }
              />
            }
          />
          {actual?.totales.con_porcentaje > 0 && (
            <p className="concepto-nota">
              Los bonos en porcentaje se calculan en la planilla sobre el haber básico de cada colaborador.
            </p>
          )}
        </>
      )}
    </div>
  );
}
