import { History } from "lucide-react";
import { EstadoVacio, Etiqueta, Tabla, Tarjeta } from "../../components/ui";
import { armarHistorial, CONCEPTOS, formatearDias, formatearFecha } from "./formato";

const COLUMNAS = [
  { clave: "fecha", titulo: "Fecha", celda: (h) => formatearFecha(h.fecha) },
  {
    clave: "concepto",
    titulo: "Concepto",
    celda: (h) => <Etiqueta tono={CONCEPTOS[h.concepto]?.tono ?? "neutral"}>{CONCEPTOS[h.concepto]?.etiqueta ?? h.concepto}</Etiqueta>,
  },
  { clave: "detalle", titulo: "Detalle" },
  {
    clave: "dias",
    titulo: "Días",
    alinear: "fin",
    celda: (h) => <span aria-label={formatearDias(h.dias)}>{h.dias > 0 ? `+${h.dias}` : `−${Math.abs(h.dias)}`}</span>,
  },
];

// Criterio 4: períodos ganados y consumidos en orden cronológico.
export default function HistorialVacaciones({ saldo, cargando }) {
  const filas = saldo ? armarHistorial(saldo) : [];
  return (
    <Tarjeta titulo="Historial de períodos" nivelTitulo={2} className="vacaciones-tarjeta">
      <Tabla
        descripcion="Períodos de vacaciones ganados y consumidos"
        columnas={COLUMNAS}
        filas={filas}
        claveFila="id"
        cargando={cargando}
        vacio={
          <EstadoVacio
            icono={History}
            titulo="Sin períodos todavía"
            mensaje="El primer período se acredita al cumplir un año de servicio."
          />
        }
      />
    </Tarjeta>
  );
}
