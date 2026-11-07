import { useEffect, useState } from "react";
import { Link, useBlocker } from "react-router";
import { ClipboardList, Pencil, UserRound } from "lucide-react";
import {
  actualizarPlantilla,
  crearCompetencia,
  guardarSecciones,
  listarCompetencias,
  obtenerPlantilla,
  obtenerVersion,
} from "../../api/plantillasEvaluacion";
import {
  Alerta,
  Boton,
  EncabezadoPagina,
  EstadoVacio,
  Esqueleto,
  Etiqueta,
  ModalConfirmacion,
  Selector,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import { useUsuario } from "../../context/sesion";
import { useDepartamentosActivos } from "../../hooks/useDepartamentosActivos";
import FormularioPlantilla from "./FormularioPlantilla";
import ModalCompetencia from "./ModalCompetencia";
import SeccionesPlantilla from "./SeccionesPlantilla";
import { ESTADOS_PLANTILLA, esEditable, formatearVigencia, resumirSecciones } from "./formato";
import { RUTA_PLANTILLAS } from "./ruta";
import "./plantillasEvaluacion.css";

const AVISO_SOLO_LECTURA = {
  PUBLICADA: "Esta versión ya está publicada: su estructura no se puede modificar.",
  ARCHIVADA: "Esta versión fue reemplazada por una más reciente y quedó archivada: solo se puede consultar.",
};

function Datos({ plantilla, onEditar }) {
  const estado = ESTADOS_PLANTILLA[plantilla.estado_codigo];
  return (
    <Tarjeta
      nivelTitulo={2}
      titulo="Datos de la plantilla"
      acciones={
        esEditable(plantilla) && (
          <Boton tamano="sm" icono={Pencil} onClick={onEditar}>
            Editar datos
          </Boton>
        )
      }
    >
      <dl className="pl-datos">
        <div>
          <dt>Estado</dt>
          <dd>
            <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta> Versión {plantilla.version_actual.numero_version}
          </dd>
        </div>
        <div>
          <dt>Área destino</dt>
          <dd>{plantilla.area.nombre}</dd>
        </div>
        <div>
          <dt>Vigencia</dt>
          <dd className="pl-vigencia">{formatearVigencia(plantilla.vigencia_desde, plantilla.vigencia_hasta)}</dd>
        </div>
        <div>
          <dt>Creada por</dt>
          <dd>{plantilla.creador.nombre_completo}</dd>
        </div>
        <div className="pl-datos__ancho">
          <dt>Objetivo</dt>
          <dd>{plantilla.objetivo}</dd>
        </div>
      </dl>
    </Tarjeta>
  );
}

// Se monta de nuevo al cambiar de usuario o de plantilla (key), así nunca queda a la vista lo de otra.
function Editor({ idEmpleado, idPlantilla }) {
  const avisar = useAvisos();
  const { departamentos, error: errorAreas } = useDepartamentosActivos();

  // Cada respuesta lleva la clave de lo que se pidió: si cambia la versión mientras tanto, se descarta.
  const [recarga, setRecarga] = useState(0);
  const [resPlantilla, setResPlantilla] = useState({});
  const [idElegida, setIdElegida] = useState(null);
  const [resVersion, setResVersion] = useState({});
  const [reintentoVersion, setReintentoVersion] = useState(0);
  const [catalogo, setCatalogo] = useState(null);
  const [errorCatalogo, setErrorCatalogo] = useState(null);
  const [reintentoCatalogo, setReintentoCatalogo] = useState(0);

  // Lista de competencias en edición; null mientras no se haya tocado nada de lo guardado.
  const [edicion, setEdicion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [modal, setModal] = useState(null);

  const plantilla = resPlantilla.datos;
  const idVersion = idElegida ?? plantilla?.version_actual.id_version;

  useEffect(() => {
    let vigente = true;
    obtenerPlantilla(idEmpleado, idPlantilla)
      .then((datos) => vigente && setResPlantilla({ datos }))
      .catch((error) => vigente && setResPlantilla((previo) => ({ datos: previo.datos, error })));
    return () => {
      vigente = false;
    };
  }, [idEmpleado, idPlantilla, recarga]);

  useEffect(() => {
    if (!idVersion) return undefined;
    let vigente = true;
    obtenerVersion(idEmpleado, idPlantilla, idVersion)
      .then((datos) => vigente && setResVersion({ idVersion, datos }))
      .catch((error) => vigente && setResVersion({ idVersion, error }));
    return () => {
      vigente = false;
    };
  }, [idEmpleado, idPlantilla, idVersion, reintentoVersion]);

  useEffect(() => {
    let vigente = true;
    listarCompetencias(idEmpleado)
      .then((datos) => {
        if (!vigente) return;
        setCatalogo(datos);
        setErrorCatalogo(null);
      })
      .catch((error) => vigente && setErrorCatalogo(error.message));
    return () => {
      vigente = false;
    };
  }, [idEmpleado, reintentoCatalogo]);

  const vistaVersion = resVersion.idVersion === idVersion ? resVersion : {};
  const version = vistaVersion.datos;
  const editable = version?.editable === true;

  const guardadas = version ? version.secciones.map((s) => s.competencia) : [];
  const secciones = edicion ?? guardadas;
  const ids = secciones.map((c) => c.id_competencia);
  const sinGuardar = edicion !== null && ids.join() !== guardadas.map((c) => c.id_competencia).join();
  const quitadas = guardadas.filter((c) => !ids.includes(c.id_competencia));
  const disponibles = (catalogo ?? []).filter((c) => !ids.includes(c.id_competencia));

  // Si hay cambios sin guardar, salir de la página (menú, atrás o cerrar la pestaña) pide confirmación.
  const bloqueo = useBlocker(sinGuardar);
  useEffect(() => {
    if (!sinGuardar) return undefined;
    const avisarAlCerrar = (evento) => evento.preventDefault();
    window.addEventListener("beforeunload", avisarAlCerrar);
    return () => window.removeEventListener("beforeunload", avisarAlCerrar);
  }, [sinGuardar]);

  const agregar = (idCompetencia) => {
    const competencia = disponibles.find((c) => c.id_competencia === idCompetencia);
    if (competencia) setEdicion([...secciones, competencia]);
  };

  const mover = (indice, desplazamiento) => {
    const lista = [...secciones];
    [lista[indice], lista[indice + desplazamiento]] = [lista[indice + desplazamiento], lista[indice]];
    setEdicion(lista);
  };

  const quitar = (idCompetencia) => setEdicion(secciones.filter((c) => c.id_competencia !== idCompetencia));

  const guardar = async () => {
    setConfirmando(false);
    setGuardando(true);
    setErrorGuardado(null);
    try {
      const actualizada = await guardarSecciones(idEmpleado, idPlantilla, version.id_version, ids);
      setResVersion({ idVersion, datos: actualizada });
      setEdicion(null);
      setRecarga((n) => n + 1);
      avisar({ tono: "exito", titulo: "Secciones guardadas", mensaje: resumirSecciones(actualizada.secciones.map((s) => s.competencia)) });
    } catch (error) {
      setErrorGuardado(error);
    } finally {
      setGuardando(false);
    }
  };

  // Quitar una sección ya guardada borra también sus criterios y preguntas: antes se pide confirmar.
  const pedirGuardado = () => (quitadas.length > 0 ? setConfirmando(true) : guardar());

  const crearYAgregar = async (datos) => {
    const nueva = await crearCompetencia(idEmpleado, datos);
    setCatalogo((actual) => [...(actual ?? []), nueva]);
    setEdicion([...secciones, nueva]);
    setModal(null);
    avisar({ tono: "exito", titulo: "Competencia creada", mensaje: nueva.nombre });
  };

  const guardarDatos = async (datos) => {
    await actualizarPlantilla(idEmpleado, idPlantilla, datos);
    setModal(null);
    setRecarga((n) => n + 1);
    avisar({ tono: "exito", titulo: "Plantilla actualizada", mensaje: datos.nombre.trim() });
  };

  const encabezado = (titulo, descripcion) => (
    <EncabezadoPagina
      migas={[
        { etiqueta: "Inicio", href: "/" },
        { etiqueta: "Desempeño" },
        { etiqueta: "Plantillas de evaluación", href: RUTA_PLANTILLAS },
      ]}
      enlace={Link}
      titulo={titulo}
      idTitulo="pl-editor-titulo"
      descripcion={descripcion}
    />
  );

  if (!plantilla) {
    if (!resPlantilla.error) {
      return (
        <>
          {encabezado("Plantilla de evaluación")}
          <Tarjeta aria-busy="true">
            <Esqueleto />
          </Tarjeta>
        </>
      );
    }
    const noExiste = resPlantilla.error.estado === 404;
    return (
      <>
        {encabezado("Plantilla de evaluación")}
        {noExiste ? (
          <EstadoVacio
            icono={ClipboardList}
            titulo="La plantilla no existe"
            mensaje="Pudo haberse eliminado. Vuelva al listado para ver las plantillas disponibles."
            accion={
              <Boton as={Link} to={RUTA_PLANTILLAS}>
                Volver al listado
              </Boton>
            }
          />
        ) : (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudo cargar la plantilla"
            acciones={
              <Boton tamano="sm" onClick={() => setRecarga((n) => n + 1)}>
                Reintentar
              </Boton>
            }
          >
            {resPlantilla.error.message}
          </Alerta>
        )}
      </>
    );
  }

  const opcionesVersion = plantilla.versiones.map((v) => ({
    valor: v.id_version,
    etiqueta: `Versión ${v.numero_version} · ${ESTADOS_PLANTILLA[v.estado_codigo].texto}`,
  }));

  return (
    <>
      {encabezado(plantilla.nombre, "Defina las secciones de competencias y factores operativos que se evaluarán.")}

      <Datos plantilla={plantilla} onEditar={() => setModal("datos")} />

      <Tarjeta
        nivelTitulo={2}
        titulo="Secciones"
        acciones={version && <span className="pl-sutil">{resumirSecciones(secciones)}</span>}
      >
        {vistaVersion.error ? (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudo cargar la versión"
            acciones={
              <Boton tamano="sm" onClick={() => setReintentoVersion((n) => n + 1)}>
                Reintentar
              </Boton>
            }
          >
            {vistaVersion.error.message}
          </Alerta>
        ) : !version ? (
          <Esqueleto />
        ) : (
          <div className="pl-editor">
            {opcionesVersion.length > 1 && (
              <div className="pl-version">
                <Selector
                  etiqueta="Versión"
                  value={idVersion}
                  onChange={(evento) => setIdElegida(evento.target.value)}
                  opciones={opcionesVersion}
                  disabled={sinGuardar}
                  ayuda={sinGuardar ? "Guarde o descarte los cambios para cambiar de versión." : undefined}
                />
              </div>
            )}

            {!editable && (
              <Alerta tono="info" titulo={AVISO_SOLO_LECTURA[version.estado_codigo] ?? "Esta versión no se puede modificar."} />
            )}

            {errorCatalogo && (
              <Alerta
                tono="aviso"
                titulo="No se pudo cargar el catálogo de competencias"
                acciones={
                  <Boton tamano="sm" onClick={() => setReintentoCatalogo((n) => n + 1)}>
                    Reintentar
                  </Boton>
                }
              >
                {errorCatalogo}
              </Alerta>
            )}

            {errorGuardado && (
              <Alerta tono="peligro" role="alert" titulo="No se pudieron guardar las secciones" onCerrar={() => setErrorGuardado(null)}>
                {errorGuardado.detalles?.length > 0 ? (
                  <ul>
                    {errorGuardado.detalles.map((d) => (
                      <li key={`${d.campo}${d.mensaje}`}>{d.mensaje}</li>
                    ))}
                  </ul>
                ) : (
                  errorGuardado.message
                )}
              </Alerta>
            )}

            <SeccionesPlantilla
              secciones={secciones}
              disponibles={disponibles}
              editable={editable}
              onAgregar={agregar}
              onMover={mover}
              onQuitar={quitar}
              onNuevaCompetencia={() => setModal("competencia")}
            />

            {editable && (
              <div className="pl-guardado">
                <span className="pl-sutil" role="status">
                  {sinGuardar ? "Hay cambios sin guardar." : "Todo guardado."}
                </span>
                <Boton variante="sutil" onClick={() => setEdicion(null)} disabled={!sinGuardar || guardando}>
                  Descartar
                </Boton>
                <Boton variante="primario" onClick={pedirGuardado} disabled={!sinGuardar} cargando={guardando}>
                  {guardando ? "Guardando…" : "Guardar secciones"}
                </Boton>
              </div>
            )}
          </div>
        )}
      </Tarjeta>

      {modal === "datos" && (
        <FormularioPlantilla
          plantilla={plantilla}
          departamentos={departamentos}
          errorAreas={errorAreas}
          onGuardar={guardarDatos}
          onCancelar={() => setModal(null)}
        />
      )}
      {modal === "competencia" && <ModalCompetencia onGuardar={crearYAgregar} onCancelar={() => setModal(null)} />}

      <ModalConfirmacion
        abierto={confirmando}
        titulo="¿Quitar secciones de la versión?"
        textoConfirmar="Guardar y quitar"
        onConfirmar={guardar}
        onCancelar={() => setConfirmando(false)}
      >
        Se quitará{quitadas.length === 1 ? "" : "n"}: <strong>{quitadas.map((c) => c.nombre).join(", ")}</strong>. Si
        tenían criterios y preguntas, también se eliminarán.
      </ModalConfirmacion>

      <ModalConfirmacion
        abierto={bloqueo.state === "blocked"}
        titulo="¿Salir sin guardar?"
        textoConfirmar="Salir sin guardar"
        onConfirmar={() => bloqueo.proceed()}
        onCancelar={() => bloqueo.reset()}
      >
        Tiene cambios en las secciones que todavía no se guardaron. Si sale ahora, se perderán.
      </ModalConfirmacion>
    </>
  );
}

export default function EditorPlantillaPage({ idPlantilla }) {
  // Usuario de prueba de la barra lateral: figura como creador o publicador hasta contar con inicio de sesión.
  const idEmpleado = useUsuario();

  return (
    <section className="pl-pagina" aria-labelledby="pl-editor-titulo">
      {idEmpleado ? (
        <Editor key={`${idEmpleado}|${idPlantilla}`} idEmpleado={idEmpleado} idPlantilla={idPlantilla} />
      ) : (
        <>
          <EncabezadoPagina
            migas={[
              { etiqueta: "Inicio", href: "/" },
              { etiqueta: "Desempeño" },
              { etiqueta: "Plantillas de evaluación", href: RUTA_PLANTILLAS },
            ]}
            enlace={Link}
            titulo="Plantilla de evaluación"
            idTitulo="pl-editor-titulo"
          />
          <EstadoVacio
            icono={UserRound}
            titulo="Elija su usuario de prueba"
            mensaje="Seleccione quién es en «Usuario de prueba», al pie de la barra lateral, para configurar la plantilla."
          />
        </>
      )}
    </section>
  );
}
