import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, CopyPlus, Plus, Save, Send, Trash2 } from "lucide-react";
import {
  actualizarPlantilla,
  crearPlantilla,
  crearVersionPlantilla,
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
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import BalancePesos from "./BalancePesos";
import PreguntaEditor from "./PreguntaEditor";
import {
  aDatos,
  aFormulario,
  balancePesos,
  ESTADOS,
  formatearPorcentaje,
  nuevaPregunta,
  nuevoCriterio,
  pesoCriterio,
} from "./plantilla";

const dentroDe = (campo, prefijo) =>
  campo === prefijo || campo.startsWith(`${prefijo}.`) || campo.startsWith(`${prefijo}[`);

const sinPrefijo = (errores, prefijo) =>
  Object.fromEntries(Object.entries(errores).filter(([campo]) => !dentroDe(campo, prefijo)));

// idInicial: plantilla a abrir, o null para crear una nueva.
export default function EditorPlantilla({ idInicial, onVolver, onAbrir }) {
  const avisar = useAvisos();
  const [plantilla, setPlantilla] = useState(null);
  const [formulario, setFormulario] = useState(() => aFormulario(null));
  const [cargando, setCargando] = useState(Boolean(idInicial));
  const [errorCarga, setErrorCarga] = useState(null);
  const [errores, setErrores] = useState({});
  const [alerta, setAlerta] = useState(null);
  const [procesando, setProcesando] = useState(null);
  const [modificado, setModificado] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const refAlerta = useRef(null);

  const mostrar = useCallback((datos) => {
    setPlantilla(datos);
    setFormulario(aFormulario(datos));
    setModificado(false);
  }, []);

  useEffect(() => {
    if (!idInicial) return;
    obtenerPlantilla(idInicial)
      .then(mostrar)
      .catch((error) => setErrorCarga(error.message))
      .finally(() => setCargando(false));
  }, [idInicial, mostrar]);

  useEffect(() => {
    if (alerta) refAlerta.current?.focus();
  }, [alerta]);

  const soloLectura = Boolean(plantilla) && plantilla.estado !== "BORRADOR";
  const balance = useMemo(() => balancePesos(formulario.criterios), [formulario.criterios]);

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

  const cambiarCriterio = (indice, cambios, limpiar) =>
    editar(
      (actual) => ({
        ...actual,
        criterios: actual.criterios.map((c, i) => (i === indice ? { ...c, ...cambios(c) } : c)),
      }),
      `criterios[${indice}]`,
      limpiar
    );

  // Agregar o quitar elementos desplaza los índices con los que el servidor reportó los errores.
  const cambiarEstructura = (cambio) => editar(cambio, "criterios", null);

  const agregarCriterio = () =>
    cambiarEstructura((actual) => ({ ...actual, criterios: [...actual.criterios, nuevoCriterio()] }));

  const quitarCriterio = (indice) =>
    cambiarEstructura((actual) => ({ ...actual, criterios: actual.criterios.filter((_, i) => i !== indice) }));

  const agregarPregunta = (indice) =>
    cambiarEstructura((actual) => ({
      ...actual,
      criterios: actual.criterios.map((c, i) => (i === indice ? { ...c, preguntas: [...c.preguntas, nuevaPregunta()] } : c)),
    }));

  const quitarPregunta = (indiceCriterio, indicePregunta) =>
    cambiarEstructura((actual) => ({
      ...actual,
      criterios: actual.criterios.map((c, i) =>
        i === indiceCriterio ? { ...c, preguntas: c.preguntas.filter((_, j) => j !== indicePregunta) } : c
      ),
    }));

  const cambiarPregunta = (indiceCriterio, indicePregunta) => (pregunta, limpiar) =>
    editar(
      (actual) => ({
        ...actual,
        criterios: actual.criterios.map((c, i) =>
          i === indiceCriterio ? { ...c, preguntas: c.preguntas.map((p, j) => (j === indicePregunta ? pregunta : p)) } : c
        ),
      }),
      `criterios[${indiceCriterio}].preguntas[${indicePregunta}]`,
      limpiar
    );

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

  // Guarda el formulario y devuelve la plantilla guardada; si falla, muestra los errores y devuelve null.
  const guardarFormulario = async () => {
    setAlerta(null);
    try {
      const datos = aDatos(formulario);
      const guardada = plantilla ? await actualizarPlantilla(plantilla.id_plantilla, datos) : await crearPlantilla(datos);
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
        mostrar(await publicarPlantilla(guardada.id_plantilla));
        avisar({ tono: "exito", titulo: "Plantilla publicada", mensaje: `${guardada.nombre} · versión ${guardada.version}` });
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
      const borrador = await crearVersionPlantilla(plantilla.id_plantilla);
      onAbrir(borrador.id_plantilla);
      avisar({ tono: "exito", titulo: `Versión ${borrador.version} en borrador`, mensaje: borrador.nombre });
    } catch (error) {
      fallo("No se pudo crear la nueva versión", error);
      setProcesando(null);
    }
  };

  const volver = () => (modificado && !soloLectura ? setConfirmar("descartar") : onVolver());

  const estado = ESTADOS[plantilla?.estado ?? "BORRADOR"];
  const ocupado = Boolean(procesando);
  const titulo = plantilla ? plantilla.nombre : "Nueva plantilla";

  const acciones = soloLectura ? (
    <Boton variante="primario" icono={CopyPlus} onClick={crearVersion} cargando={procesando === "version"}>
      Crear nueva versión
    </Boton>
  ) : (
    <>
      <Boton icono={Save} onClick={guardar} cargando={procesando === "guardar"} disabled={ocupado}>
        Guardar borrador
      </Boton>
      <Boton
        variante="primario"
        icono={Send}
        onClick={() => setConfirmar("publicar")}
        cargando={procesando === "publicar"}
        disabled={ocupado}
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
            {plantilla && <span>Versión {plantilla.version}</span>}
          </span>
        }
        acciones={acciones}
      />

      {soloLectura && (
        <Alerta tono="info" titulo={`Esta versión está ${estado.etiqueta.toLowerCase()} y no se puede modificar.`}>
          Para cambiar preguntas o pesos, cree una nueva versión. Las evaluaciones en curso conservan la versión con la que
          empezaron.
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
            <div className="plantilla-campos">
              <CampoTexto
                id="nombre"
                etiqueta="Nombre"
                requerido
                maxLength={120}
                autoComplete="off"
                value={formulario.nombre}
                onChange={cambiarCampo("nombre")}
                error={errores.nombre}
              />
              <CampoAreaTexto
                id="descripcion"
                etiqueta="Descripción"
                filas={2}
                maxLength={500}
                value={formulario.descripcion}
                onChange={cambiarCampo("descripcion")}
                error={errores.descripcion}
              />
            </div>
          </Tarjeta>

          {errores.criterios && (
            <p className="plantilla-error" role="alert">
              {errores.criterios}
            </p>
          )}

          {formulario.criterios.map((criterio, indice) => {
            const ruta = `criterios[${indice}]`;
            return (
              <Tarjeta
                key={criterio.clave}
                className="plantilla-criterio"
                titulo={`Criterio ${indice + 1}${criterio.nombre ? `: ${criterio.nombre}` : ""}`}
                nivelTitulo={2}
                acciones={
                  <>
                    <Contador aria-label={`Peso del criterio: ${formatearPorcentaje(pesoCriterio(criterio))}`}>
                      {formatearPorcentaje(pesoCriterio(criterio))}
                    </Contador>
                    {!soloLectura && (
                      <Boton
                        variante="sutil"
                        soloIcono
                        icono={Trash2}
                        aria-label={`Eliminar criterio ${indice + 1}`}
                        title="Eliminar criterio"
                        onClick={() => quitarCriterio(indice)}
                      />
                    )}
                  </>
                }
              >
                <div className="plantilla-campos">
                  <CampoTexto
                    id={`${ruta}.nombre`}
                    etiqueta="Nombre del criterio"
                    requerido
                    maxLength={120}
                    autoComplete="off"
                    value={criterio.nombre}
                    onChange={(e) => cambiarCriterio(indice, () => ({ nombre: e.target.value }), ["nombre"])}
                    error={errores[`${ruta}.nombre`]}
                  />
                  <CampoTexto
                    id={`${ruta}.descripcion`}
                    etiqueta="Descripción"
                    maxLength={500}
                    value={criterio.descripcion}
                    onChange={(e) => cambiarCriterio(indice, () => ({ descripcion: e.target.value }), ["descripcion"])}
                    error={errores[`${ruta}.descripcion`]}
                  />
                </div>

                <ol className="plantilla-preguntas">
                  {criterio.preguntas.map((pregunta, indicePregunta) => (
                    <PreguntaEditor
                      key={pregunta.clave}
                      pregunta={pregunta}
                      numero={`${indice + 1}.${indicePregunta + 1}`}
                      ruta={`${ruta}.preguntas[${indicePregunta}]`}
                      errores={errores}
                      soloLectura={soloLectura}
                      onCambiar={cambiarPregunta(indice, indicePregunta)}
                      onEliminar={() => quitarPregunta(indice, indicePregunta)}
                    />
                  ))}
                </ol>
                {criterio.preguntas.length === 0 && <p className="plantilla-nota">Este criterio aún no tiene preguntas.</p>}
                {!soloLectura && (
                  <Boton variante="sutil" icono={Plus} onClick={() => agregarPregunta(indice)}>
                    Agregar pregunta
                  </Boton>
                )}
              </Tarjeta>
            );
          })}

          {!soloLectura && (
            <Boton icono={Plus} onClick={agregarCriterio} className="plantilla-agregar-criterio">
              Agregar criterio
            </Boton>
          )}
        </fieldset>

        <aside className="plantilla-lateral" aria-label="Balance de ponderaciones">
          <BalancePesos balance={balance} />
          <ul className="plantilla-resumen">
            {formulario.criterios.map((criterio, indice) => (
              <li key={criterio.clave}>
                <span className="plantilla-resumen__nombre" title={criterio.nombre}>
                  {criterio.nombre || `Criterio ${indice + 1}`}
                </span>
                <span>{formatearPorcentaje(pesoCriterio(criterio))}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <ModalConfirmacion
        abierto={confirmar === "publicar"}
        titulo="¿Publicar la plantilla?"
        textoConfirmar="Publicar"
        variante="primario"
        onConfirmar={publicar}
        onCancelar={() => setConfirmar(null)}
      >
        Se guardarán los cambios y la plantilla quedará disponible para evaluar. Después no podrá modificar sus preguntas ni
        pesos: tendrá que crear una nueva versión.
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
