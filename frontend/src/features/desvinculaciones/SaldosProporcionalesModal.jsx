import { useCallback, useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { calcularSaldosProporcionales, obtenerSaldosProporcionales } from "../../api/desvinculaciones";
import { Alerta, Boton, Esqueleto, EstadoVacio, Modal, Tabla } from "../../components/ui";
import { formatearBs, formatearFecha, formatearFechaHora } from "./formato";

const ESTADOS_ABIERTOS = new Set(["INICIADO", "EN_CURSO"]);

const plural = (n, singular, varios) => `${n} ${n === 1 ? singular : varios}`;
const tiempo = (meses, dias) => `${plural(meses, "mes", "meses")} y ${plural(dias, "día", "días")}`;
const dias = (n) => `${Number(n).toLocaleString("es-BO", { maximumFractionDigits: 2 })} ${Number(n) === 1 ? "día" : "días"}`;

// Un renglón por concepto, con el cálculo a la vista para que el Contador pueda verificarlo.
function renglones(s) {
  const { aguinaldo: a, vacaciones: v } = s;
  return [
    {
      clave: "aguinaldo",
      concepto: "Duodécimas de aguinaldo",
      detalle: `Gestión ${a.gestion}: del ${formatearFecha(a.desde)} al ${formatearFecha(a.hasta)}, ${tiempo(a.meses, a.dias)}. ${formatearBs(s.promedio)} × (${a.meses} + ${a.dias}/30) ÷ 12`,
      monto: a.monto,
    },
    {
      clave: "pendientes",
      concepto: "Vacaciones no gozadas",
      detalle: `${dias(v.dias_pendientes)} pendientes (${v.dias_acumulados} acreditados − ${v.dias_gozados} gozados) × ${formatearBs(s.salario_diario)} por día`,
      monto: v.monto_pendientes,
    },
    {
      clave: "duodecima",
      concepto: "Duodécima de vacaciones",
      detalle: `Año de servicio en curso desde el ${formatearFecha(v.anio_en_curso.desde)}: ${tiempo(v.anio_en_curso.meses, v.anio_en_curso.dias)}. Escala de ${v.dias_escala} días → ${dias(v.dias_duodecima)} × ${formatearBs(s.salario_diario)}`,
      monto: v.monto_duodecima,
    },
  ];
}

const COLUMNAS = [
  {
    clave: "concepto",
    titulo: "Concepto",
    celda: (r) => (
      <div className="desv-saldo-concepto">
        <span>{r.concepto}</span>
        <span className="desv-nota">{r.detalle}</span>
      </div>
    ),
  },
  {
    clave: "monto",
    titulo: "Monto",
    ancho: "22%",
    alinear: "fin",
    celda: (r) => <span className="desv-monto">{formatearBs(r.monto)}</span>,
  },
];

export default function SaldosProporcionalesModal({ proceso, identidad, onCerrar, onCalculado, puedeCalcular = true }) {
  const [cargando, setCargando] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const [saldos, setSaldos] = useState(null);
  const [sinCalculo, setSinCalculo] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);
  const [errorCalculo, setErrorCalculo] = useState(null);
  const [exito, setExito] = useState(null);

  const esAbierto = puedeCalcular && ESTADOS_ABIERTOS.has(proceso.estado);

  const cargar = useCallback(
    () =>
      obtenerSaldosProporcionales(proceso.id_proceso, identidad)
        .then((datos) => {
          setSaldos(datos);
          setSinCalculo(false);
          setErrorCarga(null);
        })
        .catch((error) => {
          if (error.estado === 404 && error.codigo === "SALDOS_NO_CALCULADOS") {
            setSaldos(null);
            setSinCalculo(true);
            setErrorCarga(null);
          } else {
            setErrorCarga(error.message);
          }
        })
        .finally(() => setCargando(false)),
    [proceso.id_proceso, identidad]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const reintentar = () => {
    setCargando(true);
    setErrorCarga(null);
    cargar();
  };

  const calcular = async () => {
    setCalculando(true);
    setErrorCalculo(null);
    setExito(null);
    try {
      const nuevo = await calcularSaldosProporcionales(proceso.id_proceso, identidad);
      setSaldos(nuevo);
      setSinCalculo(false);
      setExito(`Total de saldos proporcionales: ${formatearBs(nuevo.total)}.`);
      await onCalculado?.();
    } catch (error) {
      setErrorCalculo(error.message);
    } finally {
      setCalculando(false);
    }
  };

  return (
    <Modal
      abierto
      titulo="Saldos proporcionales del finiquito"
      onCerrar={onCerrar}
      bloqueado={calculando}
      tamano="md"
      pie={
        <>
          <Boton variante="sutil" onClick={onCerrar} disabled={calculando}>
            Cerrar
          </Boton>
          {saldos && esAbierto && (
            <Boton variante="predeterminado" onClick={calcular} cargando={calculando}>
              Recalcular
            </Boton>
          )}
        </>
      }
    >
      <div className="desv-promedio-contenido">
        <div className="desv-promedio-cabecera">
          <p className="desv-promedio-colaborador">{proceso.nombre_empleado}</p>
          <p className="desv-nota">
            {proceso.causal?.nombre ?? "—"} · Retiro: {formatearFecha(proceso.fecha_retiro)}
          </p>
        </div>

        {cargando && (
          <div className="desv-esqueletos" aria-busy="true">
            <Esqueleto forma="bloque" ancho="100%" alto="calc(var(--size-row) * 2)" />
            <Esqueleto forma="bloque" ancho="100%" alto="calc(var(--size-row) * 3.5)" />
          </div>
        )}

        {!cargando && errorCarga && (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudieron cargar los saldos proporcionales"
            acciones={
              <Boton tamano="sm" onClick={reintentar}>
                Reintentar
              </Boton>
            }
          >
            {errorCarga}
          </Alerta>
        )}

        {!cargando && !errorCarga && errorCalculo && (
          <Alerta tono="peligro" role="alert" titulo="No se pudieron calcular los saldos">
            {errorCalculo}
          </Alerta>
        )}

        {!cargando && !errorCarga && exito && (
          <Alerta tono="exito" role="status" titulo="Saldos calculados">
            {exito}
          </Alerta>
        )}

        {!cargando && !errorCarga && sinCalculo && (
          <EstadoVacio
            icono={Scale}
            titulo="Aún no se calcularon los saldos proporcionales"
            mensaje={
              puedeCalcular
                ? "Duodécimas de aguinaldo de la gestión en curso y vacaciones truncas, valorizadas con el sueldo promedio indemnizable (se calcula antes si todavía no existe)."
                : "Podrá consultarlos cuando el Administrador de RRHH los calcule."
            }
            accion={
              esAbierto && (
                <Boton variante="primario" onClick={calcular} cargando={calculando}>
                  Calcular saldos
                </Boton>
              )
            }
          />
        )}

        {!cargando && !errorCarga && saldos && (
          <>
            <div className="desv-promedio-resumen">
              <p className="desv-promedio-valor">{formatearBs(saldos.total)}</p>
              <p className="desv-promedio-detalle">
                Sueldo promedio {formatearBs(saldos.promedio)} · Diario {formatearBs(saldos.salario_diario)} ·{" "}
                {plural(saldos.vacaciones.anios_servicio, "año", "años")} de servicio
              </p>
              <p className="desv-nota">Calculado el {formatearFechaHora(saldos.calculado_en)}</p>
            </div>

            {saldos.observaciones?.length > 0 && (
              <Alerta tono="aviso" titulo="Observaciones del cálculo">
                <ul className="desv-promedio-observaciones">
                  {saldos.observaciones.map((obs) => (
                    <li key={obs}>{obs}</li>
                  ))}
                </ul>
              </Alerta>
            )}

            <Tabla
              descripcion="Desglose de los saldos proporcionales"
              columnas={COLUMNAS}
              filas={renglones(saldos)}
              claveFila="clave"
            />
          </>
        )}
      </div>
    </Modal>
  );
}
