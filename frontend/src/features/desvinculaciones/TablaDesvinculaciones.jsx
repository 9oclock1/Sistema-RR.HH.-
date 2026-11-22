import { Calculator, Download, UserMinus } from "lucide-react";
import { Boton, EstadoVacio, Etiqueta, Tabla } from "../../components/ui";
import { ESTADOS, formatearBs, formatearFecha, formatearFechaHora } from "./formato";

const COLUMNAS = ({ onDescargar, descargandoId, onVerPromedio }) => [
  {
    clave: "colaborador",
    titulo: "Colaborador",
    celda: (p) => (
      <div className="desv-nombre">
        <span>{p.nombre_empleado}</span>
        {p.fecha_ingreso && <span className="desv-nota">Ingreso: {formatearFecha(p.fecha_ingreso)}</span>}
      </div>
    ),
  },
  {
    clave: "causal",
    titulo: "Causal",
    ancho: "16%",
    celda: (p) => p.causal?.nombre ?? "—",
  },
  {
    clave: "fecha_retiro",
    titulo: "Fecha de retiro",
    ancho: "10%",
    celda: (p) => formatearFecha(p.fecha_retiro),
  },
  {
    clave: "desahucio",
    titulo: "Desahucio",
    ancho: "17%",
    celda: (p) => (
      <Etiqueta tono={p.corresponde_desahucio ? "aviso" : "neutral"}>
        {p.corresponde_desahucio ? "Corresponde desahucio" : "No corresponde desahucio"}
      </Etiqueta>
    ),
  },
  {
    clave: "promedio_indemnizable",
    titulo: "Sueldo promedio",
    ancho: "11%",
    celda: (p) =>
      p.promedio_indemnizable ? (
        <div className="desv-nombre">
          <span className="desv-monto">{formatearBs(p.promedio_indemnizable.promedio)}</span>
          <span className="desv-nota">
            {p.promedio_indemnizable.meses_considerados}{" "}
            {p.promedio_indemnizable.meses_considerados === 1 ? "mes" : "meses"}
          </span>
        </div>
      ) : (
        <span className="desv-nota">Sin calcular</span>
      ),
  },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "9%",
    celda: (p) => {
      const cfg = ESTADOS[p.estado] ?? { etiqueta: p.estado, tono: "neutral" };
      return <Etiqueta tono={cfg.tono}>{cfg.etiqueta}</Etiqueta>;
    },
  },
  {
    clave: "creado_en",
    titulo: "Registrado",
    ancho: "9%",
    celda: (p) => formatearFechaHora(p.creado_en),
  },
  {
    clave: "acciones",
    titulo: <span className="ds-solo-lector">Acciones</span>,
    ancho: "96px",
    alinear: "fin",
    celda: (p) => (
      <div className="desv-acciones">
        <Boton
          variante="sutil"
          soloIcono
          icono={Calculator}
          aria-label={`Ver sueldo promedio de ${p.nombre_empleado}`}
          title="Ver sueldo promedio indemnizable"
          onClick={() => onVerPromedio(p)}
        />
        <Boton
          variante="sutil"
          soloIcono
          icono={Download}
          cargando={descargandoId === p.id_proceso}
          aria-label={`Descargar respaldo de ${p.nombre_empleado}`}
          title={`Descargar ${p.documento?.nombre_archivo ?? "respaldo"}`}
          onClick={() => onDescargar(p)}
        />
      </div>
    ),
  },
];

export default function TablaDesvinculaciones({
  procesos,
  cargando,
  vacio,
  onDescargar,
  descargandoId,
  onVerPromedio,
}) {
  return (
    <Tabla
      className="desv-tabla"
      descripcion="Procesos de desvinculación registrados"
      columnas={COLUMNAS({ onDescargar, descargandoId, onVerPromedio })}
      filas={procesos}
      claveFila="id_proceso"
      cargando={cargando}
      filasCargando={4}
      vacio={vacio ?? <EstadoVacio icono={UserMinus} titulo="Aún no hay desvinculaciones registradas" />}
    />
  );
}
