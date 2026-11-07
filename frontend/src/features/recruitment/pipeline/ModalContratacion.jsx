import { useEffect, useState } from "react";
import { Alerta, Boton, CampoAreaTexto, Casilla, Modal, Selector } from "../../../components/ui";
import { obtenerIntegraciones, reintentarIntegracion } from "../../../api/pipelineSeleccion";
import ListaIntegraciones from "./ListaIntegraciones";
import { formatearAfinidad, nombreCompleto } from "./reglas";

const MAX_OBSERVACIONES = 1000;
// Mientras alguna alta siga en curso se consulta su estado; el despachador envía cada pocos segundos.
const INTERVALO_ESTADO_MS = 3000;

const errorDeCampo = (error, campo) => error?.errores?.find((e) => e.campo === campo)?.mensaje;

/**
 * RF-14: formaliza la contratación (cargo operativo y confirmación del reclutador) y, una vez contratado,
 * muestra cómo avanza su alta en Contabilidad y en el módulo operativo del cargo.
 */
export default function ModalContratacion({ postulacion, convocatoria, idEtapaContratado, cargos, sesion, onCerrar, onContratar }) {
  const [idCargo, setIdCargo] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);
  const [contratacion, setContratacion] = useState(null);
  const [integraciones, setIntegraciones] = useState([]);
  const [errorEstado, setErrorEstado] = useState(null);
  const [reintentando, setReintentando] = useState(null);
  const [consulta, setConsulta] = useState(0);

  const nombre = nombreCompleto(postulacion);
  const cargo = cargos.find((c) => String(c.id_cargo_operativo) === idCargo);
  const afinidad = formatearAfinidad(postulacion.porcentaje_afinidad);
  const enCurso = integraciones.some((evento) => evento.estado === "PENDIENTE");

  useEffect(() => {
    if (!contratacion) return undefined;
    const controlador = new AbortController();
    obtenerIntegraciones(postulacion.id_postulacion, { signal: controlador.signal })
      .then((lista) => {
        setIntegraciones(lista);
        setErrorEstado(null);
      })
      .catch((falla) => falla.name !== "AbortError" && setErrorEstado(falla.message));
    return () => controlador.abort();
  }, [contratacion, consulta, postulacion.id_postulacion]);

  useEffect(() => {
    if (!enCurso) return undefined;
    const temporizador = setTimeout(() => setConsulta((n) => n + 1), INTERVALO_ESTADO_MS);
    return () => clearTimeout(temporizador);
  }, [enCurso, integraciones]);

  const contratar = async (evento) => {
    evento.preventDefault();
    if (!cargo || !confirmado) return;
    setProcesando(true);
    setError(null);
    try {
      const respuesta = await onContratar({
        id_etapa: idEtapaContratado,
        id_cargo_operativo: cargo.id_cargo_operativo,
        ...(observaciones.trim() && { motivo: observaciones.trim() }),
      });
      setIntegraciones(respuesta.data?.integraciones?.map((e) => ({ ...e, estado: "PENDIENTE", intentos: 0 })) ?? []);
      setContratacion({ cargo });
    } catch (falla) {
      setError(falla);
    } finally {
      setProcesando(false);
    }
  };

  const reintentar = async (eventoIntegracion) => {
    setReintentando(eventoIntegracion.id_evento);
    try {
      await reintentarIntegracion(eventoIntegracion.id_evento, sesion);
      setConsulta((n) => n + 1);
    } catch (falla) {
      setErrorEstado(falla.message);
    } finally {
      setReintentando(null);
    }
  };

  if (contratacion) {
    const todasEnviadas = integraciones.length > 0 && integraciones.every((e) => e.estado === "ENTREGADO");
    return (
      <Modal
        abierto
        titulo="Alta del colaborador"
        onCerrar={onCerrar}
        pie={
          <Boton variante="primario" onClick={onCerrar} data-autofocus>
            Listo
          </Boton>
        }
      >
        <div className="pl-detalle">
          <Alerta tono="exito" titulo={`${nombre} fue contratado como ${contratacion.cargo.nombre}`}>
            Su alta se envía a Contabilidad, como centro de costo y beneficiario, y a {contratacion.cargo.nombre_modulo}.
          </Alerta>
          <section className="pl-seccion" aria-labelledby="pl-titulo-confirmacion" aria-live="polite">
            <h3 id="pl-titulo-confirmacion" className="pl-seccion__titulo">
              {todasEnviadas ? "Alta confirmada en todos los módulos" : "Estado del alta"}
            </h3>
            {errorEstado && (
              <Alerta tono="peligro" role="alert">
                {errorEstado}
              </Alerta>
            )}
            <ListaIntegraciones integraciones={integraciones} reintentando={reintentando} onReintentar={reintentar} />
          </section>
          {!todasEnviadas && (
            <p className="pl-sutil">
              Puede cerrar esta ventana: el envío continúa en segundo plano y se reintenta solo si un módulo no responde.
            </p>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      abierto
      titulo="Formalizar contratación"
      onCerrar={onCerrar}
      bloqueado={procesando}
      pie={
        <>
          <Boton variante="sutil" onClick={onCerrar} disabled={procesando}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            form="pl-form-contratacion"
            variante="primario"
            cargando={procesando}
            disabled={!cargo || !confirmado}
          >
            Confirmar contratación
          </Boton>
        </>
      }
    >
      <form id="pl-form-contratacion" className="pl-formulario" onSubmit={contratar} noValidate>
        <dl className="pl-datos">
          <div>
            <dt>Candidato</dt>
            <dd>{nombre}</dd>
          </div>
          <div>
            <dt>Documento</dt>
            <dd>{postulacion.numero_documento ?? "—"}</dd>
          </div>
          <div>
            <dt>Contacto</dt>
            <dd>
              {postulacion.correo_electronico}
              {postulacion.telefono_contacto && ` · ${postulacion.telefono_contacto}`}
            </dd>
          </div>
          <div>
            <dt>Convocatoria</dt>
            <dd>
              {convocatoria.codigo_convocatoria} · {convocatoria.titulo_puesto}
            </dd>
          </div>
          <div>
            <dt>Afinidad</dt>
            <dd>{afinidad ?? "Sin evaluar"}</dd>
          </div>
        </dl>

        <Selector
          etiqueta="Cargo operativo"
          requerido
          value={idCargo}
          onChange={(e) => setIdCargo(e.target.value)}
          textoVacio="Seleccione el cargo"
          opciones={cargos.map((c) => ({ valor: String(c.id_cargo_operativo), etiqueta: c.nombre }))}
          ayuda={cargo ? `Sus datos se enviarán a ${cargo.nombre_modulo}.` : "Define a qué módulo operativo se envían sus datos."}
          error={errorDeCampo(error, "id_cargo_operativo")}
          data-autofocus
        />

        <CampoAreaTexto
          etiqueta="Observaciones (opcional)"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          maxLength={MAX_OBSERVACIONES}
          filas={3}
          ayuda={`${observaciones.length}/${MAX_OBSERVACIONES} caracteres. Quedan en el historial del postulante.`}
          error={errorDeCampo(error, "motivo")}
        />

        <Alerta tono="info" titulo="Al confirmar">
          <ul className="pl-pasos">
            <li>La postulación pasa a «Contratado» y se cierra el proceso de selección; no se puede deshacer.</li>
            <li>Se registra al colaborador en Contabilidad como centro de costo y beneficiario.</li>
            <li>Se envían sus datos a {cargo ? cargo.nombre_modulo : "el módulo operativo del cargo"}.</li>
          </ul>
        </Alerta>

        <Casilla
          etiqueta="Confirmo que el candidato aceptó la oferta y que sus datos son correctos."
          checked={confirmado}
          onChange={(e) => setConfirmado(e.target.checked)}
        />

        {error && !error.errores?.length && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo contratar">
            {error.message}
          </Alerta>
        )}
      </form>
    </Modal>
  );
}
