import { useCallback, useEffect, useState } from "react";
import { HandCoins } from "lucide-react";
import { calcularBeneficiosSociales, obtenerBeneficiosSociales } from "../../api/desvinculaciones";
import { Alerta, Boton, Esqueleto, EstadoVacio, Etiqueta, Modal, Tabla } from "../../components/ui";
import { formatearBs, formatearFecha, formatearFechaHora, formatearTiempoServicio } from "./formato";

const ESTADOS_ABIERTOS = new Set(["INICIADO", "EN_CURSO"]);

const formula = (r, base) => {
  const divisor = r.divisor > 1 ? ` / ${r.divisor}` : "";
  return `${r.cantidad} × ${formatearBs(base)}${divisor}`;
};

const COLUMNAS_RENGLONES = (base) => [
  {
    clave: "descripcion",
    titulo: "Concepto",
    celda: (r) => (
      <div className="desv-nombre">
        <span>{r.descripcion}</span>
        <span className="desv-nota desv-monto">{formula(r, base)}</span>
      </div>
    ),
  },
  {
    clave: "monto",
    titulo: "Monto",
    ancho: "34%",
    alinear: "fin",
    celda: (r) => <span className="desv-monto">{formatearBs(r.monto)}</span>,
  },
];

function Concepto({ titulo, concepto }) {
  return (
    <div className="desv-beneficio">
      <div className="desv-beneficio-cabecera">
        <h3 className="desv-beneficio-titulo">{titulo}</h3>
        <Etiqueta tono={concepto.corresponde ? "exito" : "neutral"}>
          {concepto.corresponde ? "Corresponde" : "No corresponde"}
        </Etiqueta>
      </div>
      <p className="desv-nota">{concepto.motivo}</p>
      <p className="desv-beneficio-monto">{formatearBs(concepto.monto)}</p>
    </div>
  );
}

export default function BeneficiosSocialesModal({ proceso, identidad, onCerrar, onCalculado, puedeCalcular = false }) {
  const [cargando, setCargando] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const [desglose, setDesglose] = useState(null);
  const [sinCalculo, setSinCalculo] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);
  const [errorCalculo, setErrorCalculo] = useState(null);
  const [exitoCalculo, setExitoCalculo] = useState(null);

  // Calculan el Administrador y el Contador, solo en procesos abiertos y con el sueldo promedio ya calculado (RF-56).
  const esAbierto = puedeCalcular && ESTADOS_ABIERTOS.has(proceso.estado);
  const tienePromedio = Boolean(proceso.promedio_indemnizable);

  const cargar = useCallback(
    () =>
      obtenerBeneficiosSociales(proceso.id_proceso, identidad)
        .then((datos) => {
          setDesglose(datos);
          setSinCalculo(false);
          setErrorCarga(null);
        })
        .catch((error) => {
          if (error.estado === 404 && error.codigo === "BENEFICIOS_NO_CALCULADOS") {
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
      const nuevo = await calcularBeneficiosSociales(proceso.id_proceso, identidad);
      setDesglose(nuevo);
      setSinCalculo(false);
      setExitoCalculo(`Total ${formatearBs(nuevo.total)}.`);
      await onCalculado?.();
    } catch (error) {
      setErrorCalculo(error.message);
    } finally {
      setCalculando(false);
    }
  };

  const mensajeSinCalculo = !tienePromedio
    ? "Primero se debe calcular el sueldo promedio indemnizable: es la base de la indemnización y del desahucio."
    : puedeCalcular
      ? "Se calculará la indemnización por tiempo de servicio y el desahucio según la causal y la antigüedad."
      : "Podrá consultar el desglose cuando el Administrador de RRHH o el Contador calculen los beneficios.";

  return (
    <Modal
      abierto
      titulo="Indemnización y desahucio"
      onCerrar={onCerrar}
      bloqueado={calculando}
      tamano="md"
      pie={
        <>
          <Boton variante="sutil" onClick={onCerrar} disabled={calculando}>
            Cerrar
          </Boton>
          {desglose && esAbierto && (
            <Boton variante={desglose.desactualizado ? "primario" : "predeterminado"} onClick={calcular} cargando={calculando}>
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
            {proceso.causal?.nombre ?? "—"} · Ingreso: {formatearFecha(proceso.fecha_ingreso)} · Retiro:{" "}
            {formatearFecha(proceso.fecha_retiro)}
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
            titulo="No se pudieron cargar los beneficios sociales"
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
          <Alerta tono="peligro" role="alert" titulo="No se pudieron calcular los beneficios sociales">
            {errorCalculo}
          </Alerta>
        )}

        {!cargando && !errorCarga && exitoCalculo && (
          <Alerta tono="exito" role="status" titulo="Beneficios sociales calculados">
            {exitoCalculo}
          </Alerta>
        )}

        {!cargando && !errorCarga && sinCalculo && (
          <EstadoVacio
            icono={HandCoins}
            titulo="Aún no se calcularon los beneficios sociales"
            mensaje={mensajeSinCalculo}
            accion={
              esAbierto &&
              tienePromedio && (
                <Boton variante="primario" onClick={calcular} cargando={calculando}>
                  Calcular beneficios
                </Boton>
              )
            }
          />
        )}

        {!cargando && !errorCarga && desglose && (
          <>
            {desglose.desactualizado && (
              <Alerta tono="aviso" titulo="Cálculo desactualizado">
                El sueldo promedio indemnizable se recalculó después de este cálculo.
                {esAbierto ? " Recalcule los beneficios." : ""}
              </Alerta>
            )}

            <div className="desv-promedio-resumen">
              <p className="desv-promedio-valor">{formatearBs(desglose.total)}</p>
              <p className="desv-promedio-detalle">
                Indemnización {formatearBs(desglose.indemnizacion.monto)} · Desahucio{" "}
                {formatearBs(desglose.desahucio.monto)}
              </p>
              <p className="desv-nota">
                Tiempo de servicio: {formatearTiempoServicio(desglose.tiempo_servicio)} · Sueldo promedio{" "}
                {formatearBs(desglose.promedio_base)}
              </p>
              <p className="desv-nota">Calculado el {formatearFechaHora(desglose.calculado_en)}</p>
            </div>

            <div className="desv-beneficios">
              <Concepto titulo="Indemnización por tiempo de servicio" concepto={desglose.indemnizacion} />
              <Concepto titulo="Desahucio" concepto={desglose.desahucio} />
            </div>

            {desglose.renglones.length > 0 && (
              <Tabla
                descripcion="Desglose del cálculo de la indemnización y el desahucio"
                columnas={COLUMNAS_RENGLONES(desglose.promedio_base)}
                filas={desglose.renglones}
                claveFila="orden"
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
