import "./utilidades.css";
import "./Avatar.css";

const COLORES = 6;

function iniciales(nombre = "") {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primera = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primera + ultima).toUpperCase();
}

function colorPara(nombre) {
  let suma = 0;
  for (const letra of nombre) suma = (suma + letra.codePointAt(0)) % 997;
  return (suma % COLORES) + 1;
}

// Con decorativo el nombre ya está escrito al lado y el lector de pantalla no lo repite.
export default function Avatar({ nombre, tamano = "md", decorativo = false, className = "" }) {
  return (
    <span
      className={`ds-avatar ds-avatar--${tamano} ds-avatar--color-${colorPara(nombre ?? "")} ${className}`}
      title={nombre}
      {...(decorativo ? { "aria-hidden": true } : { role: "img", "aria-label": nombre })}
    >
      {iniciales(nombre)}
    </span>
  );
}
