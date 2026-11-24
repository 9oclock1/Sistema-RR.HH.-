import { useState } from "react";
import { cerrarSesion } from "../../api/auth";
import { useAvisos } from "../../components/ui";
import { fijarSesion } from "../../context/sesion";

// Cierra la sesión real: vuelven el usuario y el rol de prueba.
export function useCerrarSesion() {
  const avisar = useAvisos();
  const [cerrando, setCerrando] = useState(false);

  const salir = async () => {
    setCerrando(true);
    try {
      await cerrarSesion();
      fijarSesion(null);
      avisar({ tono: "info", titulo: "Sesión cerrada", mensaje: "Vuelve el usuario y el rol de prueba." });
    } catch (error) {
      avisar({ tono: "peligro", titulo: "No se pudo cerrar la sesión", mensaje: error.message });
    } finally {
      setCerrando(false);
    }
  };

  return { salir, cerrando };
}
