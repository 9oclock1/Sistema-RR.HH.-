import { Plus, Users } from "lucide-react";
import { Avatar, Boton, EstadoVacio, Etiqueta, Tabla, TextoTruncado } from "../../components/ui";

function mapearTonoEtapa(etapa = "") {
  const normalizada = etapa.toUpperCase();
  if (normalizada.includes("CONTRATADO")) return "exito";
  if (normalizada.includes("RECHAZADO") || normalizada.includes("NO SELECCIONADO")) return "peligro";
  if (normalizada.includes("FINALISTA") || normalizada.includes("OFERTA")) return "morado";
  if (normalizada.includes("ENTREVISTA") || normalizada.includes("EVALUACI")) return "aviso";
  if (normalizada.includes("REVISION")) return "info";
  return "neutral";
}

function formatearFechaPostulacion(fechaIso) {
  if (!fechaIso) return "—";
  try {
    const fecha = new Date(fechaIso);
    return new Intl.DateTimeFormat("es-BO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(fecha);
  } catch {
    return String(fechaIso);
  }
}

const COLUMNAS = [
  {
    clave: "indice",
    titulo: "#",
    ancho: "44px",
    celda: (fila, index) => <span className="ds-tabla__indice">{index + 1}</span>,
  },
  {
    clave: "numero_documento",
    titulo: "Documento",
    ancho: "110px",
    celda: (fila) => <code className="postulante-documento">{fila.numero_documento}</code>,
  },
  {
    clave: "nombre_completo",
    titulo: "Postulante",
    ancho: "180px",
    celda: (fila) => {
      const nombreCompleto = `${fila.nombres ?? ""} ${fila.apellidos ?? ""}`.trim();
      return (
        <div className="postulante-fila-nombre">
          <Avatar nombre={nombreCompleto} tamano="md" decorativo />
          <TextoTruncado>{nombreCompleto}</TextoTruncado>
        </div>
      );
    },
  },
  {
    clave: "correo_electronico",
    titulo: "Correo electrónico",
    ancho: "190px",
    celda: (fila) => <TextoTruncado>{fila.correo_electronico}</TextoTruncado>,
  },
  {
    clave: "telefono_contacto",
    titulo: "Teléfono",
    ancho: "110px",
    celda: (fila) => fila.telefono_contacto || "—",
  },
  {
    clave: "ciudad",
    titulo: "Ciudad",
    ancho: "90px",
    celda: (fila) => fila.ciudad || "—",
  },
  {
    clave: "nombre_etapa",
    titulo: "Etapa",
    ancho: "120px",
    celda: (fila) => {
      const etapa = fila.nombre_etapa || fila.etapa || "Postulado";
      return <Etiqueta tono={mapearTonoEtapa(etapa)}>{etapa}</Etiqueta>;
    },
  },
  {
    clave: "fecha_postulacion",
    titulo: "Fecha postulación",
    ancho: "140px",
    celda: (fila) => (
      <span className="postulante-fecha">
        {formatearFechaPostulacion(fila.fecha_postulacion)}
      </span>
    ),
  },
];

/**
 * Componente ApplicantList
 * Muestra la tabla de postulantes registrados en una convocatoria usando Tabla y Avatar del DS.
 */
export default function ApplicantList({
  applicants = [],
  loading = false,
  openingTitle = "",
  onRegistrarPrimerPostulante,
}) {
  // Enriquecer filas con índice para la celda de índice
  const filasConIndice = applicants.map((postulante, idx) => ({
    ...postulante,
    _idx: idx,
  }));

  const columnasConIndice = COLUMNAS.map((col) => {
    if (col.clave === "indice") {
      return {
        ...col,
        celda: (fila) => <span className="ds-tabla__indice">{fila._idx + 1}</span>,
      };
    }
    return col;
  });

  return (
    <Tabla
      className="postulantes-tabla"
      descripcion={`Postulantes para ${openingTitle || "convocatoria"}`}
      columnas={columnasConIndice}
      filas={filasConIndice}
      claveFila="id_postulacion"
      cargando={loading}
      filasCargando={4}
      vacio={
        <EstadoVacio
          icono={Users}
          titulo="Sin postulantes registrados"
          mensaje={
            openingTitle
              ? `Aún no se han registrado postulantes para la convocatoria «${openingTitle}».`
              : "Seleccione una convocatoria para ver sus postulantes."
          }
          accion={
            onRegistrarPrimerPostulante && openingTitle ? (
              <Boton variante="primario" icono={Plus} onClick={onRegistrarPrimerPostulante}>
                Registrar primer postulante
              </Boton>
            ) : undefined
          }
        />
      }
    />
  );
}

