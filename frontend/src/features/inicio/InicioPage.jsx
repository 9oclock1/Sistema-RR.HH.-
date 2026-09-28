import { Link } from "react-router";
import { Contador, EncabezadoPagina, EstadoVacio, Tarjeta } from "../../components/ui";
import { useRol } from "../../context/sesion";
import { seccionesPara } from "../../router/modulos";
import { ROLES } from "../../utils/permisos";
import "./inicio.css";

const idSeccion = (titulo) => `inicio-${titulo.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()}`;

function AccesoModulo({ modulo }) {
  const { icono: Icono } = modulo;
  return (
    <li>
      <Link to={modulo.ruta} className="inicio-modulo ds-foco">
        <span className="inicio-modulo__icono" aria-hidden="true">
          <Icono className="ds-icono" />
        </span>
        <div className="inicio-modulo__texto">
          <h3 className="inicio-modulo__nombre">{modulo.etiqueta}</h3>
          <p className="inicio-modulo__descripcion">{modulo.descripcion}</p>
        </div>
      </Link>
    </li>
  );
}

export default function InicioPage() {
  const rol = useRol();
  const secciones = seccionesPara(rol);

  return (
    <div className="inicio">
      <EncabezadoPagina titulo="Inicio" descripcion={`Módulos disponibles para el rol ${ROLES[rol].nombre}.`} />

      {secciones.length === 0 && (
        <Tarjeta>
          <EstadoVacio titulo="Sin módulos disponibles" mensaje="Su rol todavía no tiene acceso a ningún módulo." />
        </Tarjeta>
      )}

      {secciones.map((seccion) => (
        <section key={seccion.titulo} className="inicio-seccion" aria-labelledby={idSeccion(seccion.titulo)}>
          <div className="inicio-seccion__encabezado">
            <h2 className="inicio-seccion__titulo" id={idSeccion(seccion.titulo)}>
              {seccion.titulo}
            </h2>
            <Contador aria-hidden="true">{seccion.modulos.length}</Contador>
          </div>
          <ul className="inicio-modulos">
            {seccion.modulos.map((modulo) => (
              <AccesoModulo key={modulo.ruta} modulo={modulo} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
