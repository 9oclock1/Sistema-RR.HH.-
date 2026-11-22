import { Download, UserMinus } from "lucide-react";
import { Boton, EstadoVacio, Etiqueta, Tabla } from "../../components/ui";
import { ESTADOS, formatearFecha, formatearFechaHora } from "./formato";

const COLUMNAS = ({ onDescargar, descargandoId }) => [
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
    ancho: "22%",
    celda: (p) => p.causal?.nombre ?? "—",
  },
  {
    clave: "fecha_retiro",
    titulo: "Fecha de retiro",
    ancho: "13%",
    celda: (p) => formatearFecha(p.fecha_retiro),
  },
  {
    clave: "desahucio",
    titulo: "Desahucio",
    ancho: "20%",
    celda: (p) => (
      <Etiqueta tono={p.corresponde_desahucio ? "aviso" : "neutral"}>
        {p.corresponde_desahucio ? "Corresponde desahucio" : "No corresponde desahucio"}
      </Etiqueta>
    ),
  },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "12%",
    celda: (p) => {
      const cfg = ESTADOS[p.estado] ?? { etiqueta: p.estado, tono: "neutral" };
      return <Etiqueta tono={cfg.tono}>{cfg.etiqueta}</Etiqueta>;
    },
  },
  {
    clave: "creado_en",
    titulo: "Registrado",
    ancho: "12%",
    celda: (p) => formatearFechaHora(p.creado_en),
  },
  {
    clave: "acciones",
    titulo: <span className="ds-solo-lector">Respaldo</span>,
    ancho: "64px",
    alinear: "fin",
    celda: (p) => (
      <Boton
        variante="sutil"
        soloIcono
        icono={Download}
        cargando={descargandoId === p.id_proceso}
        aria-label={`Descargar respaldo de ${p.nombre_empleado}`}
        title={`Descargar ${p.documento?.nombre_archivo ?? "respaldo"}`}
        onClick={() => onDescargar(p)}
      />
    ),
  },
];

export default function TablaDesvinculaciones({ procesos, cargando, vacio, onDescargar, descargandoId }) {
  return (
    <Tabla
      className="desv-tabla"
      descripcion="Procesos de desvinculación registrados"
      columnas={COLUMNAS({ onDescargar, descargandoId })}
      filas={procesos}
      claveFila="id_proceso"
      cargando={cargando}
      filasCargando={4}
      vacio={vacio ?? <EstadoVacio icono={UserMinus} titulo="Aún no hay desvinculaciones registradas" />}
    />
  );
}
