import { useEffect, useRef, useState } from "react";
import { Ban, CircleCheck } from "lucide-react";
import { revisarHorasExtra } from "../../api/horasExtra";
import { Alerta, Boton, CampoAreaTexto, CampoTexto, Etiqueta, Modal } from "../../components/ui";
import { ESTADOS_HORAS, formatearFechaHora, formatearHora, formatearJornada, formatearMinutos } from "./formato";

const MAX_COMENTARIO = 500;
// Ley General del Trabajo: hasta 2 horas extra simples por día; el resto se paga doble.
const MINUTOS_SIMPLES_DIA = 120;

const valorInicial = (j) => j.minutos_extra_aprobados || j.minutos_extra || j.minutos_extra + j.minutos_anticipados;

// Cómo se pagarían los minutos aprobados: lo mismo que calcula el servicio.
function vistaPago(minutos, feriado) {
  if (!Number.isInteger(minutos) || minutos <= 0) return "Sin horas extra a pagar.";
  if (feriado) return `Se pagarán ${formatearMinutos(minutos)} dobles (feriado).`;
  const simples = Math.min(minutos, MINUTOS_SIMPLES_DIA);
  const dobles = minutos - simples;
  return `Se pagarán ${formatearMinutos(simples)} simples${dobles ? ` y ${formatearMinutos(dobles)} dobles` : ""}.`;
}

function Conciliacion({ jornada }) {
  const marcado = jornada.minutos_extra + jornada.minutos_anticipados;
  const autorizado = jornada.autorizacion?.minutos_autorizados ?? null;
  return (
    <dl className="he-detalle">
      <div>
        <dt>Jornada</dt>
        <dd>
          <span className="he-capital">{formatearJornada(jornada.fecha_jornada)}</span>
          {jornada.turno
            ? ` · ${jornada.turno.nombre}, ${formatearHora(jornada.turno.inicio_programado)}–${formatearHora(jornada.turno.fin_programado)}`
            : " · Sin turno (descanso)"}
          {jornada.feriado && ` · Feriado: ${jornada.feriado}`}
        </dd>
      </div>
      <div>
        <dt>Marcaje</dt>
        <dd>
          {formatearHora(jornada.entrada_en)}–{formatearHora(jornada.salida_en)} (
          {formatearMinutos(jornada.minutos_trabajados)})
        </dd>
      </div>
      <div>
        <dt>Ordinarias</dt>
        <dd>
          {formatearMinutos(jornada.minutos_ordinarios)}
          {jornada.minutos_ordinarios_nocturnos > 0 &&
            `, ${formatearMinutos(jornada.minutos_ordinarios_nocturnos)} nocturnas`}
        </dd>
      </div>
      <div>
        <dt>Marcado en reloj</dt>
        <dd>
          {jornada.minutos_extra > 0 &&
            `${formatearMinutos(jornada.minutos_extra)} ${jornada.turno ? "después del turno" : "trabajadas"}`}
          {jornada.minutos_extra > 0 && jornada.minutos_anticipados > 0 && " · "}
          {jornada.minutos_anticipados > 0 && `${formatearMinutos(jornada.minutos_anticipados)} antes del turno`}
        </dd>
      </div>
      <div>
        <dt>Autorización previa</dt>
        <dd>
          {jornada.autorizacion
            ? `${formatearMinutos(autorizado)} por ${jornada.autorizacion.autorizador.nombre_completo}: «${jornada.autorizacion.motivo}»`
            : "Sin autorización previa"}
        </dd>
      </div>
      {autorizado !== null && marcado > autorizado && (
        <div>
          <dt>Diferencia</dt>
          <dd>{formatearMinutos(marcado - autorizado)} marcadas sin autorizar</dd>
        </div>
      )}
    </dl>
  );
}

// Revisión de las horas extra de una jornada: aprobar lo marcado, ajustar los minutos o rechazar.
// Se monta al abrir una jornada (con `key`), así el formulario empieza con sus valores.
export default function RevisionHorasExtra({ jornada, revisor, onCerrar, onRevisada }) {
  const [minutos, setMinutos] = useState(() => String(valorInicial(jornada)));
  const [comentario, setComentario] = useState("");
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [decidiendo, setDecidiendo] = useState(null);
  const refMinutos = useRef(null);
  const refComentario = useRef(null);
  const refError = useRef(null);

  useEffect(() => {
    if (errorGeneral) refError.current?.focus();
  }, [errorGeneral]);

  const marcado = jornada.minutos_extra + jornada.minutos_anticipados;
  const valor = Number(minutos);
  const editable = !jornada.consolidada && Boolean(revisor);
  const estado = ESTADOS_HORAS[jornada.estado.codigo];

  const cerrar = () => {
    if (!decidiendo) onCerrar();
  };

  const decidir = async (decision) => {
    const nuevos = {};
    if (decision === "APROBADA" && (!Number.isInteger(valor) || valor <= 0 || valor > marcado)) {
      nuevos.minutos = `Apruebe entre 1 y ${marcado} minutos: lo marcado fuera del turno.`;
    }
    const ajusta = decision === "APROBADA" && valor !== jornada.minutos_extra;
    if ((decision === "RECHAZADA" || ajusta) && !comentario.trim()) {
      nuevos.comentario =
        decision === "RECHAZADA" ? "Explique el motivo del rechazo." : "Explique el motivo del ajuste.";
    }
    setErrores(nuevos);
    setErrorGeneral(null);
    if (nuevos.minutos) return refMinutos.current?.focus();
    if (nuevos.comentario) return refComentario.current?.focus();

    setDecidiendo(decision);
    try {
      const revisada = await revisarHorasExtra(jornada.id_horas_jornada, revisor.id, {
        decision,
        minutosAprobados: decision === "APROBADA" ? valor : undefined,
        comentario: comentario.trim() || undefined,
      });
      onRevisada(revisada);
    } catch (error) {
      const deCampo = Object.fromEntries(
        (error.detalles ?? []).map((d) => [d.campo === "minutos_aprobados" ? "minutos" : d.campo, d.mensaje])
      );
      if (deCampo.minutos || deCampo.comentario) setErrores(deCampo);
      else setErrorGeneral(error.message);
    } finally {
      setDecidiendo(null);
    }
  };

  const atajos = [
    jornada.minutos_extra > 0 && { etiqueta: "Lo marcado después del turno", valor: jornada.minutos_extra },
    jornada.autorizacion && {
      etiqueta: "Lo autorizado",
      valor: Math.min(jornada.autorizacion.minutos_autorizados, marcado),
    },
    jornada.minutos_anticipados > 0 && { etiqueta: "Todo lo marcado", valor: marcado },
  ].filter(Boolean);

  return (
    <Modal
      abierto
      titulo={`Horas extra de ${jornada.empleado.nombre_completo}`}
      onCerrar={cerrar}
      bloqueado={Boolean(decidiendo)}
      pie={
        editable ? (
          <>
            <Boton variante="sutil" onClick={cerrar} disabled={Boolean(decidiendo)}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              icono={Ban}
              onClick={() => decidir("RECHAZADA")}
              cargando={decidiendo === "RECHAZADA"}
              disabled={Boolean(decidiendo)}
            >
              Rechazar
            </Boton>
            <Boton
              variante="primario"
              icono={CircleCheck}
              onClick={() => decidir("APROBADA")}
              cargando={decidiendo === "APROBADA"}
              disabled={Boolean(decidiendo)}
            >
              Aprobar
            </Boton>
          </>
        ) : (
          <Boton onClick={cerrar} data-autofocus>
            Cerrar
          </Boton>
        )
      }
    >
      <div className="he-revision">
        <p className="he-revision__estado">
          <Etiqueta tono={estado.tono} icono={estado.icono}>
            {estado.texto}
          </Etiqueta>
          {jornada.minutos_extra_aprobados > 0 && (
            <span className="he-sutil">{formatearMinutos(jornada.minutos_extra_aprobados)} aprobadas</span>
          )}
        </p>
        <Conciliacion jornada={jornada} />

        {jornada.revision && (
          <Alerta tono="info" titulo="Última revisión">
            <p>
              Por {jornada.revision.nombre_revisor} el {formatearFechaHora(jornada.revision.revisada_en)}.
            </p>
            {jornada.revision.comentario && <p>Comentario: {jornada.revision.comentario}</p>}
          </Alerta>
        )}
        {jornada.consolidada && (
          <Alerta tono="aviso" titulo="Periodo consolidado">
            La jornada ya se envió a planillas y no se puede modificar.
          </Alerta>
        )}
        {!jornada.consolidada && !revisor && (
          <Alerta tono="aviso" titulo="Identifíquese para decidir">
            Ingrese su identificador de empleado en esta pantalla para aprobar, ajustar o rechazar.
          </Alerta>
        )}
        {errorGeneral && (
          <Alerta ref={refError} tabIndex={-1} tono="peligro" role="alert" titulo="No se pudo registrar la decisión">
            {errorGeneral}
          </Alerta>
        )}

        {editable && (
          <>
            <div className="he-revision__minutos">
              <CampoTexto
                ref={refMinutos}
                type="number"
                inputMode="numeric"
                min={1}
                max={marcado}
                step={1}
                etiqueta="Minutos a aprobar"
                value={minutos}
                onChange={(e) => {
                  setMinutos(e.target.value);
                  if (errores.minutos) setErrores((actual) => ({ ...actual, minutos: undefined }));
                }}
                error={errores.minutos}
                ayuda={`${Number.isInteger(valor) && valor > 0 ? `${formatearMinutos(valor)}. ` : ""}${vistaPago(valor, Boolean(jornada.feriado))}`}
                disabled={Boolean(decidiendo)}
                data-autofocus
              />
              {atajos.length > 0 && (
                <div className="he-atajos" role="group" aria-label="Valores sugeridos">
                  {atajos.map((a) => (
                    <Boton
                      key={a.etiqueta}
                      tamano="sm"
                      variante={valor === a.valor ? "primario" : "predeterminado"}
                      aria-pressed={valor === a.valor}
                      onClick={() => setMinutos(String(a.valor))}
                      disabled={Boolean(decidiendo)}
                    >
                      {a.etiqueta} ({formatearMinutos(a.valor)})
                    </Boton>
                  ))}
                </div>
              )}
            </div>
            <CampoAreaTexto
              ref={refComentario}
              etiqueta="Comentario"
              filas={3}
              maxLength={MAX_COMENTARIO}
              value={comentario}
              onChange={(e) => {
                setComentario(e.target.value);
                if (errores.comentario) setErrores((actual) => ({ ...actual, comentario: undefined }));
              }}
              error={errores.comentario}
              ayuda={`Obligatorio si ajusta los minutos o rechaza. ${comentario.length} de ${MAX_COMENTARIO} caracteres.`}
              disabled={Boolean(decidiendo)}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
