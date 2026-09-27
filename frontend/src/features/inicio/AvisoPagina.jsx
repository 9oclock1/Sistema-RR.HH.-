import { Link } from "react-router";
import { House } from "lucide-react";
import { Boton, EncabezadoPagina, EstadoVacio, Tarjeta } from "../../components/ui";
import "./inicio.css";

// Página que solo explica por qué no hay contenido (sin acceso, no encontrada).
export default function AvisoPagina({ migas = [], titulo, descripcion, icono, aviso, mensaje }) {
  return (
    <div className="inicio">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, ...migas]}
        enlace={Link}
        titulo={titulo}
        descripcion={descripcion}
      />
      <Tarjeta>
        <EstadoVacio
          icono={icono}
          titulo={aviso}
          mensaje={mensaje}
          accion={
            <Boton as={Link} to="/" icono={House}>
              Ir al inicio
            </Boton>
          }
        />
      </Tarjeta>
    </div>
  );
}
