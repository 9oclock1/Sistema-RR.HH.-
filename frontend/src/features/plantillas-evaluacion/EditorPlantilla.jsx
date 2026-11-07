import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, CopyPlus, Plus, Save, Send, Trash2 } from "lucide-react";
import {
  actualizarPlantilla,
  crearPlantilla,
  crearVersionPlantilla,
  listarAreas,
  listarCompetencias,
  listarEscalas,
  obtenerPlantilla,
  publicarPlantilla,
} from "../../api/plantillasEvaluacion";
import {
  Alerta,
  Boton,
  CampoAreaTexto,
  CampoTexto,
  Contador,
  EncabezadoPagina,
  Esqueleto,
  Etiqueta,
  ModalConfirmacion,
  Selector,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import BalancePesos from "./BalancePesos";
import ModalCompetencia from "./ModalCompetencia";
import PreguntaEditor from "./PreguntaEditor";
import {
  aDatos,
  aFormulario,
  balancePesos,
  ESTADOS,
  formatearPorcentaje,
  nuevaPregunta,
  nuevaSeccion,
  nuevoCriterio,
  pesoCriterio,
  pesoSeccion,
} from "./plantilla";

const dentroDe = (campo, prefijo) =>
  campo === prefijo || campo.startsWith(`${prefijo}.`) || campo.startsWith(`${prefijo}[`);

const sinPrefijo = (errores, prefijo) =>
  Object.fromEntries(Object.entries(errores).filter(([campo]) => !dentroDe(campo, prefijo)));

const reemplazar = (lista, indice, cambio) => lista.map((item, i) => (i === indice ? cambio(item) : item));
const quitar = (lista, indice) => lista.filter((_, i) => i !== indice);

// idInicial: versión a abrir, o null para crear una plantilla nueva.
// idEmpleado: usuario de prueba; queda como creador o publicador.
export default function EditorPlantilla({ idInicial, idEmpleado, onVolver, onAbrir }) {
  const avisar = useAvisos();
  const [plantilla, setPlantilla] = useState(null);
  const [formulario, setFormulario] = useState(() => aFormulario(null));
  const [catalogos, setCatalogos] = useState({ escalas: [], competencias: [], areas: [] });
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [errores, setErrores] = useState({});
  const [alerta, setAlerta] = useState(null);
  const [procesando, setProcesando] = useState(null);
  const [modificado, setModificado] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  // Índice de la sección que recibe la competencia creada en el modal.
  const [nuevaCompetenciaPara, setNuevaCompetenciaPara] = useState(null);
  const refAlerta = useRef(null);

  const mostrar = useCallback((datos) => {
    setPlantilla(datos);
    setFormulario(aFormulario(datos));
    setModificado(false);
  }, []);

  useEffect(() => {
    Promise.all([
      idInicial ? obtenerPlantilla(idInicial) : null,
      listarEscalas(),
      listarCompetencias(),
      listarAreas(),
    ])
      .then(([datos, escalas, competencias, areas]) => {
        setCatalogos({ escalas, competencias, areas });
        if (datos) mostrar(datos);
      })
      .catch((error) => setErrorCarga(error.message))
      .finally(() => setCargando(false));
  }, [idInicial, mostrar]);

  useEffect(() => {
    if (alerta) refAlerta.current?.focus();
  }, [alerta]);

  const soloLectura = Boolean(plantilla) && plantilla.estado !== "BORRADOR";
  const datosEditables = !plantilla || plantilla.datos_editables;
  const balance = useMemo(() => balancePesos(formulario.secciones), [formulario.secciones]);
  // Las preguntas nuevas empiezan con la primera escala del catálogo (Likert de 1 a 5).
  const escalaInicial = catalogos.escalas[0]?.id_escala ?? "";

  // limpiar: campos (relativos a ruta) cuyo error se borra; null borra todos los de ruta.
  const editar = (cambio, ruta, limpiar) => {
    setFormulario(cambio);
    setModificado(true);
    setErrores((actuales) => {
      if (limpiar === null) return sinPrefijo(actuales, ruta);
      const siguientes = { ...actuales };
      limpiar.forEach((campo) => delete siguientes[ruta ? `${ruta}.${campo}` : campo]);
      return siguientes;
    });
  };

  const cambiarCampo = (campo) => (evento) =>
    editar((actual) => ({ ...actual, [campo]: evento.target.value }), "", [campo]);

  const cambiarSeccion = (i, cambios, limpiar) =>
    editar(
      (actual) => ({ ...actual, secciones: reemplazar(actual.secciones, i, (s) => ({ ...s, ...cambios })) }),
      `secciones[${i}]`,
      limpiar
    );

  const cambiarCriterio = (i, j, cambios, limpiar) =>
    editar(
      (actual) => ({
        ...actual,
        secciones: reemplazar(actual.secciones, i, (s) => ({
          ...s,
          criterios: reemplazar(s.criterios, j, (c) => ({ ...c, ...cambios })),
        })),
      }),
      `secciones[${i}].criterios[${j}]`,
      limpiar
    );

  const cambiarPregunta = (i, j, k) => (pregunta, limpiar) =>
    editar(
      (actual) => ({
        ...actual,
        secciones: reemplazar(actual.secciones, i, (s) => ({
          ...s,
          criterios: reemplazar(s.criterios, j, (c) => ({ ...c, preguntas: reemplazar(c.preguntas, k, () => pregunta) })),
        })),
      }),
      `secciones[${i}].criterios[${j}].preguntas[${k}]`,
      limpiar
    );

  // Agregar o quitar elementos desplaza los índices con los que el servidor reportó los errores.
  const cambiarEstructura = (cambio) => editar((actual) => ({ ...actual, secciones: cambio(actual.secciones) }), "secciones", null);

  const agregarSeccion = () => cambiarEstructura((secciones) => [...secciones, nuevaSeccion(escalaInicial)]);
  const quitarSeccion = (i) => cambiarEstructura((secciones) => quitar(secciones, i));
  const agregarCriterio = (i) =>
    cambiarEstructura((secciones) =>
      reemplazar(secciones, i, (s) => ({ ...s, criterios: [...s.criterios, nuevoCriterio(escalaInicial)] }))
    );
  const quitarCriterio = (i, j) =>
    cambiarEstructura((secciones) => reemplazar(secciones, i, (s) => ({ ...s, criterios: quitar(s.criterios, j) })));
  const agregarPregunta = (i, j) =>
    cambiarEstructura((secciones) =>
      reemplazar(secciones, i, (s) => ({
        ...s,
        criterios: reemplazar(s.criterios, j, (c) => ({ ...c, preguntas: [...c.preguntas, nuevaPregunta(escalaInicial)] })),
      }))
    );
  const quitarPregunta = (i, j, k) =>
    cambiarEstructura((secciones) =>
      reemplazar(secciones, i, (s) => ({
        ...s,
        criterios: reemplazar(s.criterios, j, (c) => ({ ...c, preguntas: quitar(c.preguntas, k) })),
      }))
    );

  const competenciaCreada = (competencia) => {
    setCatalogos((actual) => ({ ...actual, competencias: [...actual.competencias, competencia] }));
    if (nuevaCompetenciaPara !== null) {
      cambiarSeccion(nuevaCompetenciaPara, { id_competencia: competencia.id_competencia }, ["id_competencia"]);
    }
    setNuevaCompetenciaPara(null);
    avisar({ tono: "exito", titulo: "Competencia creada", mensaje: competencia.nombre });
  };

  const fallo = (titulo, error) => {
    const porCampo = Object.fromEntries(
      (error.detalles ?? []).filter((d) => d.campo !== "pesos").map((d) => [d.campo, d.mensaje])
    );
    setErrores(porCampo);
    const desbalance = error.detalles?.find((d) => d.campo === "pesos");
    const conCampos = Object.keys(porCampo).length > 0 && !desbalance;
    setAlerta({
      titulo: conCampos ? "Revise los campos marcados." : titulo,
      texto: desbalance?.mensaje ?? (conCampos ? null : error.message),
    });
  };

  // Guarda el formulario y devuelve la versión guardada; si falla, muestra los errores y devuelve null.
  const guardarFormulario = async () => {
    setAlerta(null);
    try {
      const datos = aDatos(formulario, { conDatosBase: datosEditables });
      const guardada = plantilla
        ? await actualizarPlantilla(plantilla.id_version, datos)
        : await crearPlantilla(idEmpleado, datos);
      setErrores({});
      mostrar(guardada);
      return guardada;
    } catch (error) {
      fallo("No se pudo guardar la plantilla", error);
      return null;
    }
  };

  const guardar = async () => {
    setProcesando("guardar");
    const guardada = await guardarFormulario();
    setProcesando(null);
    if (guardada) avisar({ tono: "exito", titulo: "Borrador guardado", mensaje: guardada.nombre });
  };

  const publicar = async () => {
    setConfirmar(null);
    setProcesando("publicar");
    const guardada = await guardarFormulario();
    if (guardada) {
      try {
        mostrar(await publicarPlantilla(idEmpleado, guardada.id_version));
        avisar({
          tono: "exito",
          titulo: "Plantilla publicada",
          mensaje: `${guardada.nombre} · versión ${guardada.numero_version}`,
        });
      } catch (error) {
        fallo("No se puede publicar la plantilla", error);
      }
    }
    setProcesando(null);
  };

  const crearVersion = async () => {
    setAlerta(null);
    setProcesando("version");
    try {
      const borrador = await crearVersionPlantilla(plantilla.id_version);
      onAbrir(borrador.id_version);
      avisar({ tono: "exito", titulo: `Versión ${borrador.numero_version} en borrador`, mensaje: borrador.nombre });
    } catch (error) {
      fallo("No se pudo crear la nueva versión", error);
      setProcesando(null);
    }
  };

  const volver = () => (modificado && !soloLectura ? setConfirmar("descartar") : onVolver());

  const estado = ESTADOS[plantilla?.estado ?? "BORRADOR"];
  const ocupado = Boolean(procesando);
  const titulo = plantilla ? plantilla.nombre : "Nueva plantilla";
  const sinUsuario = !idEmpleado;
  const opcionesCompetencia = catalogos.competencias.map((c) => ({
    valor: c.id_competencia,
    etiqueta: `${c.nombre} (${c.tipo_nombre.toLowerCase()})`,
  }));
  const opcionesArea = catalogos.areas.map((a) => ({ valor: a.id_departamento, etiqueta: a.nombre }));
  // Si el área fue dada de baja, la plantilla la conserva: se agrega para que el selector la muestre.
  if (plantilla && !opcionesArea.some((a) => a.valor === plantilla.id_departamento_destino)) {
    opcionesArea.push({ valor: plantilla.id_departamento_destino, etiqueta: plantilla.departamento });
  }

  const acciones = soloLectura ? (
    <Boton variante="primario" icono={CopyPlus} onClick={crearVersion} cargando={procesando === "version"}>
      Crear nueva versión
    </Boton>
  ) : (
    <>
      <Boton
        icono={Save}
        onClick={guardar}
        cargando={procesando === "guardar"}
        disabled={ocupado || (!plantilla && sinUsuario)}
      >
        Guardar borrador
      </Boton>
      <Boton
        variante="primario"
        icono={Send}
        onClick={() => setConfirmar("publicar")}
        cargando={procesando === "publicar"}
        disabled={ocupado || sinUsuario}
      >
        Publicar
      </Boton>
    </>
  );

  if (cargando || errorCarga) {
    return (
      <section className="plantillas">
        <Boton variante="sutil" icono={ArrowLeft} onClick={onVolver} className="plantillas-volver">
          Plantillas de evaluación
        </Boton>
        {errorCarga ? (
          <Alerta tono="peligro" role="alert" titulo="No se pudo abrir la plantilla">
            {errorCarga}
          </Alerta>
        ) : (
          <Tarjeta>
            <Esqueleto ancho="40%" />
            <Esqueleto ancho="70%" />
          </Tarjeta>
        )}
      </section>
    );
  }

  return (
    <section className="plantillas" aria-labelledby="plantilla-titulo">
      <Boton variante="sutil" icono={ArrowLeft} onClick={volver} className="plantillas-volver">
        Plantillas de evaluación
      </Boton>
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Desempeño" }]}
        enlace={Link}
        titulo={titulo}
        idTitulo="plantilla-titulo"
        descripcion={
          <span className="plantilla-meta">
            <Etiqueta tono={estado.tono}>{estado.etiqueta}</Etiqueta>
            {plantilla && <span>Versión {plantilla.numero_version}</span>}
            {plantilla?.publicador && <span>Publicada por {plantilla.publicador}</span>}
          </span>
        }
        acciones={acciones}
      />

      {sinUsuario && !soloLectura && (
        <Alerta tono="aviso" titulo="Elija su usuario de prueba">
          Seleccione quién es en «Usuario de prueba», al pie de la barra lateral: se registra como creador y como quien
          publica la plantilla.
        </Alerta>
      )}

      {soloLectura && (
        <Alerta tono="info" titulo={`Esta versión está ${estado.etiqueta.toLowerCase()} y no se puede modificar.`}>
          Para cambiar preguntas o pesos, cree una nueva versión. Los ciclos de evaluación en curso conservan la versión
          con la que empezaron.
        </Alerta>
      )}

      {alerta && (
        <Alerta
          ref={refAlerta}
          tabIndex={-1}
          tono="peligro"
          role="alert"
          titulo={alerta.titulo}
          onCerrar={() => setAlerta(null)}
        >
          {alerta.texto}
        </Alerta>
      )}

      <div className="plantilla-cuerpo">
        <fieldset className="plantilla-formulario" disabled={soloLectura || ocupado}>
          <legend className="ds-solo-lector">Contenido de la plantilla</legend>
          <Tarjeta titulo="Datos generales" nivelTitulo={2}>
            {!datosEditables && !soloLectura && (
              <p className="plantilla-nota">
                Los datos generales son comunes a todas las versiones y quedaron fijos al publicar la primera.
              </p>
            )}
            <fieldset className="plantilla-campos plantilla-campos--grilla" disabled={!datosEditables}>
              <legend className="ds-solo-lector">Datos generales</legend>
              <CampoTexto
                id="nombre"
                etiqueta="Nombre"
                className="plantilla-ancho"
                requerido
                maxLength={120}
                autoComplete="off"
                value={formulario.nombre}
                onChange={cambiarCampo("nombre")}
                error={errores.nombre}
              />
              <CampoAreaTexto
                id="objetivo"
                etiqueta="Objetivo"
                className="plantilla-ancho"
                requerido
                filas={2}
                maxLength={2000}
                value={formulario.objetivo}
                onChange={cambiarCampo("objetivo")}
                error={errores.objetivo}
              />
              <Selector
                id="id_departamento_destino"
                etiqueta="Área destino"
                className="plantilla-ancho"
                requerido
                textoVacio="Seleccione un área"
                opciones={opcionesArea}
                value={formulario.id_departamento_destino}
                onChange={cambiarCampo("id_departamento_destino")}
                error={errores.id_departamento_destino}
              />
              <CampoTexto
                id="vigencia_desde"
                etiqueta="Vigente desde"
                requerido
                type="date"
                value={formulario.vigencia_desde}
                onChange={cambiarCampo("vigencia_desde")}
                error={errores.vigencia_desde}
              />
              <CampoTexto
                id="vigencia_hasta"
                etiqueta="Vigente hasta"
                requerido
                type="date"
                min={formulario.vigencia_desde || undefined}
                value={formulario.vigencia_hasta}
                onChange={cambiarCampo("vigencia_hasta")}
                error={errores.vigencia_hasta}
              />
            </fieldset>
          </Tarjeta>

          {errores.secciones && (
            <p className="plantilla-error" role="alert">
              {errores.secciones}
            </p>
          )}

          {formulario.secciones.map((seccion, i) => {
            const ruta = `secciones[${i}]`;
            const competencia = catalogos.competencias.find((c) => c.id_competencia === seccion.id_competencia);
            const usadas = new Set(formulario.secciones.filter((_, x) => x !== i).map((s) => s.id_competencia));
            return (
              <Tarjeta
                key={seccion.clave}
                className="plantilla-seccion"
                titulo={`Sección ${i + 1}${competencia ? `: ${competencia.nombre}` : ""}`}
                nivelTitulo={2}
                acciones={
                  <>
                    <Contador aria-label={`Peso de la sección: ${formatearPorcentaje(pesoSeccion(seccion))}`}>
                      {formatearPorcentaje(pesoSeccion(seccion))}
                    </Contador>
                    {!soloLectura && (
                      <Boton
                        variante="sutil"
                        soloIcono
                        icono={Trash2}
                        aria-label={`Eliminar sección ${i + 1}`}
                        title="Eliminar sección"
                        onClick={() => quitarSeccion(i)}
                      />
                    )}
                  </>
                }
              >
                <div className="plantilla-seccion__competencia">
                  <Selector
                    id={`${ruta}.id_competencia`}
                    etiqueta="Competencia que evalúa"
                    requerido
                    textoVacio="Seleccione una competencia"
                    opciones={opcionesCompetencia.map((o) => ({ ...o, deshabilitada: usadas.has(o.valor) }))}
                    value={seccion.id_competencia}
                    onChange={(e) => cambiarSeccion(i, { id_competencia: e.target.value }, ["id_competencia"])}
                    error={errores[`${ruta}.id_competencia`]}
                  />
                  {!soloLectura && (
                    <Boton variante="sutil" icono={Plus} onClick={() => setNuevaCompetenciaPara(i)}>
                      Nueva competencia
                    </Boton>
                  )}
                </div>

                {seccion.criterios.map((criterio, j) => {
                  const rutaCriterio = `${ruta}.criterios[${j}]`;
                  return (
                    <div key={criterio.clave} className="plantilla-criterio">
                      <div className="plantilla-criterio__cabecera">
                        <h3 className="plantilla-criterio__titulo">
                          Criterio {i + 1}.{j + 1}
                          {criterio.nombre ? `: ${criterio.nombre}` : ""}
                        </h3>
                        <Contador aria-label={`Peso del criterio: ${formatearPorcentaje(pesoCriterio(criterio))}`}>
                          {formatearPorcentaje(pesoCriterio(criterio))}
                        </Contador>
                        {!soloLectura && (
                          <Boton
                            variante="sutil"
                            tamano="sm"
                            soloIcono
                            icono={Trash2}
                            aria-label={`Eliminar criterio ${i + 1}.${j + 1}`}
                            title="Eliminar criterio"
                            onClick={() => quitarCriterio(i, j)}
                          />
                        )}
                      </div>
                      <div className="plantilla-campos">
                        <CampoTexto
                          id={`${rutaCriterio}.nombre`}
                          etiqueta="Nombre del criterio"
                          requerido
                          maxLength={120}
                          autoComplete="off"
                          value={criterio.nombre}
                          onChange={(e) => cambiarCriterio(i, j, { nombre: e.target.value }, ["nombre"])}
                          error={errores[`${rutaCriterio}.nombre`]}
                        />
                        <CampoTexto
                          id={`${rutaCriterio}.descripcion`}
                          etiqueta="Descripción"
                          maxLength={255}
                          value={criterio.descripcion}
                          onChange={(e) => cambiarCriterio(i, j, { descripcion: e.target.value }, ["descripcion"])}
                          error={errores[`${rutaCriterio}.descripcion`]}
                        />
                      </div>

                      <ol className="plantilla-preguntas">
                        {criterio.preguntas.map((pregunta, k) => (
                          <PreguntaEditor
                            key={pregunta.clave}
                            pregunta={pregunta}
                            numero={`${i + 1}.${j + 1}.${k + 1}`}
                            ruta={`${rutaCriterio}.preguntas[${k}]`}
                            errores={errores}
                            escalas={catalogos.escalas}
                            soloLectura={soloLectura}
                            onCambiar={cambiarPregunta(i, j, k)}
                            onEliminar={() => quitarPregunta(i, j, k)}
                          />
                        ))}
                      </ol>
                      {criterio.preguntas.length === 0 && (
                        <p className="plantilla-nota">Este criterio aún no tiene preguntas.</p>
                      )}
                      {!soloLectura && (
                        <Boton variante="sutil" icono={Plus} onClick={() => agregarPregunta(i, j)}>
                          Agregar pregunta
                        </Boton>
                      )}
                    </div>
                  );
                })}
                {seccion.criterios.length === 0 && <p className="plantilla-nota">Esta sección aún no tiene criterios.</p>}
                {!soloLectura && (
                  <Boton icono={Plus} onClick={() => agregarCriterio(i)} className="plantilla-agregar">
                    Agregar criterio
                  </Boton>
                )}
              </Tarjeta>
            );
          })}

          {!soloLectura && (
            <Boton icono={Plus} onClick={agregarSeccion} className="plantilla-agregar">
              Agregar sección
            </Boton>
          )}
        </fieldset>

        <aside className="plantilla-lateral" aria-label="Balance de ponderaciones">
          <BalancePesos balance={balance} />
          <ul className="plantilla-resumen">
            {formulario.secciones.map((seccion, i) => {
              const competencia = catalogos.competencias.find((c) => c.id_competencia === seccion.id_competencia);
              const nombre = competencia?.nombre || `Sección ${i + 1}`;
              return (
                <li key={seccion.clave}>
                  <span className="plantilla-resumen__nombre" title={nombre}>
                    {nombre}
                  </span>
                  <span>{formatearPorcentaje(pesoSeccion(seccion))}</span>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>

      <ModalCompetencia
        abierto={nuevaCompetenciaPara !== null}
        onCreada={competenciaCreada}
        onCerrar={() => setNuevaCompetenciaPara(null)}
      />

      <ModalConfirmacion
        abierto={confirmar === "publicar"}
        titulo="¿Publicar la plantilla?"
        textoConfirmar="Publicar"
        variante="primario"
        onConfirmar={publicar}
        onCancelar={() => setConfirmar(null)}
      >
        Se guardarán los cambios y la versión quedará disponible para los ciclos de evaluación. Después no podrá
        modificar sus preguntas ni pesos: tendrá que crear una nueva versión.
        {plantilla?.numero_version > 1 && " La versión publicada anterior quedará archivada."}
        {!balance.balanceado && (
          <p className="plantilla-nota-aviso">
            Los pesos suman {formatearPorcentaje(balance.suma)}; deben sumar exactamente 100 % para publicar.
          </p>
        )}
      </ModalConfirmacion>

      <ModalConfirmacion
        abierto={confirmar === "descartar"}
        titulo="¿Descartar los cambios?"
        textoConfirmar="Descartar"
        onConfirmar={onVolver}
        onCancelar={() => setConfirmar(null)}
      >
        Hay cambios sin guardar en esta plantilla. Si vuelve a la lista, se perderán.
      </ModalConfirmacion>
    </section>
  );
}
