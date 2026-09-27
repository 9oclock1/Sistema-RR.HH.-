import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { actualizarTurno, crearTurno, eliminarTurno, listarTiposJornada, listarTurnos } from "../../api/turnos";
import { Alerta, Boton, EncabezadoPagina, ModalConfirmacion, Tarjeta, useAvisos } from "../../components/ui";
import TablaTurnos from "./TablaTurnos";
import TurnoFormulario from "./TurnoFormulario";
import "./turnos.css";

const datosTurno = (turno) => ({
  nombre: turno.nombre,
  id_tipo_jornada: turno.id_tipo_jornada,
  hora_inicio: turno.hora_inicio,
  hora_fin: turno.hora_fin,
  minutos_refrigerio: turno.minutos_refrigerio,
  minutos_tolerancia: turno.minutos_tolerancia,
});

export default function TurnosPage() {
  const avisar = useAvisos();
  const [turnos, setTurnos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [alerta, setAlerta] = useState(null);
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

  const reintentar = () => {
    setCargando(true);
    setErrorCarga(null);
    cargar();
  };

  const abrirFormulario = (turno) => {
    setAlerta(null);
    setFormulario({ turno });
  };

  const guardar = async (datos) => {
    const { turno } = formulario;
    if (turno) await actualizarTurno(turno.id_turno, datos);
    else await crearTurno(datos);
    setFormulario(null);
    await cargar();
    avisar({ tono: "exito", titulo: turno ? "Turno actualizado" : "Turno creado", mensaje: datos.nombre });
  };

  const desactivar = async (turno) => {
    setAlerta(null);
    try {
      await actualizarTurno(turno.id_turno, { ...datosTurno(turno), esta_activo: false });
      await cargar();
      avisar({ tono: "exito", titulo: "Turno desactivado", mensaje: turno.nombre });
    } catch (error) {
      setAlerta({ titulo: "No se pudo desactivar el turno", texto: error.message });
    }
  };

  const confirmarEliminacion = async () => {
    const turno = porEliminar;
    setEliminando(true);
    try {
      await eliminarTurno(turno.id_turno);
      await cargar();
      avisar({ tono: "exito", titulo: "Turno eliminado", mensaje: turno.nombre });
    } catch (error) {
      const puedeDesactivar = error.estado === 409 && turno.esta_activo;
      setAlerta({
        titulo: `No se pudo eliminar «${turno.nombre}»`,
        texto: error.message,
        accion: puedeDesactivar ? { texto: "Desactivar turno", ejecutar: () => desactivar(turno) } : null,
      });
    } finally {
      setEliminando(false);
      setPorEliminar(null);
    }
  };

  const botonNuevo = (
    <Boton variante="primario" icono={Plus} onClick={() => abrirFormulario(null)}>
      Nuevo turno
    </Boton>
  );

  return (
    <section className="turnos" aria-labelledby="turnos-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Asistencia" }]}
        titulo="Turnos"
        idTitulo="turnos-titulo"
        descripcion="Horarios, refrigerios y tolerancias de atraso."
        acciones={!errorCarga && turnos.length > 0 && botonNuevo}
      />

      {alerta && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo={alerta.titulo}
          onCerrar={() => setAlerta(null)}
          acciones={
            alerta.accion && (
              <Boton tamano="sm" onClick={alerta.accion.ejecutar}>
                {alerta.accion.texto}
              </Boton>
            )
          }
        >
          {alerta.texto}
        </Alerta>
      )}

      {errorCarga ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar los turnos"
          acciones={
            <Boton tamano="sm" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          {errorCarga}
        </Alerta>
      ) : (
        <Tarjeta className="turnos-tarjeta">
          <TablaTurnos
            turnos={turnos}
            cargando={cargando}
            accionVacia={botonNuevo}
            onEditar={abrirFormulario}
            onEliminar={setPorEliminar}
          />
        </Tarjeta>
      )}

      {formulario && (
        <TurnoFormulario
          key={formulario.turno?.id_turno ?? "nuevo"}
          tipos={tipos}
          turno={formulario.turno}
          onGuardar={guardar}
          onCancelar={() => setFormulario(null)}
        />
      )}

      <ModalConfirmacion
        abierto={Boolean(porEliminar)}
        titulo="¿Eliminar el turno?"
        textoConfirmar="Eliminar"
        procesando={eliminando}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setPorEliminar(null)}
      >
        Se eliminará el turno <strong>{porEliminar?.nombre}</strong>. Esta acción no se puede deshacer.
      </ModalConfirmacion>
    </section>
  );
}
