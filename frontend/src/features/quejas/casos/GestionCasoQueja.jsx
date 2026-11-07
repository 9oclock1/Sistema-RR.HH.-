import { useState } from "react";
import { ClipboardList, RotateCw, Save } from "lucide-react";
import {
  cambiarEstadoQueja,
  registrarAccionQueja,
  reintentarAvisoResolucionQueja,
} from "../../../api/casosQueja";
import {
  Alerta,
  Boton,
  CampoAreaTexto,
  Etiqueta,
  GrupoRadios,
  ModalConfirmacion,
  Tarjeta,
  useAvisos,
} from "../../../components/ui";
import { ACCION, AVISOS, ESTADO_RESUELTA, RESOLUCION, validarAccion, validarCambioEstado } from "./casos";

function erroresDelServidor(error) {
  return Object.fromEntries((error.detalles ?? []).filter((d) => d.campo).map((d) => [d.campo, d.mensaje]));
}

function useEnvio() {
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (tarea) => {
    setErrorGeneral(null);
    setEnviando(true);
    try {
      await tarea();
      return true;
    } catch (error) {
      const delServidor = erroresDelServidor(error);
      if (error.estado === 400 && Object.keys(delServidor).length > 0) setErrores(delServidor);
      else setErrorGeneral(error.message);
      return false;
    } finally {
      setEnviando(false);
    }
  };

  return { errores, setErrores, errorGeneral, enviando, enviar };
}

function CambioEstado({ caso, gestion, sesion, onActualizado }) {
  const avisar = useAvisos();
  const [idEstado, setIdEstado] = useState("");
  const [resolucion, setResolucion] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const { errores, setErrores, errorGeneral, enviando, enviar } = useEnvio();

  const estado = gestion.transiciones.find((t) => String(t.id_estado_queja) === idEstado) ?? null;
  const resuelve = estado?.codigo === ESTADO_RESUELTA;

  const guardar = async () => {
    const correcto = await enviar(async () => {
      const resultado = await cambiarEstadoQueja(sesion, caso.id_queja, {
        idEstado: estado.id_estado_queja,
        resolucion: resuelve ? resolucion.trim() : undefined,
      });
      avisar({ tono: "exito", titulo: "Estado actualizado", mensaje: `El caso pasó a «${resultado.estado.nombre}».` });
      if (resultado.aviso_resolucion && resultado.aviso_resolucion.estado !== "ENTREGADO") {
        avisar({
          tono: "aviso",
          titulo: "No se pudo avisar a quien presentó la queja",
          mensaje: "La resolución quedó registrada. Puede reintentar el aviso.",
        });
      }
    });
    setConfirmando(false);
    if (correcto) onActualizado();
  };

  const enviarFormulario = (evento) => {
    evento.preventDefault();
    const encontrados = validarCambioEstado({ estado, resolucion });
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;
    if (resuelve) setConfirmando(true);
    else guardar();
  };

  const elegirEstado = (valor) => {
    setIdEstado(valor);
    setErrores({});
  };

  return (
    <Tarjeta nivelTitulo={2} titulo="Estado del caso" className="qc-tarjeta">
      <form className="qc-formulario" onSubmit={enviarFormulario} noValidate>
        <div className="qc-etiquetas">
          <span className="qc-ayuda">Estado actual:</span>
          <Etiqueta>{caso.estado.nombre}</Etiqueta>
        </div>
        <GrupoRadios
          leyenda="Nuevo estado"
          requerido
          opciones={gestion.transiciones.map((t) => ({ valor: String(t.id_estado_queja), etiqueta: t.nombre }))}
          value={idEstado}
          onChange={elegirEstado}
          error={errores.id_estado_queja}
          disabled={enviando}
        />
        {resuelve && (
          <CampoAreaTexto
            etiqueta="Descripción de la resolución"
            requerido
            filas={5}
            maxLength={RESOLUCION.MAX}
            ayuda="Se guarda cifrada. Quien presentó la queja solo recibe el aviso de que se resolvió, no este texto."
            value={resolucion}
            onChange={(e) => setResolucion(e.target.value)}
            error={errores.resolucion}
            disabled={enviando}
          />
        )}
        {errorGeneral && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo cambiar el estado">
            {errorGeneral}
          </Alerta>
        )}
        <div className="qc-acciones">
          <Boton type="submit" variante="primario" icono={Save} cargando={enviando && !confirmando}>
            {resuelve ? "Marcar como resuelto" : "Cambiar estado"}
          </Boton>
        </div>
      </form>
      <ModalConfirmacion
        abierto={confirmando}
        titulo="¿Marcar el caso como resuelto?"
        textoConfirmar="Marcar como resuelto"
        variante="primario"
        procesando={enviando}
        onConfirmar={guardar}
        onCancelar={() => setConfirmando(false)}
      >
        <p className="qc-texto">
          El caso quedará cerrado y ya no admitirá acciones ni cambios de estado.{" "}
          {caso.es_anonima
            ? "La queja es anónima: no se avisará a nadie."
            : "Se avisará a quien presentó la queja que su caso fue resuelto."}
        </p>
      </ModalConfirmacion>
    </Tarjeta>
  );
}

function RegistroAccion({ caso, gestion, sesion, onActualizado }) {
  const avisar = useAvisos();
  const [idTipo, setIdTipo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const { errores, setErrores, errorGeneral, enviando, enviar } = useEnvio();

  const registrar = async (evento) => {
    evento.preventDefault();
    const encontrados = validarAccion({ idTipo, descripcion });
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;
    const correcto = await enviar(async () => {
      const accion = await registrarAccionQueja(sesion, caso.id_queja, {
        idTipo: Number(idTipo),
        descripcion: descripcion.trim(),
      });
      avisar({ tono: "exito", titulo: "Acción registrada", mensaje: `Acción ${accion.tipo.nombre.toLowerCase()} en la bitácora.` });
    });
    if (correcto) {
      setIdTipo("");
      setDescripcion("");
      onActualizado();
    }
  };

  return (
    <Tarjeta nivelTitulo={2} titulo="Registrar acción" className="qc-tarjeta">
      <form className="qc-formulario" onSubmit={registrar} noValidate>
        <GrupoRadios
          leyenda="Tipo de acción"
          requerido
          opciones={gestion.tipos_accion.map((t) => ({ valor: String(t.id_tipo_accion_queja), etiqueta: t.nombre }))}
          value={idTipo}
          onChange={setIdTipo}
          error={errores.id_tipo_accion_queja}
          disabled={enviando}
        />
        <CampoAreaTexto
          etiqueta="Descripción de la acción"
          requerido
          maxLength={ACCION.MAX}
          ayuda={`Entre ${ACCION.MIN} y ${ACCION.MAX} caracteres. Se guarda cifrada; la fecha y su nombre se registran solos y no se pueden editar.`}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          error={errores.descripcion}
          disabled={enviando}
        />
        {errorGeneral && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo registrar la acción">
            {errorGeneral}
          </Alerta>
        )}
        <div className="qc-acciones">
          <Boton type="submit" variante="primario" icono={ClipboardList} cargando={enviando}>
            Registrar acción
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

function AvisoResolucion({ caso, seguimiento, sesion, onActualizado }) {
  const avisar = useAvisos();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const aviso = seguimiento.resolucion?.aviso;
  if (!aviso) return null;
  const tono = AVISOS[aviso.estado.codigo] ?? AVISOS.PENDIENTE;

  const reintentar = async () => {
    setError(null);
    setEnviando(true);
    try {
      const resultado = await reintentarAvisoResolucionQueja(sesion, caso.id_queja);
      if (resultado.estado === "ENTREGADO") avisar({ tono: "exito", titulo: "Aviso entregado", mensaje: `Queja ${caso.codigo_seguimiento}.` });
      else avisar({ tono: "aviso", titulo: "El aviso sigue sin entregarse", mensaje: "Intente nuevamente en unos minutos." });
      onActualizado();
    } catch (falla) {
      setError(falla.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Tarjeta nivelTitulo={2} titulo="Aviso a quien presentó la queja" className="qc-tarjeta">
      <div className="qc-etiquetas">
        <Etiqueta tono={tono.tono}>{tono.texto}</Etiqueta>
      </div>
      <p className="qc-ayuda">El aviso solo dice que el caso se resolvió e incluye el código de seguimiento.</p>
      {error && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo reintentar el aviso">
          {error}
        </Alerta>
      )}
      {seguimiento.gestion.puede_reintentar_aviso && (
        <div className="qc-acciones">
          <Boton icono={RotateCw} onClick={reintentar} cargando={enviando}>
            Reintentar aviso
          </Boton>
        </div>
      )}
    </Tarjeta>
  );
}

export default function GestionCasoQueja({ caso, seguimiento, sesion, onActualizado }) {
  const { gestion } = seguimiento;
  return (
    <>
      {gestion.puede_actuar && gestion.transiciones.length > 0 && (
        <CambioEstado key={caso.actualizada_en} caso={caso} gestion={gestion} sesion={sesion} onActualizado={onActualizado} />
      )}
      {gestion.puede_registrar_acciones && (
        <RegistroAccion caso={caso} gestion={gestion} sesion={sesion} onActualizado={onActualizado} />
      )}
      <AvisoResolucion caso={caso} seguimiento={seguimiento} sesion={sesion} onActualizado={onActualizado} />
    </>
  );
}
