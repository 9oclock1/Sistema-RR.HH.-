import { Link } from "react-router";
import { Contador, EncabezadoPagina, EstadoVacio, Tarjeta } from "../../components/ui";
import { useRol } from "../../context/sesion";
import { seccionesPara } from "../../router/modulos";
import { ROLES } from "../../utils/permisos";
import "./inicio.css";

const ZONA_BOLIVIA = "America/La_Paz";
const horaBolivia = new Intl.DateTimeFormat("es-BO", { timeZone: ZONA_BOLIVIA, hour: "numeric", hourCycle: "h23" });
const fechaBolivia = new Intl.DateTimeFormat("es-BO", {
  timeZone: ZONA_BOLIVIA,
  weekday: "long",
  day: "numeric",
  month: "long",
});

function saludo(ahora) {
  const hora = Number(horaBolivia.format(ahora));
  if (hora >= 5 && hora < 12) return "Buenos días";
  if (hora >= 12 && hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

function fechaHoy(ahora) {
  const fecha = fechaBolivia.format(ahora);
  return fecha.charAt(0).toUpperCase() + fecha.slice(1);
}

const idSeccion =(titulo) => `inicio-${titulo.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()}`;

function AccesoModulo({ modulo }) {
  const { icono: Icono } = modulo;
  return (
    <li>
      <Tarjeta as={Link} to={modulo.ruta} className="inicio-modulo">
        <span className="inicio-modulo__icono" aria-hidden="true">
          <Icono className="ds-icono" />
        </span>
        <div className="inicio-modulo__texto">
          <h3 className="inicio-modulo__nombre">{modulo.etiqueta}</h3>
          <p className="inicio-modulo__descripcion">{modulo.descripcion}</p>
        </div>
      </Tarjeta>
    </li>
  );
}

export default function InicioPage() {
  const rol = useRol();
  const secciones = seccionesPara(rol);
  const ahora = new Date();

  return (
    <div className="inicio">
      <EncabezadoPagina
        titulo={saludo(ahora)}
        descripcion={`${fechaHoy(ahora)}. Estos son los módulos disponibles para su rol, ${ROLES[rol].nombre}.`}
      />

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
