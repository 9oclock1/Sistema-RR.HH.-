import { CalendarDays } from "lucide-react";
import { EstadoVacio, Etiqueta, Tabla, Tarjeta } from "../../components/ui";
import { ESTADOS, formatearFecha, formatearPeriodo } from "./formato";

const COLUMNAS = [
  {
    clave: "periodo",
    titulo: "Periodo",
    celda: (solicitud) => formatearPeriodo(solicitud.fecha_inicio, solicitud.fecha_fin),
  },
  { clave: "dias_habiles", titulo: "Días hábiles", ancho: "16%", alinear: "fin" },
  {
    clave: "estado_codigo",
    titulo: "Estado",
    ancho: "18%",
    celda: (solicitud) => {
      const estado = ESTADOS[solicitud.estado_codigo] ?? { tono: "neutral", texto: solicitud.estado_nombre };
      return <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>;
    },
  },
  {
    clave: "creado_en",
    titulo: "Enviada",
    ancho: "20%",
    celda: (solicitud) => formatearFecha(solicitud.creado_en.slice(0, 10)),
  },
];

export default function TablaSolicitudes({ solicitudes, cargando }) {
  return (
    <Tarjeta titulo="Mis solicitudes" nivelTitulo={2} className="vacaciones-tarjeta">
      <Tabla
        columnas={COLUMNAS}
        filas={solicitudes}
        claveFila="id_solicitud"
        descripcion="Solicitudes de vacaciones enviadas"
        cargando={cargando}
        filasCargando={3}
        className="vacaciones-tabla"
        vacio={<EstadoVacio icono={CalendarDays} titulo="Aún no envió solicitudes de vacaciones" />}
      />
    </Tarjeta>
  );
}
