import { createContext, useContext } from "react";

export const ContextoAvisos = createContext(null);

// Uso: const avisar = useAvisos(); avisar({ tono: "exito", titulo: "Turno guardado" });
export function useAvisos() {
  const avisar = useContext(ContextoAvisos);
  if (!avisar) throw new Error("useAvisos debe usarse dentro de ProveedorAvisos");
  return avisar;
}
