import { Download, FileX } from "lucide-react";
import { Boton, Etiqueta, EstadoVacio, Tabla, Tarjeta } from "../../components/ui";
import { formatearFecha } from "./reglas";

const TONO_ESTADO = { PENDIENTE: "aviso", APROBADA: "exito", RECHAZADA: "peligro", CANCELADA: "neutral" };

export default function MisSolicitudes({ solicitudes, cargando, onDescargar }) {
  const columnas = [
    {
      clave: "tipo_nombre",
      titulo: "Licencia",
      celda: (s) => (
        <span className="licencias-tipo">
          {s.tipo_nombre}
          {s.excede_limite_dias && (
            <Etiqueta tono="aviso" className="licencias-tipo__marca">
              Autorización especial
            </Etiqueta>
          )}
        </span>
      ),
    },
    {
      clave: "fechas",
      titulo: "Fechas",
      celda: (s) => `${formatearFecha(s.fecha_inicio)} – ${formatearFecha(s.fecha_fin)}`,
    },
    { clave: "dias_solicitados", titulo: "Días", alinear: "fin" },
    {
      clave: "clasificacion_nomina",
      titulo: "Haberes",
      celda: (s) => (
        <Etiqueta tono={s.es_con_goce_haberes ? "exito" : "aviso"}>
          {s.es_con_goce_haberes ? "Con goce" : "Sin goce"}
        </Etiqueta>
      ),
    },
    {
      clave: "estado_nombre",
      titulo: "Estado",
      celda: (s) => <Etiqueta tono={TONO_ESTADO[s.estado_codigo] ?? "neutral"}>{s.estado_nombre}</Etiqueta>,
    },
    {
      clave: "adjuntos",
      titulo: "Respaldo",
      celda: (s) =>
        s.adjuntos.length === 0 ? (
          "—"
        ) : (
          <span className="licencias-adjuntos">
            {s.adjuntos.map((a) => (
              <Boton
                key={a.id_adjunto}
                variante="sutil"
                tamano="sm"
                icono={Download}
                aria-label={`Descargar ${a.nombre_original}`}
                onClick={() => onDescargar(s, a)}
              >
                {a.nombre_original}
              </Boton>
            ))}
          </span>
        ),
    },
  ];

  return (
    <Tarjeta titulo="Mis solicitudes" nivelTitulo={2} className="licencias-tarjeta">
      <Tabla
        descripcion="Solicitudes de licencia registradas"
        columnas={columnas}
        filas={solicitudes}
        claveFila="id_solicitud"
        cargando={cargando}
        vacio={
          <EstadoVacio
            icono={FileX}
            titulo="Aún no tiene solicitudes"
            mensaje="Las licencias que envíe aparecerán aquí con su estado."
          />
        }
      />
    </Tarjeta>
  );
}
