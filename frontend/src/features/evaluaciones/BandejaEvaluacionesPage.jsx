import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ClipboardList, RefreshCw, UserRound } from "lucide-react";
import { listarCiclosEvaluacion, listarEvaluaciones } from "../../api/evaluaciones";
import {
  Alerta,
  Avatar,
  Boton,
  EncabezadoPagina,
  EstadoVacio,
  Etiqueta,
  Pestanas,
  Selector,
  Tabla,
  Tarjeta,
  TextoTruncado,
} from "../../components/ui";
import { useUsuario } from "../../context/sesion";
import { formatearFecha } from "../solicitud-vacaciones/formato";
import { describirAvance, describirPlazo, ESTADOS_EVALUACION, esAbierta } from "./formato";
import "./evaluaciones.css";

// «Pendientes» incluye los borradores: son evaluaciones que todavía falta enviar.
const PESTANAS = [
  { id: "PENDIENTES", etiqueta: "Pendientes", incluye: (e) => esAbierta(e) },
  { id: "ENVIADAS", etiqueta: "Enviadas", incluye: (e) => e.estado_codigo === "ENVIADA" },
  { id: "VENCIDAS", etiqueta: "Vencidas", incluye: (e) => e.estado_codigo === "VENCIDA" },
  { id: "TODAS", etiqueta: "Todas", incluye: () => true },
];

const MENSAJES_VACIO = {
  PENDIENTES: "Cuando RR.HH. le asigne la evaluación de alguien de su equipo, aparecerá aquí.",
  ENVIADAS: "Las evaluaciones que envíe quedarán aquí, con su puntaje final.",
  VENCIDAS: "Aquí aparecerán las evaluaciones que no se enviaron antes de su fecha límite.",
  TODAS: "Cuando RR.HH. le asigne una evaluación, aparecerá aquí.",
};

const COLUMNAS = [
  {
    clave: "colaborador",
    titulo: "Colaborador",
    ancho: "24%",
    celda: (e) => (
      <div className="ev-colaborador">
        <Avatar nombre={e.colaborador.nombre_completo} decorativo />
        <div className="ev-celda">
          <TextoTruncado className="ev-celda__principal">{e.colaborador.nombre_completo}</TextoTruncado>
          <TextoTruncado className="ev-sutil">{e.colaborador.sucursal}</TextoTruncado>
        </div>
      </div>
    ),
  },
  {
    clave: "ciclo",
    titulo: "Ciclo",
    ancho: "30%",
    // Sin truncar: lo que distingue un ciclo de otro suele ir al final del nombre («… 2026-S1» / «… 2026-S2»).
    celda: (e) => <span className="ev-ciclo">{e.ciclo.nombre}</span>,
  },
  {
    clave: "fecha_limite",
    titulo: "Fecha límite",
    ancho: "16%",
    celda: (e) => {
      // Una evaluación enviada ya no tiene plazo que vigilar.
      const plazo = e.estado_codigo === "ENVIADA" ? null : describirPlazo(e.ciclo.fecha_limite);
      return (
        <div className="ev-celda">
          <span>{formatearFecha(e.ciclo.fecha_limite)}</span>
          {plazo && <span className={`ev-plazo ev-plazo--${plazo.tono}`}>{plazo.texto}</span>}
        </div>
      );
    },
  },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "13%",
    celda: (e) => {
      const estado = ESTADOS_EVALUACION[e.estado_codigo];
      return (
        <Etiqueta tono={estado.tono} icono={estado.icono}>
          {estado.texto}
        </Etiqueta>
      );
    },
  },
  {
    clave: "avance",
    titulo: "Avance",
    ancho: "17%",
    celda: (e) => <span className="ev-avance">{describirAvance(e)}</span>,
  },
];

// Se monta de nuevo al cambiar de usuario (key), así nunca queda a la vista el ciclo o la lista de otra persona.
function Bandeja({ idEvaluador, intento, onReintentar }) {
  const [idCiclo, setIdCiclo] = useState("");
  const [pestana, setPestana] = useState("PENDIENTES");
  const [ciclos, setCiclos] = useState(null);
  // La respuesta lleva la clave de lo que se pidió: si el usuario cambia de filtro mientras tanto, se descarta.
  const [resultado, setResultado] = useState({ clave: null });

  const clave = `${idCiclo}|${intento}`;

  useEffect(() => {
    let vigente = true;
    listarCiclosEvaluacion(idEvaluador)
      .then((datos) => vigente && setCiclos(datos))
      // Sin la lista de ciclos solo se pierde el filtro; si el servicio está caído, la tabla lo avisa.
      .catch(() => vigente && setCiclos([]));
    return () => {
      vigente = false;
    };
  }, [idEvaluador, intento]);

  useEffect(() => {
    let vigente = true;
    listarEvaluaciones(idEvaluador, { idCiclo })
      .then((datos) => vigente && setResultado({ clave, datos }))
      .catch((error) => vigente && setResultado({ clave, error: error.message }));
    return () => {
      vigente = false;
    };
  }, [clave, idEvaluador, idCiclo]);

  const vista = resultado.clave === clave ? resultado : {};

  const opcionesCiclo = useMemo(
    () => (ciclos ?? []).map((c) => ({ valor: c.id_ciclo, etiqueta: c.estado_codigo === "CERRADO" ? `${c.nombre} (cerrado)` : c.nombre })),
    [ciclos],
  );

  const activa = PESTANAS.find((p) => p.id === pestana);
  const filas = (vista.datos ?? []).filter(activa.incluye);

  const tabla = vista.error ? (
    <Alerta
      tono="peligro"
      role="alert"
      titulo="No se pudieron cargar las evaluaciones"
      acciones={
        <Boton tamano="sm" onClick={onReintentar}>
          Reintentar
        </Boton>
      }
    >
      {vista.error}
    </Alerta>
  ) : (
    <Tabla
      columnas={COLUMNAS}
      filas={filas}
      claveFila="id_evaluacion"
      descripcion="Evaluaciones asignadas"
      cargando={!vista.datos}
      vacio={
        <EstadoVacio
          icono={ClipboardList}
          titulo={pestana === "PENDIENTES" ? "No tiene evaluaciones pendientes" : "No hay evaluaciones en esta vista"}
          mensaje={idCiclo ? "Pruebe con otra pestaña u otro ciclo." : MENSAJES_VACIO[pestana]}
        />
      }
    />
  );

  return (
    <Tarjeta nivelTitulo={2} titulo="Evaluaciones asignadas">
      <div className="ev-filtros">
        <Selector
          etiqueta="Ciclo"
          value={idCiclo}
          onChange={(evento) => setIdCiclo(evento.target.value)}
          opciones={opcionesCiclo}
          textoVacio="Todos los ciclos"
          disabled={!ciclos}
        />
      </div>
      <Pestanas
        etiqueta="Estado de las evaluaciones"
        activa={pestana}
        onCambiar={setPestana}
        pestanas={PESTANAS.map((p) => ({
          id: p.id,
          etiqueta: p.etiqueta,
          contador: vista.datos ? vista.datos.filter(p.incluye).length : undefined,
          contenido: tabla,
        }))}
      />
    </Tarjeta>
  );
}

// KAN-24 (RF-04): bandeja del evaluador con las evaluaciones que le asignaron, su ciclo y su fecha límite.
export default function BandejaEvaluacionesPage() {
  // Usuario de prueba de la barra lateral: hace de evaluador hasta contar con inicio de sesión.
  const idEvaluador = useUsuario();
  const [intento, setIntento] = useState(0);
  const actualizar = () => setIntento((n) => n + 1);

  return (
    <section className="ev-bandeja" aria-labelledby="ev-bandeja-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Desempeño" }]}
        enlace={Link}
        titulo="Evaluaciones"
        idTitulo="ev-bandeja-titulo"
        descripcion="Evaluaciones de desempeño que le asignaron como evaluador, con su ciclo y su fecha límite."
        acciones={
          idEvaluador && (
            <Boton icono={RefreshCw} onClick={actualizar}>
              Actualizar
            </Boton>
          )
        }
      />

      {idEvaluador ? (
        <Bandeja key={idEvaluador} idEvaluador={idEvaluador} intento={intento} onReintentar={actualizar} />
      ) : (
        <EstadoVacio
          icono={UserRound}
          titulo="Elija su usuario de prueba"
          mensaje="Seleccione quién es en «Usuario de prueba», al pie de la barra lateral, para ver las evaluaciones que tiene asignadas."
        />
      )}
    </section>
  );
}
