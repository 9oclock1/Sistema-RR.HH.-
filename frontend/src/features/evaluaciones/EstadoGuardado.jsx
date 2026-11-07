import { Check, CircleAlert, LoaderCircle, PencilLine } from "lucide-react";
import { Boton } from "../../components/ui";
import { formatearHora } from "../justificaciones/formato";

export default function EstadoGuardado({ estado, guardadoEn, onReintentar }) {
  const textos = {
    inactivo: { Icono: Check, texto: "Se guarda automáticamente" },
    pendiente: { Icono: PencilLine, texto: "Cambios sin guardar…" },
    guardando: { Icono: LoaderCircle, texto: "Guardando…" },
    guardado: { Icono: Check, texto: `Guardado a las ${guardadoEn ? formatearHora(guardadoEn) : "—"}` },
    error: { Icono: CircleAlert, texto: "No se pudo guardar" },
  };
  const { Icono, texto } = textos[estado] ?? textos.inactivo;

  return (
    <div className="ev-guardado">
      <p role="status" className={`ev-guardado__texto ev-guardado__texto--${estado}`}>
        <Icono className={`ds-icono ${estado === "guardando" ? "ev-giro" : ""}`} aria-hidden="true" />
        {texto}
      </p>
      {estado === "error" && (
        <Boton tamano="sm" onClick={onReintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  );
}
