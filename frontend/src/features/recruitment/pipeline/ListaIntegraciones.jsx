import { RotateCcw } from "lucide-react";
import { Boton, Etiqueta } from "../../../components/ui";
import { formatearFecha } from "./reglas";

const TONO_ESTADO = { PENDIENTE: "aviso", ENTREGADO: "exito", FALLIDO: "peligro" };
const NOMBRE_ESTADO = { PENDIENTE: "En curso", ENTREGADO: "Enviada", FALLIDO: "Fallida" };

// Estado del alta del colaborador en cada módulo del ERP; las fallidas se pueden reenviar.
export default function ListaIntegraciones({ integraciones, reintentando, onReintentar }) {
  return (
    <ul className="pl-lista">
      {integraciones.map((evento) => (
        <li key={evento.id_evento} className="pl-lista__item">
          <div className="pl-lista__fila">
            <strong>{evento.nombre_modulo}</strong>
            <Etiqueta tono={TONO_ESTADO[evento.estado]}>{NOMBRE_ESTADO[evento.estado] ?? evento.estado}</Etiqueta>
          </div>
          <p className="pl-sutil">
            {evento.estado === "ENTREGADO"
              ? `Enviada el ${formatearFecha(evento.entregado_en, { conHora: true })}`
              : evento.intentos === 0
                ? "En cola para enviarse."
                : `${evento.intentos} intento(s)${evento.ultimo_error ? ` · ${evento.ultimo_error}` : ""}`}
          </p>
          {evento.estado === "FALLIDO" && (
            <Boton
              tamano="sm"
              icono={RotateCcw}
              cargando={reintentando === evento.id_evento}
              onClick={() => onReintentar(evento)}
            >
              Reintentar envío
            </Boton>
          )}
        </li>
      ))}
    </ul>
  );
}
