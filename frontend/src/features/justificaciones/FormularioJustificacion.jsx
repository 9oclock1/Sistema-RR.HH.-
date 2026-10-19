import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { enviarJustificacion } from "../../api/justificaciones";
import { Alerta, Boton, CampoAreaTexto, Modal, Selector } from "../../components/ui";
import ZonaComprobantes from "./ZonaComprobantes";
import { describirNovedad, formatearFechaHora, formatearJornada, tiempoRestante } from "./formato";

const MAX_DESCRIPCION = 500;
// Campos de la API y del formulario.
const CAMPOS = { id_motivo: "jf-motivo", descripcion: "jf-descripcion", archivos: "jf-archivos" };
const ETIQUETAS = { id_motivo: "Motivo", descripcion: "Descripción", archivos: "Comprobantes" };
const VACIO = { idMotivo: "", descripcion: "", archivos: [] };

function validar({ idMotivo, descripcion, archivos }, motivos) {
  const errores = {};
  const motivo = motivos.find((m) => String(m.id_motivo) === idMotivo);
  if (!motivo) errores.id_motivo = "Seleccione el motivo.";
  if (descripcion.trim().length > MAX_DESCRIPCION) errores.descripcion = `Use como máximo ${MAX_DESCRIPCION} caracteres.`;
  else if (motivo?.codigo === "OTRO" && !descripcion.trim()) errores.descripcion = "Describa el motivo.";
  if (archivos.length === 0) errores.archivos = "Adjunte al menos un comprobante.";
  return errores;
}

export default function FormularioJustificacion({ novedad, idEmpleado, motivos, ahora, onCerrar, onEnviada }) {
  const [datos, setDatos] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [intentos, setIntentos] = useState(0);
  const refResumen = useRef(null);

  useEffect(() => {
    if (intentos) refResumen.current?.focus();
  }, [intentos]);

  const abierto = Boolean(novedad);
  const motivo = motivos.find((m) => String(m.id_motivo) === datos.idMotivo);
  const descripcionRequerida = motivo?.codigo === "OTRO";

  const cambiar = (campo, valor) => {
    setDatos((actual) => ({ ...actual, [campo]: valor }));
    const clave = { idMotivo: "id_motivo", descripcion: "descripcion", archivos: "archivos" }[campo];
    if (errores[clave]) {
      setErrores((actuales) => {
        const resto = { ...actuales };
        delete resto[clave];
        return resto;
      });
    }
  };

  const cerrar = () => {
    if (enviando) return;
    setDatos(VACIO);
    setErrores({});
    setErrorGeneral(null);
    onCerrar();
  };

  const fallar = (nuevos, general = null) => {
    setErrores(nuevos);
    setErrorGeneral(general);
    setIntentos((n) => n + 1);
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    const encontrados = validar(datos, motivos);
    if (Object.keys(encontrados).length > 0) return fallar(encontrados);

    setEnviando(true);
    try {
      const solicitud = await enviarJustificacion(idEmpleado, {
        idNovedad: novedad.id_novedad,
        idMotivo: datos.idMotivo,
        descripcion: datos.descripcion.trim(),
        archivos: datos.archivos,
      });
      setDatos(VACIO);
      setErrores({});
      setErrorGeneral(null);
      onEnviada(solicitud);
    } catch (error) {
      const porCampo = {};
      for (const { campo, mensaje } of error.detalles ?? []) {
        if (CAMPOS[campo] && !porCampo[campo]) porCampo[campo] = mensaje;
      }
      const sinCampo = Object.keys(porCampo).length === 0;
      fallar(porCampo, sinCampo ? error.message : null);
    } finally {
      setEnviando(false);
    }
  };

  const listaErrores = Object.entries(errores);
  const restante = novedad ? tiempoRestante(novedad.plazo.vence_en, ahora) : null;

  return (
    <Modal
      abierto={abierto}
      titulo="Justificar novedad"
      onCerrar={cerrar}
      bloqueado={enviando}
      pie={
        <>
          <Boton variante="sutil" onClick={cerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form="jf-formulario" icono={Send} cargando={enviando}>
            {enviando ? "Enviando…" : "Enviar justificativo"}
          </Boton>
        </>
      }
    >
      {novedad && (
        <form id="jf-formulario" className="jf-formulario" onSubmit={enviar} noValidate>
          <dl className="jf-resumen-novedad">
            <div>
              <dt>Novedad</dt>
              <dd>
                {novedad.tipo.nombre} del {formatearJornada(novedad.fecha_jornada)}: {describirNovedad(novedad)}
              </dd>
            </div>
            <div>
              <dt>Plazo</dt>
              <dd>
                Hasta el <time dateTime={novedad.plazo.vence_en}>{formatearFechaHora(novedad.plazo.vence_en)}</time>
                {restante && ` (${restante})`}
              </dd>
            </div>
          </dl>

          {(listaErrores.length > 0 || errorGeneral) && (
            <Alerta
              ref={refResumen}
              tabIndex={-1}
              tono="peligro"
              role="alert"
              titulo={errorGeneral ? "No se pudo enviar el justificativo" : "Revise los datos del formulario"}
            >
              {errorGeneral ? (
                <p>{errorGeneral}</p>
              ) : (
                <ul className="jf-lista-errores">
                  {listaErrores.map(([campo, mensaje]) => (
                    <li key={campo}>
                      <a
                        href={`#${CAMPOS[campo]}`}
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById(CAMPOS[campo])?.focus();
                        }}
                      >
                        {ETIQUETAS[campo]}: {mensaje}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Alerta>
          )}

          <Selector
            id={CAMPOS.id_motivo}
            etiqueta="Motivo"
            requerido
            value={datos.idMotivo}
            onChange={(e) => cambiar("idMotivo", e.target.value)}
            opciones={motivos.map((m) => ({ valor: String(m.id_motivo), etiqueta: m.nombre }))}
            textoVacio="Seleccione…"
            error={errores.id_motivo}
            disabled={enviando}
            data-autofocus
          />
          <CampoAreaTexto
            id={CAMPOS.descripcion}
            etiqueta="Descripción"
            requerido={descripcionRequerida}
            filas={3}
            value={datos.descripcion}
            onChange={(e) => cambiar("descripcion", e.target.value)}
            maxLength={MAX_DESCRIPCION}
            error={errores.descripcion}
            ayuda={`${descripcionRequerida ? "Explique qué ocurrió." : "Opcional."} ${datos.descripcion.length} de ${MAX_DESCRIPCION} caracteres.`}
            disabled={enviando}
          />
          <ZonaComprobantes
            id={CAMPOS.archivos}
            archivos={datos.archivos}
            onCambiar={(lista) => cambiar("archivos", lista)}
            error={errores.archivos}
            deshabilitado={enviando}
          />
          <p className="jf-nota">
            Su jefatura o RRHH revisará el justificativo. Si lo aprueban, se quita la penalización de esta novedad.
          </p>
        </form>
      )}
    </Modal>
  );
}
