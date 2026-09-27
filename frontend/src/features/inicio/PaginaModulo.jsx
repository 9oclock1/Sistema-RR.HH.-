import { Lock } from "lucide-react";
import { useRol } from "../../context/sesion";
import { puedeAcceder, ROLES } from "../../utils/permisos";
import AvisoPagina from "./AvisoPagina";

// Muestra la pantalla del módulo solo si el rol tiene acceso.
export default function PaginaModulo({ seccion, modulo }) {
  const rol = useRol();
  const { pagina: Pagina } = modulo;

  if (!puedeAcceder(rol, modulo.roles)) {
    return (
      <AvisoPagina
        migas={[{ etiqueta: seccion }]}
        titulo={modulo.etiqueta}
        descripcion={modulo.descripcion}
        icono={Lock}
        aviso="Acceso restringido"
        mensaje={`El rol ${ROLES[rol].nombre} no tiene permiso para usar este módulo.`}
      />
    );
  }

  return <Pagina />;
}
