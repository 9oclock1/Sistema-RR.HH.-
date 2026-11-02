import { ClipboardList, CopyPlus, Eye, Pencil, Trash2 } from "lucide-react";
import { Boton, EstadoVacio, Etiqueta, Tabla, TextoTruncado } from "../../components/ui";
import { ESTADOS, formatearPorcentaje } from "./plantilla";

const COLUMNAS = ({ onAbrir, onNuevaVersion, onEliminar }) => [
  {
    clave: "nombre",
    titulo: "Nombre",
    celda: (plantilla) => (
      <button type="button" className="plantillas-enlace ds-foco" onClick={() => onAbrir(plantilla)}>
        <TextoTruncado>{plantilla.nombre}</TextoTruncado>
      </button>
    ),
  },
  { clave: "version", titulo: "Versión", ancho: "8%", alinear: "fin", celda: (plantilla) => `v${plantilla.version}` },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "12%",
    celda: (plantilla) => <Etiqueta tono={ESTADOS[plantilla.estado].tono}>{ESTADOS[plantilla.estado].etiqueta}</Etiqueta>,
  },
  { clave: "total_criterios", titulo: "Criterios", ancho: "9%", alinear: "fin" },
  { clave: "total_preguntas", titulo: "Preguntas", ancho: "9%", alinear: "fin" },
  {
    clave: "suma_pesos",
    titulo: "Suma de pesos",
    ancho: "14%",
    alinear: "fin",
    celda: (plantilla) =>
      plantilla.balanceado ? (
        formatearPorcentaje(plantilla.suma_pesos)
      ) : (
        <Etiqueta tono="aviso" title="Debe sumar 100 % para publicar">
          {formatearPorcentaje(plantilla.suma_pesos)}
        </Etiqueta>
      ),
  },
  {
    clave: "acciones",
    titulo: <span className="ds-solo-lector">Acciones</span>,
    celda: (plantilla) => {
      const esBorrador = plantilla.estado === "BORRADOR";
      const nombre = `${plantilla.nombre} v${plantilla.version}`;
      return (
        <div className="plantillas-acciones">
          <Boton
            variante="sutil"
            soloIcono
            icono={esBorrador ? Pencil : Eye}
            aria-label={`${esBorrador ? "Editar" : "Ver"} ${nombre}`}
            title={esBorrador ? "Editar" : "Ver"}
            onClick={() => onAbrir(plantilla)}
          />
          {esBorrador ? (
            <Boton
              variante="sutil"
              soloIcono
              icono={Trash2}
              aria-label={`Eliminar ${nombre}`}
              title="Eliminar borrador"
              onClick={() => onEliminar(plantilla)}
            />
          ) : (
            <Boton
              variante="sutil"
              soloIcono
              icono={CopyPlus}
              aria-label={`Crear nueva versión de ${nombre}`}
              title="Crear nueva versión"
              onClick={() => onNuevaVersion(plantilla)}
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
      claveFila="id_plantilla"
      cargando={cargando}
      filasCargando={3}
      vacio={
        <EstadoVacio
          icono={ClipboardList}
          titulo="Aún no hay plantillas de evaluación"
          mensaje="Cree una plantilla con sus criterios, preguntas ponderadas y escalas de valoración."
          accion={accionVacia}
        />
      }
    />
  );
}
