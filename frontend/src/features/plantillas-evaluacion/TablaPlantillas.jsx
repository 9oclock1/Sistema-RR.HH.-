import { ClipboardList, Pencil, Trash2 } from "lucide-react";
import { Boton, EstadoVacio, Etiqueta, Tabla, TextoTruncado } from "../../components/ui";
import { ESTADOS_PLANTILLA, esEditable, formatearVigencia } from "./formato";

const COLUMNAS = ({ onEditar, onEliminar }) => [
  {
    clave: "plantilla",
    titulo: "Plantilla",
    ancho: "34%",
    celda: (p) => (
      <div className="pl-celda">
        <TextoTruncado className="pl-celda__principal">{p.nombre}</TextoTruncado>
        <TextoTruncado className="pl-sutil">{p.objetivo}</TextoTruncado>
      </div>
    ),
  },
  {
    clave: "area",
    titulo: "Área destino",
    ancho: "18%",
    celda: (p) => <TextoTruncado>{p.area.nombre}</TextoTruncado>,
  },
  {
    clave: "vigencia",
    titulo: "Vigencia",
    ancho: "20%",
    celda: (p) => <span className="pl-vigencia">{formatearVigencia(p.vigencia_desde, p.vigencia_hasta)}</span>,
  },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "14%",
    celda: (p) => {
      const estado = ESTADOS_PLANTILLA[p.estado_codigo];
      return (
        <div className="pl-celda">
          <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
          <span className="pl-sutil">Versión {p.version_actual.numero_version}</span>
        </div>
      );
    },
  },
  {
    clave: "secciones",
    titulo: "Secciones",
    ancho: "8%",
    alinear: "fin",
    celda: (p) => <span className="pl-numero">{p.secciones_total}</span>,
  },
  {
    clave: "acciones",
    titulo: <span className="ds-solo-lector">Acciones</span>,
    celda: (p) =>
      esEditable(p) && (
        <div className="pl-acciones">
          <Boton
            variante="sutil"
            soloIcono
            icono={Pencil}
            aria-label={`Editar ${p.nombre}`}
            title="Editar datos"
            onClick={() => onEditar(p)}
          />
          <Boton
            variante="sutil"
            soloIcono
            icono={Trash2}
            aria-label={`Eliminar ${p.nombre}`}
            title="Eliminar"
            onClick={() => onEliminar(p)}
          />
        </div>
      ),
  },
];

export default function TablaPlantillas({ plantillas, cargando, vacio, ...acciones }) {
  return (
    <Tabla
      className="pl-tabla"
      descripcion="Plantillas de evaluación"
      columnas={COLUMNAS(acciones)}
      filas={plantillas}
      claveFila="id_plantilla"
      cargando={cargando}
      filasCargando={4}
      vacio={vacio ?? <EstadoVacio icono={ClipboardList} titulo="Aún no hay plantillas" />}
    />
  );
}
