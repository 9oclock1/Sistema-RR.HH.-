import { useEffect, useState } from "react";
import { Link, useBlocker } from "react-router";
import { ClipboardList, Pencil, Plus, Send, UserRound } from "lucide-react";
import {
  actualizarPlantilla,
  crearCompetencia,
  crearVersion,
  guardarEstructura,
  listarCompetencias,
  listarEscalas,
  obtenerPlantilla,
  obtenerVersion,
  publicarVersion,
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
import BalancePesos from "./BalancePesos";
import EstructuraPlantilla from "./EstructuraPlantilla";
import ModalCompetencia from "./ModalCompetencia";
import { ESTADOS_PLANTILLA, esEditable, formatearVigencia, hoyLaPaz, resumirSecciones } from "./formato";
import { formatearFecha } from "../solicitud-vacaciones/formato";
import { balancePesos, contarPreguntas, nuevaSeccion, seccionesADatos, seccionesAFormulario } from "./plantilla";
import { RUTA_PLANTILLAS } from "./ruta";
import { pendientesPublicacion } from "./validacionPlantilla";
import "./plantillasEvaluacion.css";

const AVISO_SOLO_LECTURA = {
  PUBLICADA: "Esta versión ya está publicada: su estructura base no se puede modificar.",
  ARCHIVADA: "Esta versión fue reemplazada por una más reciente y quedó archivada: solo se puede consultar.",
};

// Error del servidor como alerta: el mensaje, o la lista de motivos cuando responde con detalles (p. ej. 422).
function AlertaError({ titulo, error, onCerrar }) {
  return (
    <Alerta tono="peligro" role="alert" titulo={titulo} onCerrar={onCerrar}>
      {error.detalles?.length > 0 ? (
        <ul>
          {error.detalles.map((d) => (
            <li key={`${d.campo}${d.mensaje}`}>{d.mensaje}</li>
          ))}
        </ul>
      ) : (
        error.message
      )}
    </Alerta>
  );
}

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
  const [escalas, setEscalas] = useState(null);
  const [errorEscalas, setErrorEscalas] = useState(null);
  const [reintentoEscalas, setReintentoEscalas] = useState(0);

  // Estructura en edición (secciones con criterios y preguntas); null mientras no se haya tocado nada de lo guardado.
  const [edicion, setEdicion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState(null);
  // Mensaje del servidor por campo (ruta del campo -> mensaje), para marcar cada pregunta o criterio inválido.
  const [erroresCampo, setErroresCampo] = useState({});
  const [confirmando, setConfirmando] = useState(false);
  const [modal, setModal] = useState(null);
  const [confirmandoPublicacion, setConfirmandoPublicacion] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [creandoVersion, setCreandoVersion] = useState(false);
  const [errorEstado, setErrorEstado] = useState(null);

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

  useEffect(() => {
    let vigente = true;
    listarEscalas(idEmpleado)
      .then((datos) => {
        if (!vigente) return;
        setEscalas(datos);
        setErrorEscalas(null);
      })
      .catch((error) => vigente && setErrorEscalas(error.message));
    return () => {
      vigente = false;
    };
  }, [idEmpleado, reintentoEscalas]);

  const vistaVersion = resVersion.idVersion === idVersion ? resVersion : {};
  const version = vistaVersion.datos;
  const editable = version?.editable === true;

  const guardadas = version ? seccionesAFormulario(version.secciones) : [];
  const secciones = edicion ?? guardadas;
  const ids = secciones.map((s) => s.competencia.id_competencia);
  const sinGuardar = edicion !== null && JSON.stringify(seccionesADatos(edicion)) !== JSON.stringify(seccionesADatos(guardadas));
  // Quitar una sección ya guardada que tenía criterios borra también sus preguntas: antes se pide confirmar.
  const quitadas = guardadas.filter((s) => !ids.includes(s.competencia.id_competencia));
  const quitadasConContenido = quitadas.filter((s) => s.criterios.length > 0);
  const disponibles = (catalogo ?? []).filter((c) => !ids.includes(c.id_competencia));
  const balance = balancePesos(secciones);
  const pendientes = editable && plantilla ? pendientesPublicacion({ plantilla, secciones, hoy: hoyLaPaz() }) : [];
  // Solo la versión más reciente publicada puede dar origen a un borrador nuevo, y mientras la vigencia no haya terminado:
  // los datos base ya no se pueden cambiar, así que una versión nueva con la vigencia vencida nunca se podría publicar.
  const esUltimaPublicada =
    version?.estado_codigo === "PUBLICADA" && plantilla?.version_actual.id_version === version.id_version;
  const vigenciaTerminada = Boolean(plantilla) && plantilla.vigencia_hasta < hoyLaPaz();
  const puedeCrearVersion = esUltimaPublicada && !vigenciaTerminada;
  const versionPublicada = plantilla?.versiones.find((v) => v.estado_codigo === "PUBLICADA");

  // Si hay cambios sin guardar, salir de la página (menú, atrás o cerrar la pestaña) pide confirmación.
  const bloqueo = useBlocker(sinGuardar);
  useEffect(() => {
    if (!sinGuardar) return undefined;
    const avisarAlCerrar = (evento) => evento.preventDefault();
    window.addEventListener("beforeunload", avisarAlCerrar);
    return () => window.removeEventListener("beforeunload", avisarAlCerrar);
  }, [sinGuardar]);

  const cambiar = (lista) => {
    setEdicion(lista);
    setErroresCampo({});
  };

  const descartar = () => {
    setEdicion(null);
    setErroresCampo({});
    setErrorGuardado(null);
  };

  const guardar = async () => {
    setConfirmando(false);
    setGuardando(true);
    setErrorGuardado(null);
    setErroresCampo({});
    try {
      const actualizada = await guardarEstructura(idEmpleado, idPlantilla, version.id_version, seccionesADatos(secciones));
      setResVersion({ idVersion, datos: actualizada });
      setEdicion(null);
      setRecarga((n) => n + 1);
      avisar({
        tono: "exito",
        titulo: "Estructura guardada",
        mensaje: `${resumirSecciones(actualizada.secciones.map((s) => s.competencia))} · ${contarPreguntas(seccionesAFormulario(actualizada.secciones))} preguntas`,
      });
    } catch (error) {
      setErrorGuardado(error);
      setErroresCampo(Object.fromEntries((error.detalles ?? []).map((d) => [d.campo, d.mensaje])));
    } finally {
      setGuardando(false);
    }
  };

  const pedirGuardado = () => (quitadasConContenido.length > 0 ? setConfirmando(true) : guardar());

  // Publicar bloquea la estructura base: el servidor vuelve a validar y, si falta algo, responde con la lista.
  const publicar = async () => {
    setPublicando(true);
    setErrorEstado(null);
    try {
      const publicada = await publicarVersion(idEmpleado, idPlantilla, version.id_version);
      setResVersion({ idVersion, datos: publicada });
      setEdicion(null);
      setRecarga((n) => n + 1);
      avisar({
        tono: "exito",
        titulo: "Plantilla publicada",
        mensaje: `La versión ${publicada.numero_version} ya está disponible para futuras asignaciones.`,
      });
    } catch (error) {
      setErrorEstado({ titulo: "No se pudo publicar la plantilla", error });
    } finally {
      setPublicando(false);
      setConfirmandoPublicacion(false);
    }
  };

  const crearNuevaVersion = async () => {
    setCreandoVersion(true);
    setErrorEstado(null);
    try {
      const creada = await crearVersion(idEmpleado, idPlantilla);
      setIdElegida(creada.id_version);
      setRecarga((n) => n + 1);
      avisar({
        tono: "exito",
        titulo: "Nueva versión en borrador",
        mensaje: `La versión ${creada.numero_version} parte de la estructura publicada.`,
      });
    } catch (error) {
      setErrorEstado({ titulo: "No se pudo crear la nueva versión", error });
    } finally {
      setCreandoVersion(false);
    }
  };

  const crearYAgregar = async (datos) => {
    const nueva = await crearCompetencia(idEmpleado, datos);
    setCatalogo((actual) => [...(actual ?? []), nueva]);
    cambiar([...secciones, nuevaSeccion(nueva)]);
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
      {encabezado(plantilla.nombre, "Defina las secciones, los criterios y las preguntas ponderadas con que se evaluará, y publique la versión.")}

      <Datos plantilla={plantilla} onEditar={() => setModal("datos")} />

      <Tarjeta
        nivelTitulo={2}
        titulo="Estructura de la evaluación"
        acciones={version && <span className="pl-sutil">{resumirSecciones(secciones.map((s) => s.competencia))}</span>}
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
              <Alerta
                tono="info"
                titulo={AVISO_SOLO_LECTURA[version.estado_codigo] ?? "Esta versión no se puede modificar."}
                acciones={
                  puedeCrearVersion && (
                    <Boton tamano="sm" icono={Plus} onClick={crearNuevaVersion} cargando={creandoVersion}>
                      Crear nueva versión
                    </Boton>
                  )
                }
              >
                {puedeCrearVersion &&
                  "Para cambiarla, cree una nueva versión: parte de esta estructura y la actual sigue vigente hasta que publique la nueva."}
                {esUltimaPublicada &&
                  vigenciaTerminada &&
                  `La vigencia de la plantilla terminó el ${formatearFecha(plantilla.vigencia_hasta)} y sus datos base ya no se pueden cambiar: para seguir evaluando, cree una plantilla nueva.`}
              </Alerta>
            )}

            {editable && versionPublicada && (
              <Alerta tono="info" titulo={`Nueva versión en borrador (versión ${version.numero_version})`}>
                La versión {versionPublicada.numero_version} sigue publicada y vigente hasta que usted publique este
                borrador.
              </Alerta>
            )}

            {errorEstado && (
              <AlertaError titulo={errorEstado.titulo} error={errorEstado.error} onCerrar={() => setErrorEstado(null)} />
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

            {errorEscalas && (
              <Alerta
                tono="aviso"
                titulo="No se pudo cargar el catálogo de escalas de valoración"
                acciones={
                  <Boton tamano="sm" onClick={() => setReintentoEscalas((n) => n + 1)}>
                    Reintentar
                  </Boton>
                }
              >
                {errorEscalas}
              </Alerta>
            )}

            {editable && escalas?.length === 0 && (
              <Alerta tono="aviso" titulo="Todavía no hay escalas de valoración">
                Cada pregunta usa una escala. Cree una en la pestaña «Escalas de valoración» del listado de plantillas.
              </Alerta>
            )}

            {errorGuardado && (
              <AlertaError
                titulo="No se pudo guardar la estructura"
                error={errorGuardado}
                onCerrar={() => setErrorGuardado(null)}
              />
            )}

            {contarPreguntas(secciones) > 0 && (
              <div className="pl-balance">
                <BalancePesos balance={balance} />
              </div>
            )}

            <EstructuraPlantilla
              secciones={secciones}
              disponibles={disponibles}
              escalas={escalas ?? []}
              editable={editable}
              errores={erroresCampo}
              onCambiar={cambiar}
              onNuevaCompetencia={() => setModal("competencia")}
            />

            {editable && pendientes.length > 0 && (
              <Alerta id="pl-pendientes" tono="aviso" titulo="Antes de publicar esta versión">
                <ul>
                  {pendientes.map((pendiente) => (
                    <li key={pendiente}>{pendiente}</li>
                  ))}
                </ul>
              </Alerta>
            )}

            {editable && (
              <div className="pl-guardado">
                <span className="pl-sutil" role="status">
                  {sinGuardar ? "Hay cambios sin guardar." : "Todo guardado."}
                </span>
                <Boton variante="sutil" onClick={descartar} disabled={!sinGuardar || guardando}>
                  Descartar
                </Boton>
                <Boton variante={sinGuardar ? "primario" : "predeterminado"} onClick={pedirGuardado} disabled={!sinGuardar} cargando={guardando}>
                  {guardando ? "Guardando…" : "Guardar estructura"}
                </Boton>
                <Boton
                  variante={sinGuardar ? "predeterminado" : "primario"}
                  icono={Send}
                  onClick={() => setConfirmandoPublicacion(true)}
                  disabled={sinGuardar || guardando || pendientes.length > 0}
                  aria-describedby={sinGuardar || pendientes.length > 0 ? "pl-motivo-publicar" : undefined}
                >
                  Publicar
                </Boton>
                <span id="pl-motivo-publicar" className="ds-solo-lector">
                  {sinGuardar ? "Guarde los cambios antes de publicar." : "Resuelva los pendientes antes de publicar."}
                </span>
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
        Se quitará{quitadas.length === 1 ? "" : "n"}: <strong>{quitadas.map((s) => s.competencia.nombre).join(", ")}</strong>.
        {quitadasConContenido.length > 0 &&
          ` Sus criterios y preguntas (${contarPreguntas(quitadasConContenido)} en total) también se eliminarán.`}
      </ModalConfirmacion>

      <ModalConfirmacion
        abierto={confirmandoPublicacion}
        titulo="¿Publicar la plantilla?"
        textoConfirmar="Publicar"
        variante="primario"
        procesando={publicando}
        onConfirmar={publicar}
        onCancelar={() => setConfirmandoPublicacion(false)}
      >
        La versión {version?.numero_version} de <strong>{plantilla.nombre}</strong> quedará disponible para futuras
        asignaciones periódicas y su estructura base se bloqueará: para cambiarla tendrá que crear una nueva versión.
        {versionPublicada && ` La versión ${versionPublicada.numero_version} pasará a archivada.`}
      </ModalConfirmacion>

      <ModalConfirmacion
        abierto={bloqueo.state === "blocked"}
        titulo="¿Salir sin guardar?"
        textoConfirmar="Salir sin guardar"
        onConfirmar={() => bloqueo.proceed()}
        onCancelar={() => bloqueo.reset()}
      >
        Tiene cambios en la estructura que todavía no se guardaron. Si sale ahora, se perderán.
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
