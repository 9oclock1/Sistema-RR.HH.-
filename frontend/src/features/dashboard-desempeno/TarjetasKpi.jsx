import { Etiqueta } from "../../components/ui";
import { formatearDia } from "../ciclos-evaluacion/ciclo";
import { estadoSemaforo, formatearDecimal, formatearPorcentaje, porcentajeEnEscala } from "./dashboardDesempeno";

function Medidor({ valor, minimo, maximo, meta, descripcion, variante }) {
  return (
    <span className="dd-medidor" role="img" aria-label={descripcion}>
      <span
        className={`dd-medidor__relleno dd-medidor__relleno--${variante}`}
        style={{ width: `${porcentajeEnEscala(valor, minimo, maximo)}%` }}
      />
      <span className="dd-medidor__meta" style={{ left: `${porcentajeEnEscala(meta, minimo, maximo)}%` }} aria-hidden="true" />
    </span>
  );
}

function TarjetaKpi({ kpi, valor, unidad, meta, medidor, detalle, children }) {
  const estado = estadoSemaforo(kpi.semaforo);
  const sinDatos = kpi.valor === null;
  return (
    <li className={`dd-kpi dd-kpi--${estado.variante}`}>
      <div className="dd-kpi__encabezado">
        <p className="dd-kpi__nombre">
          <span className="dd-kpi__codigo">{kpi.codigo}</span> {kpi.nombre}
        </p>
        <Etiqueta tono={estado.tono} icono={estado.icono}>
          {estado.texto}
        </Etiqueta>
      </div>
      <p className="dd-kpi__valor">
        {valor}
        {!sinDatos && unidad && <span className="dd-kpi__unidad">{unidad}</span>}
      </p>
      <Medidor
        valor={kpi.valor}
        minimo={medidor.minimo}
        maximo={medidor.maximo}
        meta={kpi.meta}
        variante={estado.variante}
        descripcion={
          sinDatos
            ? `${kpi.nombre}: sin datos`
            : `${kpi.nombre}: ${valor}${unidad ?? ""}. Meta ${meta}. ${estado.texto}`
        }
      />
      <p className="dd-sutil">Meta: {meta}</p>
      <p className="dd-sutil">{detalle}</p>
      {children}
    </li>
  );
}

const plural = (cantidad, singular, varios) => `${cantidad} ${cantidad === 1 ? singular : varios}`;

// KPI-12 mientras carga o si EmployeeService no respondió: la tarjeta se muestra igual, sin valor ni semáforo.
const ROTACION_SIN_DATOS = { codigo: "KPI-12", nombre: "Rotación temprana", valor: null, meta: 15, semaforo: null };

function detalleRotacion({ datos, error }) {
  if (error) return `No se pudo calcular: ${error.message}`;
  if (!datos) return "Calculando con las altas y bajas del periodo…";
  const periodo = `del ${formatearDia(datos.periodo.desde)} al ${formatearDia(datos.periodo.hasta)}`;
  if (datos.valor === null) return `Sin ingresos ${periodo}: no hay base para calcularla`;
  return `${plural(datos.bajas_tempranas, "baja", "bajas")} con menos de ${datos.dias_antiguedad_temprana} días sobre ${plural(datos.ingresos_periodo, "ingreso", "ingresos")} ${periodo}`;
}

function BajasTempranas({ bajas }) {
  if (bajas.length === 0) return null;
  return (
    <details className="dd-kpi__desglose">
      <summary>Ver las bajas tempranas</summary>
      <ul>
        {bajas.map((baja) => (
          <li key={baja.id_empleado}>
            {baja.nombre_completo} · {baja.area} · {baja.sucursal}: ingresó el {formatearDia(baja.fecha_ingreso)}, baja el{" "}
            {formatearDia(baja.fecha_baja)} ({plural(baja.dias_antiguedad, "día", "días")})
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function TarjetasKpi({ puntaje, cumplimiento, altoDesempeno, rotacion = { datos: null, error: null } }) {
  const detallePuntaje = `${puntaje.evaluaciones_cerradas} evaluaciones cerradas · ${formatearDecimal(puntaje.puntaje_sobre_100)} sobre 100`;
  const detalleCumplimiento = `${cumplimiento.evaluaciones_enviadas} de ${cumplimiento.evaluaciones_asignadas} enviadas · ${cumplimiento.evaluaciones_vencidas} vencidas`;
  const kpiRotacion = rotacion.error || !rotacion.datos ? ROTACION_SIN_DATOS : rotacion.datos;

  return (
    <ul className="dd-kpis" aria-label="Indicadores del ciclo">
      <TarjetaKpi
        kpi={puntaje}
        valor={formatearDecimal(puntaje.valor)}
        unidad=" de 5"
        meta={`≥ ${formatearDecimal(puntaje.meta)}`}
        medidor={{ minimo: puntaje.escala.minimo, maximo: puntaje.escala.maximo }}
        detalle={puntaje.valor === null ? "Sin evaluaciones enviadas con estos filtros" : detallePuntaje}
      />
      <TarjetaKpi
        kpi={cumplimiento}
        valor={formatearPorcentaje(cumplimiento.valor)}
        meta={`≥ ${formatearPorcentaje(cumplimiento.meta)}`}
        medidor={{ minimo: 0, maximo: 100 }}
        detalle={cumplimiento.valor === null ? "Sin evaluaciones asignadas con estos filtros" : detalleCumplimiento}
      />
      {altoDesempeno && (
        <TarjetaKpi
          kpi={altoDesempeno}
          valor={formatearPorcentaje(altoDesempeno.valor)}
          meta={`≥ ${formatearPorcentaje(altoDesempeno.meta)}`}
          medidor={{ minimo: 0, maximo: 100 }}
          detalle={
            altoDesempeno.valor === null
              ? "Sin colaboradores evaluados con estos filtros"
              : `${altoDesempeno.colaboradores_alto_desempeno} de ${altoDesempeno.colaboradores_evaluados} colaboradores con puntaje ≥ ${formatearDecimal(altoDesempeno.umbral_puntaje)}`
          }
        />
      )}
      <TarjetaKpi
        kpi={kpiRotacion}
        valor={formatearPorcentaje(kpiRotacion.valor)}
        meta={`≤ ${formatearPorcentaje(kpiRotacion.meta)}`}
        medidor={{ minimo: 0, maximo: 100 }}
        detalle={detalleRotacion(rotacion)}
      >
        {rotacion.datos && !rotacion.error && <BajasTempranas bajas={rotacion.datos.detalle_bajas_tempranas} />}
      </TarjetaKpi>
    </ul>
  );
}
