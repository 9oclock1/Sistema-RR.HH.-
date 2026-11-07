import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Alerta, Boton, Casilla, EncabezadoPagina, Esqueleto, EstadoVacio, Selector } from "../../../components/ui";
import { obtenerAgendaEntrevistas } from "../../../api/entrevistas";
import { useRol, useUsuario } from "../../../context/sesion";
import { useEmpleados } from "../../Asignaciones/hooks/useEmpleados";
import "../pipeline/pipeline.css";
import CalendarioSemana from "./CalendarioSemana";
import ModalDetalleEntrevista from "./ModalDetalleEntrevista";
import { diasDeSemana, estaActiva, hoyLocal, lunesDe, sumarDias, tituloSemana } from "./reglasEntrevista";
import "./entrevistas.css";

const LEYENDA = [
  { codigo: "programada", nombre: "Programada" },
  { codigo: "reprogramada", nombre: "Reprogramada" },
  { codigo: "realizada", nombre: "Realizada" },
  { codigo: "cancelada", nombre: "Cancelada" },
];

// RF-15.5: agenda semanal de entrevistas del reclutador, filtrable por evaluador. Cada cita abre su detalle, desde
// donde se reprograma o cancela (y se avisa al candidato).
export default function AgendaEntrevistasPage() {
  const rol = useRol();
  const idUsuario = useUsuario();
  const { empleados } = useEmpleados();
  const hoy = hoyLocal();

  const [lunes, setLunes] = useState(() => lunesDe(hoy));
  const [idEvaluador, setIdEvaluador] = useState("");
  const [conCanceladas, setConCanceladas] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [resultado, setResultado] = useState({ clave: null });
  const [abierta, setAbierta] = useState(null);

  const sesion = useMemo(
    () => ({
      rol,
      idUsuario,
      nombreUsuario: empleados.find((e) => e.id_empleado === idUsuario)?.nombre_completo ?? null,
    }),
    [rol, idUsuario, empleados],
  );

  const clave = [lunes, idEvaluador, conCanceladas, recarga].join("|");
  useEffect(() => {
    const controlador = new AbortController();
    const [inicio, evaluador, canceladas] = clave.split("|");
    obtenerAgendaEntrevistas(
      {
        desde: `${inicio}T00:00`,
        hasta: `${sumarDias(inicio, 7)}T00:00`,
        idEntrevistador: evaluador || undefined,
        incluirCanceladas: canceladas === "true",
      },
      { signal: controlador.signal },
    )
      .then((datos) => setResultado({ clave, citas: datos.entrevistas }))
      .catch((falla) => falla.name !== "AbortError" && setResultado({ clave, error: falla.message }));
    return () => controlador.abort();
  }, [clave]);

  // Al cambiar de semana se conserva la anterior hasta que llegue la nueva, para que no parpadee.
  const vigente = resultado.clave === clave ? resultado : null;
  const citas = vigente?.citas ?? resultado.citas ?? [];
  const dias = diasDeSemana(lunes);
  const activas = citas.filter(estaActiva).length;
  const recargar = () => setRecarga((n) => n + 1);

  const evaluadores = empleados.map((e) => ({ valor: e.id_empleado, etiqueta: e.nombre_completo }));

  let cuerpo;
  if (resultado.error && !vigente?.citas) {
    cuerpo = (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudo cargar la agenda"
        acciones={
          <Boton tamano="sm" onClick={recargar}>
            Reintentar
          </Boton>
        }
      >
        {resultado.error}
      </Alerta>
    );
  } else if (!resultado.clave) {
    cuerpo = <Esqueleto forma="bloque" ancho="100%" alto="calc(var(--space-8) * 10)" />;
  } else {
    cuerpo = (
      <>
        <CalendarioSemana dias={dias} citas={citas} hoy={hoy} onAbrir={setAbierta} />
        {citas.length === 0 && vigente && (
          <EstadoVacio
            icono={CalendarClock}
            titulo="No hay entrevistas esta semana"
            mensaje="Las entrevistas se agendan desde el pipeline de selección, en la tarjeta de cada postulante."
          />
        )}
      </>
    );
  }

  return (
    <div className="pl-pagina">
      <EncabezadoPagina
        titulo="Agenda de entrevistas"
        descripcion="Entrevistas programadas por semana. Abra una cita para ver su historial, reprogramarla o cancelarla."
        acciones={
          <Boton icono={RefreshCw} onClick={recargar}>
            Actualizar
          </Boton>
        }
      />

      <div className="en-barra">
        <div className="en-navegacion" role="group" aria-label="Semana">
          <Boton variante="sutil" soloIcono icono={ChevronLeft} aria-label="Semana anterior" onClick={() => setLunes((l) => sumarDias(l, -7))} />
          <Boton tamano="sm" onClick={() => setLunes(lunesDe(hoy))} disabled={lunes === lunesDe(hoy)}>
            Hoy
          </Boton>
          <Boton variante="sutil" soloIcono icono={ChevronRight} aria-label="Semana siguiente" onClick={() => setLunes((l) => sumarDias(l, 7))} />
          <h2 className="en-navegacion__titulo" aria-live="polite">
            {tituloSemana(lunes)}
          </h2>
        </div>
        <Selector
          etiqueta="Evaluador"
          className="en-barra__evaluador"
          value={idEvaluador}
          onChange={(e) => setIdEvaluador(e.target.value)}
          textoVacio="Todos los evaluadores"
          opciones={evaluadores}
        />
        <Casilla etiqueta="Mostrar canceladas" checked={conCanceladas} onChange={(e) => setConCanceladas(e.target.checked)} />
      </div>

      <div className="en-resumen">
        <p className="pl-sutil" aria-live="polite">
          {vigente ? `${activas} entrevista(s) vigente(s) esta semana` : "Cargando…"}
        </p>
        <ul className="en-leyenda" aria-label="Estados">
          {LEYENDA.filter((e) => conCanceladas || e.codigo !== "cancelada").map((estado) => (
            <li key={estado.codigo} className={`en-leyenda__item en-cita--${estado.codigo}`}>
              {estado.nombre}
            </li>
          ))}
        </ul>
      </div>

      {cuerpo}

      {abierta && (
        <ModalDetalleEntrevista
          key={abierta.id_entrevista}
          entrevista={abierta}
          empleados={empleados}
          sesion={sesion}
          puedeEditar={Boolean(idUsuario)}
          onCerrar={() => setAbierta(null)}
          onActualizar={recargar}
        />
      )}
    </div>
  );
}
