import { useEffect, useState } from "react";
import { consultarJornada } from "../../api/marcajes";
import { leerEmpleado, olvidarEmpleado } from "./sesionEmpleado";

export const nombreDe = ({ empleado }) => `${empleado.nombres} ${empleado.apellidos}`.trim();

// Quien revisa en pantallas de supervisor: el empleado identificado en este navegador, verificado al entrar.
export default function useRevisor() {
  const [revisor, setRevisor] = useState(null);
  const [verificando, setVerificando] = useState(() => Boolean(leerEmpleado()));

  useEffect(() => {
    const id = leerEmpleado();
    if (!id) return;
    consultarJornada(id)
      .then((datos) => setRevisor({ id, nombre: nombreDe(datos) }))
      .catch(() => olvidarEmpleado())
      .finally(() => setVerificando(false));
  }, []);

  const cambiar = () => {
    olvidarEmpleado();
    setRevisor(null);
  };

  return { revisor, verificando, identificar: setRevisor, cambiar };
}
