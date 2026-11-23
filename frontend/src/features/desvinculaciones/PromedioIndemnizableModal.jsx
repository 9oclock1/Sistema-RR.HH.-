import { useCallback, useEffect, useState } from "react";
import { Calculator } from "lucide-react";
import { calcularPromedioIndemnizable, obtenerPromedioIndemnizable } from "../../api/desvinculaciones";
import { Alerta, Boton, Esqueleto, EstadoVacio, Modal, Tabla } from "../../components/ui";
import { formatearBs, formatearFecha, formatearFechaHora, formatearPeriodo } from "./formato";

const ESTADOS_ABIERTOS = new Set(["INICIADO", "EN_CURSO"]);

const COLUMNAS_DESGLOSE = [
  {
    clave: "periodo",
    titulo: "Mes",
    ancho: "22%",
    celda: (m) => formatearPeriodo(m.periodo),
  },
  {
    clave: "dias_pagados",
    titulo: "Días pagados",
    ancho: "16%",
    celda: (m) => m.dias_pagados,
  },
  {
    clave: "ingresos",
    titulo: "Ingresos",
    celda: (m) =>
      m.ingresos?.length > 0 ? (
        <ul className="desv-ingresos-lista">
          {m.ingresos.map((ing) => (
            <li key={ing.codigo} className="desv-ingreso-item">
              <span>{ing.nombre}</span>
              <span className="desv-monto">{formatearBs(ing.resultado)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="desv-nota">Sin detalle de ingresos</span>
      ),
  },
  {
    clave: "total_ganado",
    titulo: "Total ganado",
    ancho: "20%",
    alinear: "fin",
    celda: (m) => <span className="desv-monto">{formatearBs(m.total_ganado)}</span>,
  },
];

export default function PromedioIndemnizableModal({ proceso, identidad, onCerrar, onCalculado, puedeCalcular = true }) {
  const [cargando, setCargando] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const [desglose, setDesglose] = useState(null);
  const [sinCalculo, setSinCalculo] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);
  const [errorCalculo, setErrorCalculo] = useState(null);
  // El modal se abre en la capa superior y taparía un aviso flotante: la confirmación se muestra dentro del modal.
  const [exitoCalculo, setExitoCalculo] = useState(null);

  // Solo el Administrador calcula y solo sobre procesos abiertos; el Contador consulta el desglose (RF-55).
  const esAbierto = puedeCalcular && ESTADOS_ABIERTOS.has(proceso.estado);

  const cargar = useCallback(
    () =>
      obtenerPromedioIndemnizable(proceso.id_proceso, identidad)
        .then((datos) => {
          setDesglose(datos);
          setSinCalculo(false);
          setErrorCarga(null);
        })
        .catch((error) => {
          if (error.estado === 404 && error.codigo === "PROMEDIO_NO_CALCULADO") {
            setDesglose(null);
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
    setErrorCalculo(null);
    cargar();
  };

  const calcular = async () => {
    setCalculando(true);
    setErrorCalculo(null);
    setExitoCalculo(null);
    try {
      const nuevo = await calcularPromedioIndemnizable(proceso.id_proceso, identidad);
      setDesglose(nuevo);
      setSinCalculo(false);
      setExitoCalculo(
        `${formatearBs(nuevo.promedio)} sobre ${nuevo.meses_considerados} ${
          nuevo.meses_considerados === 1 ? "mes" : "meses"
        }.`
      );
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
      titulo="Sueldo promedio indemnizable"
      onCerrar={onCerrar}
      bloqueado={calculando}
      tamano="md"
      pie={
        <>
          <Boton variante="sutil" onClick={onCerrar} disabled={calculando}>
            Cerrar
          </Boton>
          {desglose && esAbierto && (
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
            <Esqueleto forma="texto" ancho="70%" />
            <Esqueleto forma="bloque" ancho="100%" alto="calc(var(--size-row) * 3.5)" />
          </div>
        )}

        {!cargando && errorCarga && (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudo cargar el sueldo promedio"
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
          <Alerta tono="peligro" role="alert" titulo="No se pudo calcular el sueldo promedio">
            {errorCalculo}
          </Alerta>
        )}

        {!cargando && !errorCarga && exitoCalculo && (
          <Alerta tono="exito" role="status" titulo="Sueldo promedio calculado">
            {exitoCalculo}
          </Alerta>
        )}

        {!cargando && !errorCarga && sinCalculo && (
          <EstadoVacio
            icono={Calculator}
            titulo="Aún no se calculó el sueldo promedio"
            mensaje={
              puedeCalcular
                ? "Se tomará el total ganado de las tres últimas planillas cerradas del colaborador hasta el mes del retiro."
                : "Podrá consultar el desglose cuando el Administrador de RRHH calcule el sueldo promedio."
            }
            accion={
              esAbierto && (
                <Boton variante="primario" onClick={calcular} cargando={calculando}>
                  Calcular promedio
                </Boton>
              )
            }
          />
        )}

        {!cargando && !errorCarga && desglose && (
          <>
            <div className="desv-promedio-resumen">
              <p className="desv-promedio-valor">{formatearBs(desglose.promedio)}</p>
              <p className="desv-promedio-detalle">
                Promedio de {desglose.meses_considerados}{" "}
                {desglose.meses_considerados === 1 ? "mes" : "meses"} · Suma{" "}
                {formatearBs(desglose.total_considerado)}
              </p>
              <p className="desv-nota">Calculado el {formatearFechaHora(desglose.calculado_en)}</p>
            </div>

            {desglose.observaciones?.length > 0 && (
              <Alerta tono="aviso" titulo="Observaciones del cálculo">
                <ul className="desv-promedio-observaciones">
                  {desglose.observaciones.map((obs) => (
                    <li key={obs}>{obs}</li>
                  ))}
                </ul>
              </Alerta>
            )}

            <Tabla
              descripcion="Desglose mensual del sueldo promedio indemnizable"
              columnas={COLUMNAS_DESGLOSE}
              filas={desglose.meses}
              claveFila="periodo"
            />
          </>
        )}
      </div>
    </Modal>
  );
}
