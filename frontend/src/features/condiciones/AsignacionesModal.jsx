import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, Trash2, UserPlus, Users } from "lucide-react";
import {
  asignarCondicion,
  cambiarFinAsignacion,
  eliminarAsignacion,
  listarAsignaciones,
  listarPersonal,
} from "../../api/condiciones";
import {
  Alerta,
  Boton,
  CampoTexto,
  Casilla,
  EstadoVacio,
  Etiqueta,
  Modal,
  ModalConfirmacion,
  Selector,
  Tabla,
  useAvisos,
} from "../../components/ui";
import { estadoVigencia, formatearFecha, hoyLaPaz } from "../conceptos/formato";
import useFormulario from "../conceptos/useFormulario";
import { describirValor } from "./formato";

const ETIQUETAS = {
  ids_empleado: "Colaboradores",
  vigente_desde: "Vigente desde",
  vigente_hasta: "Vigente hasta",
  motivo: "Motivo",
};

const vacio = () => ({ ids_empleado: [], vigente_desde: hoyLaPaz(), vigente_hasta: "", motivo: "" });

const columnas = ({ hoy, procesando, onFinalizar, onEliminar }) => [
  {
    clave: "empleado",
    titulo: "Colaborador",
    celda: (a) => (
      <div className="conceptos-nombre">
        <span>{a.empleado.nombre_completo}</span>
        {a.empleado.area && <span className="conceptos-nota">{a.empleado.area}</span>}
      </div>
    ),
  },
  {
    clave: "vigencia",
    titulo: "Vigencia",
    ancho: "28%",
    celda: (a) => (
      <div className="conceptos-nombre">
        <span>Desde {formatearFecha(a.vigente_desde)}</span>
        <span className="conceptos-nota">
          {a.vigente_hasta ? `Hasta ${formatearFecha(a.vigente_hasta)}` : "Sin fecha de fin"}
        </span>
      </div>
    ),
  },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "17%",
    celda: (a) => {
      const estado = estadoVigencia(a, hoy);
      return <Etiqueta tono={estado.tono}>{estado.etiqueta}</Etiqueta>;
    },
  },
  {
    clave: "acciones",
    titulo: <span className="ds-solo-lector">Acciones</span>,
    celda: (a) => {
      const finalizable = a.vigente_desde <= hoy && (!a.vigente_hasta || a.vigente_hasta > hoy);
      return (
        <div className="conceptos-acciones">
          {finalizable && (
            <Boton
              tamano="sm"
              cargando={procesando === a.id_asignacion}
              aria-label={`Finalizar hoy la asignación de ${a.empleado.nombre_completo}`}
              onClick={() => onFinalizar(a)}
            >
              Finalizar hoy
            </Boton>
          )}
          <Boton
            variante="sutil"
            soloIcono
            icono={Trash2}
            aria-label={`Eliminar la asignación de ${a.empleado.nombre_completo}`}
            title="Eliminar asignación"
            onClick={() => onEliminar(a)}
          />
        </div>
      );
    },
  },
];

export default function AsignacionesModal({ condicion, onCerrar, onCambio }) {
  const avisar = useAvisos();
  const hoy = hoyLaPaz();
  const [asignaciones, setAsignaciones] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const [personal, setPersonal] = useState(null);
  const [errorPersonal, setErrorPersonal] = useState(null);
  const [area, setArea] = useState("");
  const [alerta, setAlerta] = useState(null);
  const [procesando, setProcesando] = useState(null);
  const [porEliminar, setPorEliminar] = useState(null);
  const id = condicion.id_condicion;

  const cargar = useCallback(
    () =>
      listarAsignaciones(id)
        .then((lista) => {
          setAsignaciones(lista);
          setErrorCarga(null);
        })
        .catch((error) => setErrorCarga(error.message)),
    [id]
  );

  const cargarPersonal = useCallback(
    () =>
      listarPersonal()
        .then((lista) => {
          setPersonal(lista.filter((e) => e.activo));
          setErrorPersonal(null);
        })
        .catch((error) => setErrorPersonal(error.message)),
    []
  );

  useEffect(() => {
    cargar();
    cargarPersonal();
  }, [cargar, cargarPersonal]);

  const { valores, setValores, enviar, enviando, propsCampo, resumen } = useFormulario({
    inicial: vacio(),
    etiquetas: ETIQUETAS,
    prefijo: "asignacion",
    onGuardar: async ({ vigente_hasta, ...datos }) => {
      const creadas = await asignarCondicion(id, { ...datos, vigente_hasta: vigente_hasta || null });
      setValores(vacio());
      await cargar();
      onCambio();
      avisar({
        tono: "exito",
        titulo: creadas.length === 1 ? "Colaborador asignado" : `${creadas.length} colaboradores asignados`,
        mensaje: `${condicion.codigo} desde ${formatearFecha(datos.vigente_desde)}`,
      });
    },
  });

  // Quien ya la tiene sin fecha de fin no se puede volver a asignar.
  const asignadosSinFin = useMemo(
    () => new Set((asignaciones ?? []).filter((a) => !a.vigente_hasta).map((a) => a.empleado.id_empleado)),
    [asignaciones]
  );
  const areas = useMemo(
    () => [...new Set((personal ?? []).map((e) => e.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [personal]
  );
  const visibles = (personal ?? []).filter((e) => !area || e.area === area);
  const elegibles = visibles.filter((e) => !asignadosSinFin.has(e.id_empleado));
  const seleccion = new Set(valores.ids_empleado);
  const todosElegidos = elegibles.length > 0 && elegibles.every((e) => seleccion.has(e.id_empleado));

  const alternar = (idEmpleado) =>
    setValores((v) => ({
      ...v,
      ids_empleado: v.ids_empleado.includes(idEmpleado)
        ? v.ids_empleado.filter((x) => x !== idEmpleado)
        : [...v.ids_empleado, idEmpleado],
    }));

  const alternarTodos = () =>
    setValores((v) => {
      const ids = new Set(v.ids_empleado);
      elegibles.forEach((e) => (todosElegidos ? ids.delete(e.id_empleado) : ids.add(e.id_empleado)));
      return { ...v, ids_empleado: [...ids] };
    });

  const ejecutar = async (asignacion, accion, exito) => {
    setAlerta(null);
    setProcesando(asignacion.id_asignacion);
    try {
      await accion();
      await cargar();
      onCambio();
      avisar({ tono: "exito", titulo: exito, mensaje: asignacion.empleado.nombre_completo });
    } catch (error) {
      setAlerta(error.message);
    } finally {
      setProcesando(null);
    }
  };

  const finalizar = (a) =>
    ejecutar(a, () => cambiarFinAsignacion(id, a.id_asignacion, hoy), "Asignación finalizada");

  const confirmarEliminacion = async () => {
    const a = porEliminar;
    await ejecutar(a, () => eliminarAsignacion(id, a.id_asignacion), "Asignación eliminada");
    setPorEliminar(null);
  };

  const errorColaboradores = propsCampo("ids_empleado").error;

  return (
    <Modal abierto titulo={`Asignaciones de ${condicion.codigo}`} onCerrar={onCerrar} bloqueado={enviando}>
      <div className="vigencias">
        <p className="concepto-nota">
          {condicion.nombre}
          {condicion.vigencia &&
            `: ${describirValor(condicion.vigencia.valor, condicion.forma_calculo, condicion.tipo_condicion)}, `}
          prorrateado por los días del mes en que la asignación está vigente.
        </p>

        {alerta && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo cambiar la asignación" onCerrar={() => setAlerta(null)}>
            {alerta}
          </Alerta>
        )}

        {errorCarga ? (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudieron cargar las asignaciones"
            acciones={
              <Boton tamano="sm" onClick={cargar}>
                Reintentar
              </Boton>
            }
          >
            {errorCarga}
          </Alerta>
        ) : (
          <Tabla
            className="vigencias-tabla asignaciones-tabla"
            descripcion={`Colaboradores asignados a ${condicion.codigo}`}
            columnas={columnas({ hoy, procesando, onFinalizar: finalizar, onEliminar: setPorEliminar })}
            filas={asignaciones ?? []}
            claveFila="id_asignacion"
            cargando={!asignaciones}
            filasCargando={2}
            vacio={<EstadoVacio icono={Users} titulo="Nadie tiene esta condición todavía" />}
          />
        )}

        <form className="vigencias-formulario" onSubmit={enviar} noValidate aria-labelledby="asignacion-titulo">
          <h3 id="asignacion-titulo" className="vigencias-titulo">
            Nueva asignación
          </h3>
          {resumen}

          <fieldset className="asignacion-personal" aria-describedby={errorColaboradores ? "asignacion-ids_empleado-error" : undefined}>
            <legend className="ds-campo__etiqueta">
              Colaboradores
              <span className="ds-campo__requerido" aria-hidden="true">
                *
              </span>
            </legend>
            {errorPersonal ? (
              <Alerta
                tono="peligro"
                titulo="No se pudo cargar el personal"
                acciones={
                  <Boton tamano="sm" onClick={cargarPersonal}>
                    Reintentar
                  </Boton>
                }
              >
                {errorPersonal}
              </Alerta>
            ) : (
              <>
                <div className="asignacion-personal__filtros">
                  <Selector
                    id="asignacion-area"
                    etiqueta="Área"
                    value={area}
                    onChange={(evento) => setArea(evento.target.value)}
                    textoVacio="Todas"
                    opciones={areas.map((a) => ({ valor: a, etiqueta: a }))}
                    disabled={!personal}
                  />
                  <Casilla
                    id="asignacion-todos"
                    etiqueta={`Seleccionar ${area ? "el área" : "todos"} (${elegibles.length})`}
                    checked={todosElegidos}
                    disabled={elegibles.length === 0}
                    onChange={alternarTodos}
                  />
                </div>
                <div
                  id="asignacion-ids_empleado"
                  className="asignacion-personal__lista"
                  tabIndex={-1}
                  role="group"
                  aria-label="Personal activo"
                  aria-busy={!personal}
                >
                  {!personal && <p className="concepto-nota">Cargando personal…</p>}
                  {personal && visibles.length === 0 && <p className="concepto-nota">No hay personal activo en esta área.</p>}
                  {visibles.map((e) => {
                    const yaAsignado = asignadosSinFin.has(e.id_empleado);
                    return (
                      <Casilla
                        key={e.id_empleado}
                        id={`asignacion-empleado-${e.id_empleado}`}
                        etiqueta={e.nombre_completo}
                        ayuda={yaAsignado ? "Ya tiene esta condición sin fecha de fin." : [e.cargo, e.area].filter(Boolean).join(" · ")}
                        checked={seleccion.has(e.id_empleado)}
                        disabled={yaAsignado}
                        onChange={() => alternar(e.id_empleado)}
                      />
                    );
                  })}
                </div>
                {errorColaboradores && (
                  <p className="ds-campo__error" id="asignacion-ids_empleado-error">
                    <CircleAlert className="ds-icono" aria-hidden="true" />
                    {errorColaboradores}
                  </p>
                )}
                <p className="concepto-nota" aria-live="polite">
                  {seleccion.size === 1 ? "1 colaborador seleccionado" : `${seleccion.size} colaboradores seleccionados`}
                </p>
              </>
            )}
          </fieldset>

          <div className="concepto-grupo__campos">
            <CampoTexto {...propsCampo("vigente_desde")} type="date" requerido />
            <CampoTexto {...propsCampo("vigente_hasta")} type="date" ayuda="Vacío mientras siga en esa condición." />
            <CampoTexto
              {...propsCampo("motivo")}
              className="concepto-grupo__ancho"
              maxLength={250}
              autoComplete="off"
              ayuda="Opcional, por ejemplo: Cámara de congelados de la sucursal Centro."
            />
          </div>
          <div className="vigencias-formulario__pie">
            <Boton type="submit" variante="primario" icono={UserPlus} cargando={enviando}>
              {enviando ? "Asignando…" : `Asignar (${seleccion.size})`}
            </Boton>
          </div>
        </form>
      </div>

      <ModalConfirmacion
        abierto={Boolean(porEliminar)}
        titulo="¿Eliminar la asignación?"
        textoConfirmar="Eliminar"
        procesando={Boolean(porEliminar) && procesando === porEliminar?.id_asignacion}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setPorEliminar(null)}
      >
        Se quitará <strong>{porEliminar?.empleado.nombre_completo}</strong> de {condicion.codigo}. Los bonos ya
        procesados se conservan hasta que se vuelva a procesar el mes.
      </ModalConfirmacion>
    </Modal>
  );
}
