import { solicitar } from "./cliente";

// Dashboard de rotación de personal (RF-75, KAN-95). Exige sesión real: quién consulta y su rol salen del JWT de la
// cookie de sesión, no de cabeceras.
export const obtenerTableroRotacion = (filtros = {}) => {
  const params = new URLSearchParams(Object.entries(filtros).filter(([, valor]) => valor !== "" && valor != null));
  const query = params.toString();
  return solicitar(`/comp/indicadores/rotacion${query ? `?${query}` : ""}`);
};
