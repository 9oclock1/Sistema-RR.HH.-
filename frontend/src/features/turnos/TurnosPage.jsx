import { useCallback, useEffect, useState } from "react";
import { actualizarTurno, crearTurno, eliminarTurno, listarTiposJornada, listarTurnos } from "../../api/turnos";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import TablaTurnos from "./TablaTurnos";
import TurnoFormulario from "./TurnoFormulario";
import "./turnos.css";

const DURACION_AVISO_MS = 4000;

const datosTurno = (turno) => ({
  nombre: turno.nombre,
  id_tipo_jornada: turno.id_tipo_jornada,
  hora_inicio: turno.hora_inicio,
  hora_fin: turno.hora_fin,
  minutos_refrigerio: turno.minutos_refrigerio,
  minutos_tolerancia: turno.minutos_tolerancia,
});

export default function TurnosPage() {
  const [turnos, setTurnos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [formulario, setFormulario] = useState(null);
  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(
    () =>
      Promise.all([listarTurnos(), listarTiposJornada()])
        .then(([listaTurnos, listaTipos]) => {
          setTurnos(listaTurnos);
          setTipos(listaTipos);
          setErrorCarga(null);
        })
        .catch((error) => setErrorCarga(error.message))
        .finally(() => setCargando(false)),
    []
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (aviso?.tipo !== "exito") return;
    const temporizador = setTimeout(() => setAviso(null), DURACION_AVISO_MS);
    return () => clearTimeout(temporizador);
  }, [aviso]);

  const reintentar = () => {
    setCargando(true);
    setErrorCarga(null);
    cargar();
  };

  const abrirFormulario = (turno) => {
    setAviso(null);
    setFormulario({ turno });
  };

  const guardar = async (datos) => {
    const { turno } = formulario;
    if (turno) await actualizarTurno(turno.id_turno, datos);
    else await crearTurno(datos);
    setFormulario(null);
    await cargar();
    setAviso({ tipo: "exito", texto: turno ? "Turno actualizado." : "Turno creado." });
  };

  const desactivar = async (turno) => {
    setAviso(null);
    try {
      await actualizarTurno(turno.id_turno, { ...datosTurno(turno), esta_activo: false });
      await cargar();
      setAviso({ tipo: "exito", texto: `Turno "${turno.nombre}" desactivado.` });
    } catch (error) {
      setAviso({ tipo: "error", texto: error.message });
    }
  };

  const confirmarEliminacion = async () => {
    const turno = porEliminar;
    setEliminando(true);
    try {
      await eliminarTurno(turno.id_turno);
      if (formulario?.turno?.id_turno === turno.id_turno) setFormulario(null);
      await cargar();
      setAviso({ tipo: "exito", texto: `Turno "${turno.nombre}" eliminado.` });
    } catch (error) {
      const puedeDesactivar = error.estado === 409 && turno.esta_activo;
      setAviso({
        tipo: "error",
        texto: error.message,
        accion: puedeDesactivar ? { texto: "Desactivar turno", ejecutar: () => desactivar(turno) } : null,
      });
    } finally {
      setEliminando(false);
      setPorEliminar(null);
    }
  };

  return (
    <section className="turnos" aria-labelledby="turnos-titulo">
      <div className="pagina-encabezado">
        <div>
          <h1 id="turnos-titulo">Turnos</h1>
          <p className="subtitulo">Horarios, refrigerios y tolerancias de atraso.</p>
        </div>
        {!formulario && (
          <button type="button" className="boton boton-primario" onClick={() => abrirFormulario(null)}>
            Nuevo turno
          </button>
        )}
      </div>

      <div className="avisos" aria-live="polite">
        {aviso && (
          <div className={`alerta alerta-${aviso.tipo}`} role={aviso.tipo === "error" ? "alert" : undefined}>
            <p>{aviso.texto}</p>
            {aviso.accion && (
              <button type="button" className="boton boton-compacto" onClick={aviso.accion.ejecutar}>
                {aviso.accion.texto}
              </button>
            )}
            <button type="button" className="alerta-cerrar" aria-label="Cerrar aviso" onClick={() => setAviso(null)}>
              ×
            </button>
          </div>
        )}
      </div>

      {formulario && (
        <TurnoFormulario
          key={formulario.turno?.id_turno ?? "nuevo"}
          tipos={tipos}
          turno={formulario.turno}
          onGuardar={guardar}
          onCancelar={() => setFormulario(null)}
        />
      )}

      {cargando && (
        <p className="nota" role="status">
          Cargando turnos…
        </p>
      )}
      {!cargando && errorCarga && (
        <div className="alerta alerta-error" role="alert">
          <p>{errorCarga}</p>
          <button type="button" className="boton boton-compacto" onClick={reintentar}>
            Reintentar
          </button>
        </div>
      )}
      {!cargando && !errorCarga && (
        <TablaTurnos
          turnos={turnos}
          idEditando={formulario?.turno?.id_turno}
          onEditar={abrirFormulario}
          onEliminar={setPorEliminar}
        />
      )}

      <DialogoConfirmacion
        abierto={Boolean(porEliminar)}
        titulo="¿Eliminar turno?"
        textoConfirmar="Eliminar"
        textoProcesando="Eliminando…"
        procesando={eliminando}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setPorEliminar(null)}
      >
        <p>
          Se eliminará el turno <strong>{porEliminar?.nombre}</strong>. Esta acción no se puede deshacer.
        </p>
      </DialogoConfirmacion>
    </section>
  );
}
