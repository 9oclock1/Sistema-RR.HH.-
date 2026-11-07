import { ClipboardList, CopyPlus, Eye, Pencil, Trash2 } from "lucide-react";
import { Boton, EstadoVacio, Etiqueta, Tabla, TextoTruncado } from "../../components/ui";
import { ESTADOS, formatearFecha, formatearPorcentaje } from "./plantilla";

// Cada fila es una versión de una plantilla.
const COLUMNAS = ({ onAbrir, onNuevaVersion, onEliminar }) => [
  {
    clave: "nombre",
    titulo: "Nombre",
    celda: (version) => (
      <button type="button" className="plantillas-enlace ds-foco" onClick={() => onAbrir(version)}>
        <TextoTruncado>{version.nombre}</TextoTruncado>
      </button>
    ),
  },
  { clave: "departamento", titulo: "Área", ancho: "14%", celda: (version) => <TextoTruncado>{version.departamento}</TextoTruncado> },
  {
    clave: "vigencia",
    titulo: "Vigencia",
    ancho: "17%",
    celda: (version) => `${formatearFecha(version.vigencia_desde)} – ${formatearFecha(version.vigencia_hasta)}`,
  },
  { clave: "numero_version", titulo: "Versión", ancho: "8%", alinear: "fin", celda: (version) => `v${version.numero_version}` },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "11%",
    celda: (version) => <Etiqueta tono={ESTADOS[version.estado].tono}>{ESTADOS[version.estado].etiqueta}</Etiqueta>,
  },
  { clave: "total_preguntas", titulo: "Preguntas", ancho: "9%", alinear: "fin" },
  {
    clave: "suma_pesos",
    titulo: "Suma de pesos",
    ancho: "11%",
    alinear: "fin",
    celda: (version) =>
      version.balanceado ? (
        formatearPorcentaje(version.suma_pesos)
      ) : (
        <Etiqueta tono="aviso" title="Debe sumar 100 % para publicar">
          {formatearPorcentaje(version.suma_pesos)}
        </Etiqueta>
      ),
  },
  {
    clave: "acciones",
    titulo: <span className="ds-solo-lector">Acciones</span>,
    celda: (version) => {
      const esBorrador = version.estado === "BORRADOR";
      const nombre = `${version.nombre} v${version.numero_version}`;
      return (
        <div className="plantillas-acciones">
          <Boton
            variante="sutil"
            soloIcono
            icono={esBorrador ? Pencil : Eye}
            aria-label={`${esBorrador ? "Editar" : "Ver"} ${nombre}`}
            title={esBorrador ? "Editar" : "Ver"}
            onClick={() => onAbrir(version)}
          />
          {esBorrador ? (
            <Boton
              variante="sutil"
              soloIcono
              icono={Trash2}
              aria-label={`Eliminar ${nombre}`}
              title="Eliminar borrador"
              onClick={() => onEliminar(version)}
            />
          ) : (
            <Boton
              variante="sutil"
              soloIcono
              icono={CopyPlus}
              aria-label={`Crear nueva versión de ${nombre}`}
              title="Crear nueva versión"
              onClick={() => onNuevaVersion(version)}
            />
          )}
        </div>
      );
    },
  },
];

export default function TablaPlantillas({ plantillas, cargando, accionVacia, ...acciones }) {
  return (
    <Tabla
      className="plantillas-tabla"
      descripcion="Plantillas de evaluación"
      columnas={COLUMNAS(acciones)}
      filas={plantillas}
      claveFila="id_version"
      cargando={cargando}
      filasCargando={3}
      vacio={
        <EstadoVacio
          icono={ClipboardList}
          titulo="Aún no hay plantillas de evaluación"
          mensaje="Cree una plantilla con sus secciones por competencia, criterios, preguntas ponderadas y escalas de valoración."
          accion={accionVacia}
        />
      }
    />
  );
}
