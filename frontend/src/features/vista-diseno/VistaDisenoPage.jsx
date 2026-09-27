import { useEffect, useState } from "react";
import {
  Bell,
  Briefcase,
  ArrowLeft,
  Download,
  LoaderCircle,
  Menu,
  MessageSquareWarning,
  MousePointerClick,
  Palette,
  PanelsTopLeft,
  Pencil,
  Plus,
  Ruler,
  Search,
  SquareStack,
  Table as IconoTabla,
  Tags,
  TextCursorInput,
  Trash2,
  Type,
  Users,
  X,
} from "lucide-react";
import {
  Alerta,
  Avatar,
  Boton,
  CampoTexto,
  Casilla,
  Contador,
  ElementoNavegacion,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  Modal,
  ModalConfirmacion,
  Pestanas,
  Selector,
  Tabla,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import "./vista-diseno.css";

const SECCIONES = [
  { id: "colores", etiqueta: "Colores", icono: Palette },
  { id: "tipografia", etiqueta: "Tipografía", icono: Type },
  { id: "espaciado", etiqueta: "Espaciado y radios", icono: Ruler },
  { id: "botones", etiqueta: "Botones", icono: MousePointerClick },
  { id: "formularios", etiqueta: "Formularios", icono: TextCursorInput },
  { id: "tarjetas", etiqueta: "Tarjetas", icono: SquareStack },
  { id: "etiquetas", etiqueta: "Etiquetas y avatares", icono: Tags },
  { id: "tabla", etiqueta: "Tabla", icono: IconoTabla },
  { id: "navegacion", etiqueta: "Pestañas y navegación", icono: PanelsTopLeft },
  { id: "carga", etiqueta: "Carga y vacío", icono: LoaderCircle },
  { id: "alertas", etiqueta: "Alertas en línea", icono: MessageSquareWarning },
  { id: "superposiciones", etiqueta: "Modales y avisos", icono: Bell },
];

const COLORES = [
  {
    grupo: "Acción principal",
    tokens: ["--color-primary", "--color-primary-hover", "--color-primary-pressed", "--color-on-primary"],
  },
  {
    grupo: "Texto",
    tokens: ["--color-text", "--color-text-secondary", "--color-text-subtle", "--color-text-selected"],
  },
  {
    grupo: "Fondos",
    tokens: [
      "--color-bg-surface",
      "--color-bg-page",
      "--color-bg-hover",
      "--color-bg-pressed",
      "--color-bg-neutral",
      "--color-bg-selected",
    ],
  },
  { grupo: "Bordes", tokens: ["--color-border", "--color-border-hover", "--color-border-input", "--color-border-focus"] },
  {
    grupo: "Estados",
    tokens: [
      "--color-success",
      "--color-success-text",
      "--color-warning",
      "--color-warning-text",
      "--color-danger",
      "--color-danger-text",
      "--color-info",
      "--color-info-text",
      "--color-purple",
      "--color-purple-text",
    ],
  },
  {
    grupo: "Avatares",
    tokens: [
      "--color-avatar-1",
      "--color-avatar-2",
      "--color-avatar-3",
      "--color-avatar-4",
      "--color-avatar-5",
      "--color-avatar-6",
    ],
  },
];

const TIPOGRAFIA = [
  { clase: "vd-tipo-titulo", nombre: "Título de página", detalle: "24px / 600", texto: "Configuración de turnos" },
  { clase: "vd-tipo-seccion", nombre: "Sección", detalle: "16px / 600", texto: "Tolerancias y refrigerios" },
  { clase: "vd-tipo-cuerpo", nombre: "Cuerpo", detalle: "14px / 20px", texto: "El empleado marcó su entrada a las 08:02." },
  { clase: "vd-tipo-pequeno", nombre: "Meta", detalle: "12px / 16px", texto: "Actualizado hace 5 minutos" },
];

const ESPACIOS = ["--space-1", "--space-2", "--space-3", "--space-4", "--space-6", "--space-8"];
const RADIOS = ["--radius-control", "--radius-nav", "--radius-card", "--radius-round"];

const EMPLEADOS = [
  { id: 1, nombre: "Ana Quispe Mamani", cargo: "Cajera", sucursal: "Sucursal Centro", estado: "activo", horas: "8,0" },
  { id: 2, nombre: "Luis Fernández Rojas", cargo: "Reponedor", sucursal: "Sucursal Sur", estado: "activo", horas: "7,5" },
  {
    id: 3,
    nombre: "Carla Gutiérrez de la Fuente Arancibia",
    cargo: "Encargada de recursos humanos y relaciones laborales",
    sucursal: "Oficina central",
    estado: "inactivo",
    horas: "0,0",
  },
  { id: 4, nombre: "Jorge Mendoza", cargo: "Guardia", sucursal: "Sucursal Norte", estado: "pendiente", horas: "12,0" },
];

const ESTADOS = {
  activo: { tono: "exito", texto: "Activo" },
  inactivo: { tono: "neutral", texto: "Inactivo" },
  pendiente: { tono: "aviso", texto: "Pendiente" },
};

const COLUMNAS = [
  {
    clave: "nombre",
    titulo: "Empleado",
    ancho: "34%",
    celda: (fila) => (
      <span className="vd-celda-empleado">
        <Avatar nombre={fila.nombre} decorativo />
        <span className="ds-truncar" title={fila.nombre}>
          {fila.nombre}
        </span>
      </span>
    ),
  },
  { clave: "cargo", titulo: "Cargo", ancho: "26%" },
  { clave: "sucursal", titulo: "Sucursal", ancho: "18%" },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "12%",
    celda: (fila) => <Etiqueta tono={ESTADOS[fila.estado].tono}>{ESTADOS[fila.estado].texto}</Etiqueta>,
  },
  { clave: "horas", titulo: "Horas", ancho: "10%", alinear: "fin" },
];

function valorToken(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

function Seccion({ id, titulo, descripcion, children }) {
  return (
    <section id={id} className="vd-seccion" aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className="vd-seccion__titulo">
        {titulo}
      </h2>
      {descripcion && <p className="vd-seccion__descripcion">{descripcion}</p>}
      {children}
    </section>
  );
}

function Muestra({ token, valores }) {
  return (
    <li className="vd-muestra">
      <span className="vd-muestra__color" style={{ background: `var(${token})` }} />
      <code className="vd-muestra__nombre">{token}</code>
      <span className="vd-muestra__valor">{valores[token]}</span>
    </li>
  );
}

export default function VistaDisenoPage() {
  const avisar = useAvisos();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [seccionActiva, setSeccionActiva] = useState(SECCIONES[0].id);
  const [valores, setValores] = useState({});
  const [cargandoTabla, setCargandoTabla] = useState(false);
  const [tablaVacia, setTablaVacia] = useState(false);
  const [pestana, setPestana] = useState("vigentes");
  const [tarjetaSeleccionada, setTarjetaSeleccionada] = useState("manana");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [confirmacionAbierta, setConfirmacionAbierta] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const leer = () => {
      const todos = [...COLORES.flatMap((grupo) => grupo.tokens), ...ESPACIOS, ...RADIOS];
      setValores(Object.fromEntries(todos.map((token) => [token, valorToken(token)])));
    };
    leer();
    const tema = window.matchMedia("(prefers-color-scheme: dark)");
    tema.addEventListener("change", leer);
    return () => tema.removeEventListener("change", leer);
  }, []);

  const irA = (id) => {
    setSeccionActiva(id);
    setMenuAbierto(false);
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };

  const simularGuardado = () => {
    setGuardando(true);
    setTimeout(() => {
      setGuardando(false);
      avisar({ tono: "exito", titulo: "Cambios guardados", mensaje: "El turno se actualizó correctamente." });
    }, 1200);
  };

  const confirmarEliminacion = () => {
    setEliminando(true);
    setTimeout(() => {
      setEliminando(false);
      setConfirmacionAbierta(false);
      avisar({ tono: "exito", titulo: "Turno eliminado" });
    }, 1000);
  };

  return (
    <div className={`vd ${menuAbierto ? "vd--menu-abierto" : ""}`}>
      <header className="vd-barra">
        <Boton
          variante="sutil"
          soloIcono
          icono={menuAbierto ? X : Menu}
          aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuAbierto}
          aria-controls="vd-lateral"
          className="vd-barra__menu"
          onClick={() => setMenuAbierto((abierto) => !abierto)}
        />
        <span className="vd-barra__nombre">Sistema RR.HH.</span>
        <div className="vd-barra__busqueda">
          <Search className="ds-icono vd-barra__lupa" aria-hidden="true" />
          <input type="search" className="ds-control" placeholder="Buscar" aria-label="Buscar" />
        </div>
        <div className="vd-barra__acciones">
          <Boton variante="sutil" soloIcono icono={Bell} aria-label="Notificaciones" />
          <Avatar nombre="Usuario de prueba" />
        </div>
      </header>

      <nav id="vd-lateral" className="vd-lateral" aria-label="Secciones de la vista previa">
        <p className="vd-lateral__grupo">Sistema de diseño</p>
        <ul className="vd-lateral__lista">
          {SECCIONES.map((seccion) => (
            <li key={seccion.id}>
              <ElementoNavegacion
                icono={seccion.icono}
                etiqueta={seccion.etiqueta}
                activo={seccionActiva === seccion.id}
                onClick={() => irA(seccion.id)}
              />
            </li>
          ))}
        </ul>
      </nav>
      <div className="vd-velo" aria-hidden="true" onClick={() => setMenuAbierto(false)} />

      <main className="vd-contenido">
        <EncabezadoPagina
          migas={[{ etiqueta: "Sistema RR.HH.", href: "/" }]}
          titulo="Vista previa del sistema de diseño"
          descripcion={
            <>
              Todos los componentes y tokens de <code>DESIGN.md</code>. El tema claro u oscuro sigue la configuración
              del sistema operativo.
            </>
          }
          acciones={
            <Boton variante="predeterminado" icono={ArrowLeft} href="/">
              Volver al sistema
            </Boton>
          }
        />

        <Seccion id="colores" titulo="Colores" descripcion="Tokens semánticos. Los valores cambian con el tema.">
          {COLORES.map((grupo) => (
            <div key={grupo.grupo} className="vd-grupo">
              <h3 className="vd-grupo__titulo">{grupo.grupo}</h3>
              <ul className="vd-muestras">
                {grupo.tokens.map((token) => (
                  <Muestra key={token} token={token} valores={valores} />
                ))}
              </ul>
            </div>
          ))}
        </Seccion>

        <Seccion id="tipografia" titulo="Tipografía" descripcion="Inter, base de 14px. Ningún texto supera 24px.">
          <Tarjeta>
            <ul className="vd-tipos">
              {TIPOGRAFIA.map((tipo) => (
                <li key={tipo.clase} className="vd-tipo">
                  <span className="vd-tipo__meta">
                    {tipo.nombre} · {tipo.detalle}
                  </span>
                  <span className={tipo.clase}>{tipo.texto}</span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </Seccion>

        <Seccion id="espaciado" titulo="Espaciado y radios" descripcion="Grilla de 8px. Relleno del contenido: 24px.">
          <div className="vd-dos-columnas">
            <Tarjeta titulo="Espaciado">
              <ul className="vd-medidas">
                {ESPACIOS.map((token) => (
                  <li key={token} className="vd-medida">
                    <span className="vd-medida__barra" style={{ width: `var(${token})` }} />
                    <code>{token}</code>
                    <span className="vd-muestra__valor">{valores[token]}</span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
            <Tarjeta titulo="Radios y sombra">
              <ul className="vd-radios">
                {RADIOS.map((token) => (
                  <li key={token} className="vd-radio">
                    <span className="vd-radio__caja" style={{ borderRadius: `var(${token})` }} />
                    <code>{token}</code>
                  </li>
                ))}
                <li className="vd-radio">
                  <span className="vd-radio__caja vd-radio__caja--sombra" />
                  <code>--shadow-overlay</code>
                </li>
              </ul>
            </Tarjeta>
          </div>
        </Seccion>

        <Seccion
          id="botones"
          titulo="Botones"
          descripcion="Un solo botón primario por vista. Todos tienen hover, foco visible y deshabilitado."
        >
          <Tarjeta>
            <div className="vd-filas">
              <div className="vd-fila">
                <Boton variante="primario" icono={Plus}>
                  Nuevo turno
                </Boton>
                <Boton variante="predeterminado">Cancelar</Boton>
                <Boton variante="sutil" icono={Pencil}>
                  Editar
                </Boton>
                <Boton variante="peligro" icono={Trash2}>
                  Eliminar
                </Boton>
              </div>
              <div className="vd-fila">
                <Boton variante="primario" tamano="sm">
                  Pequeño
                </Boton>
                <Boton variante="predeterminado" tamano="sm">
                  Pequeño
                </Boton>
                <Boton variante="sutil" tamano="sm">
                  Pequeño
                </Boton>
                <Boton variante="peligro" tamano="sm">
                  Pequeño
                </Boton>
              </div>
              <div className="vd-fila">
                <Boton variante="primario" cargando={guardando} onClick={simularGuardado}>
                  {guardando ? "Guardando…" : "Guardar (prueba de carga)"}
                </Boton>
                <Boton variante="primario" disabled>
                  Deshabilitado
                </Boton>
                <Boton variante="predeterminado" disabled>
                  Deshabilitado
                </Boton>
              </div>
              <div className="vd-fila">
                <Boton variante="predeterminado" soloIcono icono={Pencil} aria-label="Editar" />
                <Boton variante="sutil" soloIcono icono={Download} aria-label="Descargar" />
                <Boton variante="peligro" soloIcono icono={Trash2} aria-label="Eliminar" />
                <Boton variante="sutil" tamano="sm" soloIcono icono={X} aria-label="Quitar" />
              </div>
            </div>
          </Tarjeta>
        </Seccion>

        <Seccion
          id="formularios"
          titulo="Formularios"
          descripcion="Etiqueta visible, ayuda debajo y error en color de peligro bajo el campo."
        >
          <Tarjeta>
            <div className="vd-formulario">
              <CampoTexto etiqueta="Nombre del turno" placeholder="Ej.: Mañana" requerido />
              <CampoTexto
                etiqueta="Tolerancia (minutos)"
                type="number"
                defaultValue="5"
                ayuda="Minutos de gracia antes de contar un atraso."
              />
              <CampoTexto
                etiqueta="Hora de entrada"
                defaultValue="25:00"
                error="Ingresa una hora válida entre 00:00 y 23:59."
                requerido
              />
              <CampoTexto etiqueta="Código" defaultValue="TUR-001" disabled />
              <Selector
                etiqueta="Tipo de jornada"
                textoVacio="Selecciona un tipo"
                opciones={[
                  { valor: "completa", etiqueta: "Jornada completa" },
                  { valor: "media", etiqueta: "Media jornada" },
                  { valor: "nocturna", etiqueta: "Nocturna" },
                ]}
              />
              <Selector
                etiqueta="Sucursal"
                error="Selecciona una sucursal."
                textoVacio="Selecciona una sucursal"
                requerido
                opciones={[{ valor: "centro", etiqueta: "Sucursal Centro" }]}
              />
              <Casilla etiqueta="Turno activo" ayuda="Disponible para asignar a empleados." defaultChecked />
              <Casilla etiqueta="Casilla deshabilitada" disabled />
            </div>
          </Tarjeta>
        </Seccion>

        <Seccion
          id="tarjetas"
          titulo="Tarjetas"
          descripcion="Normal, con hover y seleccionada (borde primario de 2px)."
        >
          <div className="vd-tarjetas">
            <Tarjeta titulo="Tarjeta estática">
              <p className="vd-texto-secundario">Contenido informativo sin interacción.</p>
            </Tarjeta>
            {[
              { id: "manana", titulo: "Turno mañana", horario: "08:00 – 16:00" },
              { id: "tarde", titulo: "Turno tarde", horario: "14:00 – 22:00" },
              { id: "noche", titulo: "Turno nocturno con un nombre largo que se corta", horario: "22:00 – 06:00" },
            ].map((turno) => (
              <Tarjeta
                key={turno.id}
                titulo={turno.titulo}
                seleccionada={tarjetaSeleccionada === turno.id}
                onClick={() => setTarjetaSeleccionada(turno.id)}
              >
                <span className="vd-texto-secundario">{turno.horario}</span>
              </Tarjeta>
            ))}
          </div>
        </Seccion>

        <Seccion id="etiquetas" titulo="Etiquetas, contadores y avatares">
          <Tarjeta>
            <div className="vd-filas">
              <div className="vd-fila">
                <Etiqueta>Neutral</Etiqueta>
                <Etiqueta tono="exito">Activo</Etiqueta>
                <Etiqueta tono="aviso">Pendiente</Etiqueta>
                <Etiqueta tono="peligro">Rechazado</Etiqueta>
                <Etiqueta tono="info">En revisión</Etiqueta>
                <Etiqueta tono="morado">Nocturno</Etiqueta>
                <Etiqueta tono="info" icono={Users} className="vd-etiqueta-corta">
                  Etiqueta con un texto demasiado largo
                </Etiqueta>
              </div>
              <div className="vd-fila">
                <Contador>3</Contador>
                <Contador>12</Contador>
                <Contador aria-label="128 postulaciones">128</Contador>
              </div>
              <div className="vd-fila">
                {["Ana Quispe", "Luis Fernández", "Carla Gutiérrez", "Jorge Mendoza", "María Rojas", "Pedro Vargas"].map(
                  (nombre) => (
                    <Avatar key={nombre} nombre={nombre} />
                  ),
                )}
                <Avatar nombre="Regina Maldonado" tamano="lg" />
              </div>
            </div>
          </Tarjeta>
        </Seccion>

        <Seccion id="tabla" titulo="Tabla" descripcion="Filas de 40px, textos largos cortados con descripción emergente.">
          <Tarjeta
            titulo="Empleados"
            acciones={
              <>
                <Boton
                  variante="sutil"
                  tamano="sm"
                  aria-pressed={cargandoTabla}
                  onClick={() => setCargandoTabla((valor) => !valor)}
                >
                  {cargandoTabla ? "Quitar carga" : "Ver carga"}
                </Boton>
                <Boton variante="sutil" tamano="sm" aria-pressed={tablaVacia} onClick={() => setTablaVacia((v) => !v)}>
                  {tablaVacia ? "Con datos" : "Sin datos"}
                </Boton>
              </>
            }
          >
            <Tabla
              descripcion="Empleados de ejemplo"
              columnas={COLUMNAS}
              filas={tablaVacia ? [] : EMPLEADOS}
              cargando={cargandoTabla}
              vacio={
                <EstadoVacio
                  icono={Users}
                  titulo="Aún no hay empleados"
                  mensaje="Registra al primer empleado para asignarle un cargo y una sucursal."
                  accion={
                    <Boton variante="primario" icono={Plus}>
                      Registrar empleado
                    </Boton>
                  }
                />
              }
            />
          </Tarjeta>
        </Seccion>

        <Seccion id="navegacion" titulo="Pestañas y navegación lateral">
          <div className="vd-dos-columnas">
            <Tarjeta titulo="Pestañas">
              <Pestanas
                etiqueta="Estado de las vacantes"
                activa={pestana}
                onCambiar={setPestana}
                pestanas={[
                  { id: "vigentes", etiqueta: "Vigentes", contador: 4, contenido: <p>Vacantes publicadas.</p> },
                  { id: "borradores", etiqueta: "Borradores", contador: 1, contenido: <p>Vacantes sin publicar.</p> },
                  { id: "cerradas", etiqueta: "Cerradas", contenido: <p>Vacantes cerradas.</p> },
                ]}
              />
            </Tarjeta>
            <Tarjeta titulo="Elementos de navegación">
              <ul className="vd-lateral__lista">
                <li>
                  <ElementoNavegacion icono={Users} etiqueta="Empleados" activo />
                </li>
                <li>
                  <ElementoNavegacion icono={Briefcase} etiqueta="Vacantes" contador={4} />
                </li>
                <li>
                  <ElementoNavegacion icono={Bell} etiqueta="Un elemento con un nombre muy largo" />
                </li>
              </ul>
            </Tarjeta>
          </div>
        </Seccion>

        <Seccion id="carga" titulo="Carga y estado vacío">
          <div className="vd-dos-columnas">
            <Tarjeta titulo="Esqueletos">
              <div className="vd-esqueletos" aria-busy="true">
                <span className="ds-solo-lector">Cargando…</span>
                {[1, 2, 3].map((fila) => (
                  <div key={fila} className="vd-esqueleto-fila">
                    <Esqueleto forma="circulo" />
                    <div className="vd-esqueleto-textos">
                      <Esqueleto ancho="60%" />
                      <Esqueleto ancho="35%" />
                    </div>
                  </div>
                ))}
                <Esqueleto forma="bloque" />
              </div>
            </Tarjeta>
            <Tarjeta titulo="Estado vacío">
              <EstadoVacio
                titulo="No hay turnos configurados"
                mensaje="Crea el primer turno para empezar a controlar la asistencia."
                accion={
                  <Boton variante="primario" icono={Plus}>
                    Nuevo turno
                  </Boton>
                }
              />
            </Tarjeta>
          </div>
        </Seccion>

        <Seccion
          id="alertas"
          titulo="Alertas en línea"
          descripcion="Mensajes que permanecen en la página: errores de carga, resúmenes de formulario o avisos que piden una acción."
        >
          <div className="vd-filas">
            <Alerta tono="info" titulo="Uso temporal">
              El identificador de empleado se pedirá hasta que exista el inicio de sesión.
            </Alerta>
            <Alerta tono="exito" titulo="Entrada registrada">
              08:02 · Portal
            </Alerta>
            <Alerta tono="aviso" titulo="Salida pendiente de justificación" onCerrar={() => {}}>
              No se encontró una entrada para esta jornada.
            </Alerta>
            <Alerta
              tono="peligro"
              titulo="No se pudieron cargar los turnos"
              acciones={
                <Boton tamano="sm" onClick={() => avisar({ tono: "info", titulo: "Reintentando…" })}>
                  Reintentar
                </Boton>
              }
            >
              No se pudo conectar con el servidor.
            </Alerta>
          </div>
        </Seccion>

        <Seccion
          id="superposiciones"
          titulo="Modales y avisos"
          descripcion="Las acciones destructivas siempre piden confirmación. Los avisos aparecen abajo a la izquierda."
        >
          <Tarjeta>
            <div className="vd-filas">
              <div className="vd-fila">
                <Boton variante="predeterminado" onClick={() => setModalAbierto(true)}>
                  Abrir modal
                </Boton>
                <Boton variante="peligro" icono={Trash2} onClick={() => setConfirmacionAbierta(true)}>
                  Eliminar turno
                </Boton>
              </div>
              <div className="vd-fila">
                <Boton onClick={() => avisar({ tono: "exito", titulo: "Marcaje registrado", mensaje: "Entrada a las 08:02." })}>
                  Aviso de éxito
                </Boton>
                <Boton onClick={() => avisar({ tono: "aviso", titulo: "Marcaje fuera de horario" })}>
                  Aviso de advertencia
                </Boton>
                <Boton
                  onClick={() =>
                    avisar({ tono: "peligro", titulo: "No se pudo guardar", mensaje: "Revisa tu conexión e inténtalo de nuevo." })
                  }
                >
                  Aviso de error
                </Boton>
                <Boton onClick={() => avisar({ tono: "info", titulo: "Hay una nueva versión de la planilla" })}>
                  Aviso informativo
                </Boton>
              </div>
            </div>
          </Tarjeta>
        </Seccion>
      </main>

      <Modal
        abierto={modalAbierto}
        titulo="Editar turno"
        onCerrar={() => setModalAbierto(false)}
        pie={
          <>
            <Boton variante="sutil" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={() => setModalAbierto(false)}>
              Guardar
            </Boton>
          </>
        }
      >
        <div className="vd-formulario vd-formulario--modal">
          <CampoTexto etiqueta="Nombre del turno" defaultValue="Mañana" requerido />
          <CampoTexto etiqueta="Tolerancia (minutos)" type="number" defaultValue="5" />
        </div>
      </Modal>

      <ModalConfirmacion
        abierto={confirmacionAbierta}
        titulo="¿Eliminar el turno?"
        textoConfirmar="Eliminar"
        procesando={eliminando}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setConfirmacionAbierta(false)}
      >
        Se eliminará el turno <strong>Mañana</strong>. Esta acción no se puede deshacer.
      </ModalConfirmacion>
    </div>
  );
}
