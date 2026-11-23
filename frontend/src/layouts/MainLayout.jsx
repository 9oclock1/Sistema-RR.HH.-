import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { House, Menu, Search } from "lucide-react";
import { cerrarSesion, obtenerSesion } from "../api/auth";
import { iniciarConsolaPubSub } from "../api/mensajesPublicados";
import { Boton, Casilla, ElementoNavegacion, Selector, useAvisos } from "../components/ui";
import {
  abrirInicioSesion,
  cambiarRol,
  cambiarUsuario,
  fijarSesion,
  useFormularioSesion,
  useRol,
  useSesion,
  useUsuario,
} from "../context/sesion";
import { useEmpleados } from "../features/Asignaciones/hooks/useEmpleados";
import CampanaNotificaciones from "../features/notificaciones/CampanaNotificaciones";
import DialogoInicioSesion from "../features/sesion/DialogoInicioSesion";
import { seccionesPara } from "../router/modulos";
import { ROLES } from "../utils/permisos";
import "./MainLayout.css";

const CONSULTA_ESCRITORIO = "(min-width: 1024px)";
const CLAVE_PLEGADO = "rrhh.lateralPlegado";

function suscribirEscritorio(avisar) {
  const consulta = window.matchMedia(CONSULTA_ESCRITORIO);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}

const esEscritorio = () => window.matchMedia(CONSULTA_ESCRITORIO).matches;

function leerPlegado() {
  try {
    return localStorage.getItem(CLAVE_PLEGADO) === "1";
  } catch {
    return false;
  }
}

function guardarPlegado(plegado) {
  try {
    localStorage.setItem(CLAVE_PLEGADO, plegado ? "1" : "0");
  } catch {
    // Sin almacenamiento: la preferencia dura solo esta visita.
  }
}

const normalizar = (texto) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const OPCIONES_ROL = Object.entries(ROLES).map(([valor, rol]) => ({ valor, etiqueta: rol.nombre }));

function filtrarSecciones(secciones, consulta) {
  if (!consulta) return secciones;
  return secciones
    .map((seccion) => ({
      ...seccion,
      modulos: seccion.modulos.filter(
        (modulo) => normalizar(modulo.etiqueta).includes(consulta) || normalizar(seccion.titulo).includes(consulta),
      ),
    }))
    .filter((seccion) => seccion.modulos.length > 0);
}

export default function MainLayout() {
  const escritorio = useSyncExternalStore(suscribirEscritorio, esEscritorio);
  const [plegado, setPlegado] = useState(leerPlegado);
  const [abiertoMovil, setAbiertoMovil] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const refContenido = useRef(null);
  const { pathname } = useLocation();
  const rutaAnterior = useRef(pathname);
  const navegar = useNavigate();
  const avisar = useAvisos();
  const rol = useRol();
  const usuario = useUsuario();
  const sesion = useSesion();
  const formularioSesion = useFormularioSesion();
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const empleados = useEmpleados();

  const consulta = normalizar(busqueda.trim());
  const secciones = filtrarSecciones(seccionesPara(rol), consulta);
  const resultados = secciones.flatMap((seccion) => seccion.modulos);
  const menuVisible = escritorio ? !plegado : abiertoMovil;
  const lateralVisible = menuVisible || Boolean(consulta);
  const superpuesto = !escritorio && lateralVisible;

  useEffect(() => {
    iniciarConsolaPubSub();
  }, []);

  // Sesión real ya abierta (cookie de AuthService); sin ella el portal sigue con el usuario y el rol de prueba.
  useEffect(() => {
    obtenerSesion()
      .then(({ usuario: activo }) => fijarSesion(activo))
      .catch(() => fijarSesion(null));
  }, []);

  // Al cambiar de página, el foco pasa al contenido para los lectores de pantalla.
  useEffect(() => {
    if (rutaAnterior.current === pathname) return;
    rutaAnterior.current = pathname;
    refContenido.current?.focus();
  }, [pathname]);

  useEffect(() => {
    if (!superpuesto) return;
    const alPresionar = (evento) => {
      if (evento.key !== "Escape") return;
      setAbiertoMovil(false);
      setBusqueda("");
    };
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [superpuesto]);

  const alternarMenu = () => {
    if (!escritorio) {
      setAbiertoMovil((abierto) => !abierto);
      return;
    }
    const nuevo = !plegado;
    setPlegado(nuevo);
    guardarPlegado(nuevo);
  };

  const cerrarSuperpuesto = () => {
    setAbiertoMovil(false);
    setBusqueda("");
  };

  const alCambiarRol = (evento) => {
    const nuevo = evento.target.value;
    cambiarRol(nuevo);
    avisar({ tono: "info", titulo: "Rol de prueba cambiado", mensaje: ROLES[nuevo].nombre });
  };

  const alCambiarUsuario = (evento) => {
    const nuevo = evento.target.value;
    cambiarUsuario(nuevo);
    const nombre = empleados.empleados.find((e) => e.id_empleado === nuevo)?.nombre_completo;
    avisar({ tono: "info", titulo: "Usuario de prueba cambiado", mensaje: nombre ?? "Sin usuario" });
  };

  const alternarSesion = async (evento) => {
    if (evento.target.checked) {
      abrirInicioSesion();
      return;
    }
    setCerrandoSesion(true);
    try {
      await cerrarSesion();
      fijarSesion(null);
      avisar({ tono: "info", titulo: "Sesión cerrada", mensaje: "Vuelve el usuario y el rol de prueba." });
    } catch (error) {
      avisar({ tono: "peligro", titulo: "No se pudo cerrar la sesión", mensaje: error.message });
    } finally {
      setCerrandoSesion(false);
    }
  };

  const nombreSesion = sesion && (empleados.empleados.find((e) => e.id_empleado === sesion.id_empleado)?.nombre_completo ?? sesion.correo);

  const alPresionarEnBusqueda = (evento) => {
    if (evento.key === "Enter" && resultados.length > 0) {
      evento.preventDefault();
      navegar(resultados[0].ruta);
      cerrarSuperpuesto();
    }
    if (evento.key === "Escape") setBusqueda("");
  };

  return (
    <div className={`app ${lateralVisible ? "app--lateral-visible" : ""}`}>
      <a href="#contenido" className="app-saltar ds-foco">
        Saltar al contenido
      </a>

      <header className="app-barra">
        <Boton
          variante="sutil"
          soloIcono
          icono={Menu}
          aria-label={menuVisible ? "Ocultar menú" : "Mostrar menú"}
          aria-expanded={menuVisible}
          aria-controls="app-lateral"
          onClick={alternarMenu}
        />
        <Link to="/" className="app-barra__nombre ds-foco">
          Sistema RR.HH.
        </Link>
        <div className="app-barra__busqueda" role="search">
          <Search className="ds-icono app-barra__lupa" aria-hidden="true" />
          <input
            type="search"
            className="ds-control"
            placeholder="Buscar módulo"
            aria-label="Buscar módulo"
            aria-controls="app-lateral"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            onKeyDown={alPresionarEnBusqueda}
          />
        </div>
        <CampanaNotificaciones />
      </header>

      <aside id="app-lateral" className="app-lateral" aria-label="Barra lateral">
        <nav className="app-lateral__nav" aria-label="Módulos">
          {!consulta && (
            <ElementoNavegacion as={NavLink} to="/" end icono={House} etiqueta="Inicio" onClick={cerrarSuperpuesto} />
          )}
          {secciones.map((seccion) => (
            <div key={seccion.titulo} className="app-lateral__seccion">
              <p className="app-lateral__titulo" id={`nav-${seccion.titulo}`}>
                {seccion.titulo}
              </p>
              <ul className="app-lateral__lista" aria-labelledby={`nav-${seccion.titulo}`}>
                {seccion.modulos.map((modulo) => (
                  <li key={modulo.ruta}>
                    <ElementoNavegacion
                      as={NavLink}
                      to={modulo.ruta}
                      icono={modulo.icono}
                      etiqueta={modulo.etiqueta}
                      onClick={cerrarSuperpuesto}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {consulta && resultados.length === 0 && (
            <p className="app-lateral__vacio">Ningún módulo coincide con «{busqueda.trim()}».</p>
          )}
          <p className="ds-solo-lector" role="status">
            {consulta ? `${resultados.length} ${resultados.length === 1 ? "módulo encontrado" : "módulos encontrados"}` : ""}
          </p>
        </nav>

        <div className="app-lateral__pie">
          <Casilla
            role="switch"
            etiqueta="Inicio de sesión real"
            ayuda={
              sesion
                ? `Sesión de ${nombreSesion} (${ROLES[sesion.rol]?.nombre ?? sesion.rol}). Desactívela para volver al usuario de prueba.`
                : "Necesario para Mis boletas de pago y Rotación de personal. El resto funciona con el usuario de prueba."
            }
            checked={Boolean(sesion)}
            onChange={alternarSesion}
            disabled={sesion === undefined || cerrandoSesion}
          />
          <Selector etiqueta="Rol de prueba" opciones={OPCIONES_ROL} value={rol} onChange={alCambiarRol} disabled={Boolean(sesion)} />
          <Selector
            etiqueta="Usuario de prueba"
            ayuda={
              sesion
                ? "Fijados por la sesión iniciada."
                : "Temporal hasta contar con inicio de sesión. Queda como autor de los registros."
            }
            value={usuario ?? ""}
            onChange={alCambiarUsuario}
            disabled={empleados.cargando || Boolean(empleados.error) || Boolean(sesion)}
            textoVacio={empleados.cargando ? "Cargando…" : "Sin usuario"}
            opciones={empleados.empleados.map((e) => ({ valor: e.id_empleado, etiqueta: e.nombre_completo }))}
            error={empleados.error ? "No se pudieron cargar los empleados." : undefined}
          />
        </div>
      </aside>

      {superpuesto && <div className="app-velo" aria-hidden="true" onClick={cerrarSuperpuesto} />}

      <DialogoInicioSesion abierto={formularioSesion} onCerrar={() => abrirInicioSesion(false)} />

      <main id="contenido" ref={refContenido} tabIndex={-1} className="app-contenido" inert={superpuesto}>
        <Outlet />
      </main>
    </div>
  );
}
