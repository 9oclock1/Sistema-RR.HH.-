import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { House, LogOut, Menu, Search } from "lucide-react";
import { obtenerSesion } from "../api/auth";
import { iniciarConsolaPubSub } from "../api/mensajesPublicados";
import { Boton, ElementoNavegacion, useAvisos } from "../components/ui";
import { abrirInicioSesion, fijarSesion, useFormularioSesion, useRol, useSesion } from "../context/sesion";
import { useEmpleados } from "../features/Asignaciones/hooks/useEmpleados";
import CampanaNotificaciones from "../features/notificaciones/CampanaNotificaciones";
import { RUTA_INICIO_SESION } from "../features/sesion/ruta";
import { useCerrarSesion } from "../features/sesion/useCerrarSesion";
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
  const rol = useRol();
  const sesion = useSesion();
  const formularioSesion = useFormularioSesion();
  const { salir: salirDeSesion, cerrando: cerrandoSesion } = useCerrarSesion();
  const empleados = useEmpleados();
  const avisar = useAvisos();

  const consulta = normalizar(busqueda.trim());
  const secciones = filtrarSecciones(seccionesPara(rol), consulta);
  const resultados = secciones.flatMap((seccion) => seccion.modulos);
  const menuVisible = escritorio ? !plegado : abiertoMovil;
  const lateralVisible = menuVisible || Boolean(consulta);
  const superpuesto = !escritorio && lateralVisible;

  useEffect(() => {
    iniciarConsolaPubSub();
  }, []);

  // El portal exige sesión (cookie de AuthService): sin ella se va a la pantalla de inicio de sesión. El rol y el
  // usuario son siempre los de la cuenta.
  useEffect(() => {
    obtenerSesion()
      .then(({ usuario: activo }) => fijarSesion(activo))
      .catch(() => fijarSesion(null));
  }, []);

  // AC1: mientras haya sesión abierta, valida cada 60 s y al volver el foco si fue revocada.
  useEffect(() => {
    if (!sesion) return undefined;
    let vigente = true;
    const verificarVigencia = () => {
      obtenerSesion()
        .then(({ usuario }) => {
          if (!vigente || usuario) return;
          vigente = false;
          fijarSesion(null);
          avisar({
            tono: "aviso",
            titulo: "Sesión finalizada",
            mensaje: "Su sesión terminó. Si fue desvinculado, su acceso al ERP fue revocado.",
          });
        })
        .catch(() => {});
    };
    const alCambiarVisibilidad = () => {
      if (!document.hidden) verificarVigencia();
    };
    const id = setInterval(verificarVigencia, 60000);
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      vigente = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [sesion, avisar]);

  // Las páginas que piden el inicio con abrirInicioSesion() llevan a la pantalla de inicio de sesión.
  useEffect(() => {
    if (!formularioSesion) return;
    abrirInicioSesion(false);
    navegar(RUTA_INICIO_SESION);
  }, [formularioSesion, navegar]);

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

  const nombreSesion =
    sesion && ((empleados.empleados ?? []).find((e) => e.id_empleado === sesion.id_empleado)?.nombre_completo ?? sesion.correo);

  const alPresionarEnBusqueda = (evento) => {
    if (evento.key === "Enter" && resultados.length > 0) {
      evento.preventDefault();
      navegar(resultados[0].ruta);
      cerrarSuperpuesto();
    }
    if (evento.key === "Escape") setBusqueda("");
  };

  // Mientras se consulta la sesión no se muestra el portal; sin sesión, a la pantalla de inicio de sesión.
  if (sesion === undefined) {
    return (
      <p className="app-verificando" role="status">
        Verificando la sesión…
      </p>
    );
  }
  if (sesion === null) {
    return <Navigate to={RUTA_INICIO_SESION} replace />;
  }

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
          <div className="app-sesion">
            <p className="app-sesion__texto">
              Sesión de <strong>{nombreSesion}</strong>.
              <br />
              Rol: <strong>{ROLES[sesion.rol]?.nombre ?? sesion.rol}</strong>
            </p>
            <Boton icono={LogOut} onClick={salirDeSesion} cargando={cerrandoSesion} className="app-sesion__boton">
              Cerrar sesión
            </Boton>
          </div>
        </div>
      </aside>

      {superpuesto && <div className="app-velo" aria-hidden="true" onClick={cerrarSuperpuesto} />}

      <main id="contenido" ref={refContenido} tabIndex={-1} className="app-contenido" inert={superpuesto}>
        <Outlet />
      </main>
    </div>
  );
}
