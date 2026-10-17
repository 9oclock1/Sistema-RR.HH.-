import { useState } from "react";
import { UserRoundCheck } from "lucide-react";
import { consultarJornada } from "../../api/marcajes";
import { Boton } from "../../components/ui";
import IdentificacionEmpleado from "./IdentificacionEmpleado";
import { guardarEmpleado } from "./sesionEmpleado";
import { nombreDe } from "./useRevisor";

// Muestra al revisor identificado o pide su identificador de empleado.
export default function Revisor({ revisor, etiqueta = "Revisa", onIdentificado, onCambiar }) {
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(false);

  if (revisor) {
    return (
      <p className="marcaje-revisor">
        <UserRoundCheck className="ds-icono" aria-hidden="true" />
        <span>
          {etiqueta}: <strong>{revisor.nombre}</strong>
        </span>
        <Boton variante="sutil" tamano="sm" onClick={onCambiar}>
          Cambiar
        </Boton>
      </p>
    );
  }

  const identificar = (id) => {
    setProcesando(true);
    setError(null);
    consultarJornada(id)
      .then((datos) => {
        guardarEmpleado(id);
        onIdentificado({ id, nombre: nombreDe(datos) });
      })
      .catch((e) => setError(e.message))
      .finally(() => setProcesando(false));
  };

  return (
    <IdentificacionEmpleado
      error={error}
      procesando={procesando}
      onIdentificar={identificar}
      onEditar={() => setError(null)}
    />
  );
}
