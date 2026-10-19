import { useEffect, useRef, useState } from "react";
import { FilePlus, ShieldCheck } from "lucide-react";
import { consultarMisNovedades, listarMotivos } from "../../api/justificaciones";
import { Alerta, Boton, Esqueleto, EstadoVacio, Etiqueta, Tarjeta, useAvisos } from "../../components/ui";
import FormularioJustificacion from "./FormularioJustificacion";
import { ESTADOS_SOLICITUD, describirNovedad, formatearFechaHora, formatearJornada, tiempoRestante } from "./formato";
import "./justificaciones.css";

const TONO_TIPO = { ATRASO: "aviso", SALIDA_ANTICIPADA: "aviso", INASISTENCIA: "peligro" };
// Con menos de 6 horas el plazo se resalta.
const PLAZO_CORTO_MS = 6 * 60 * 60 * 1000;

function EstadoNovedad({ novedad, ahora }) {
  const { solicitud, plazo } = novedad;
  if (novedad.estado.codigo === "JUSTIFICADA") {
    return (
      <>
        <Etiqueta tono="exito" icono={ShieldCheck}>
          Justificada
        </Etiqueta>
        {solicitud?.revision && (
          <span className="jf-sutil">
            Aprobada por {solicitud.revision.nombre_revisor} el {formatearFechaHora(solicitud.revision.revisada_en)}
          </span>
        )}
      </>
    );
  }
  if (solicitud?.estado.codigo === "PENDIENTE") {
    const { tono, icono } = ESTADOS_SOLICITUD.PENDIENTE;
    return (
      <>
        <Etiqueta tono={tono} icono={icono}>
          Pendiente de revisión
        </Etiqueta>
        <span className="jf-sutil">Enviada el {formatearFechaHora(solicitud.creado_en)}</span>
      </>
    );
  }
  const rechazada = solicitud?.estado.codigo === "RECHAZADA";
  return (
    <>
      {rechazada && (
        <Etiqueta tono="peligro" icono={ESTADOS_SOLICITUD.RECHAZADA.icono}>
          Rechazada
        </Etiqueta>
      )}
      {plazo.justificable ? (
        <span className={new Date(plazo.vence_en) - ahora < PLAZO_CORTO_MS ? "jf-plazo jf-plazo--corto" : "jf-plazo"}>
          Puede justificar hasta el <time dateTime={plazo.vence_en}>{formatearFechaHora(plazo.vence_en)}</time>
          {tiempoRestante(plazo.vence_en, ahora) && ` (${tiempoRestante(plazo.vence_en, ahora)})`}
        </span>
      ) : (
        plazo.razon === "VENCIDA" && (
          <span className="jf-sutil">
            El plazo venció el <time dateTime={plazo.vence_en}>{formatearFechaHora(plazo.vence_en)}</time>
          </span>
        )
      )}
    </>
  );
}

// Atrasos, faltas y salidas anticipadas del colaborador en los últimos 30 días, con su justificativo.
export default function MisNovedades({ idEmpleado }) {
  const [resultado, setResultado] = useState(null);
  const [motivos, setMotivos] = useState([]);
  const [intento, setIntento] = useState(0);
  const [seleccionada, setSeleccionada] = useState(null);
  const refsItems = useRef(new Map());
  // Tras enviar, el foco vuelve a la novedad: su botón desaparece al quedar pendiente.
  const enfocar = useRef(null);
  const avisar = useAvisos();

  useEffect(() => {
    let vigente = true;
    Promise.all([consultarMisNovedades(idEmpleado), listarMotivos()])
      .then(([datos, lista]) => {
        if (!vigente) return;
        setResultado({ datos });
        setMotivos(lista);
      })
      .catch((error) => vigente && setResultado({ error: error.message }));
    return () => {
      vigente = false;
    };
  }, [idEmpleado, intento]);

  useEffect(() => {
    if (!enfocar.current || !resultado?.datos) return;
    refsItems.current.get(enfocar.current)?.focus();
    enfocar.current = null;
  }, [resultado]);

  const reintentar = () => {
    setResultado(null);
    setIntento((n) => n + 1);
  };

  const alEnviar = (solicitud) => {
    setSeleccionada(null);
    avisar({
      tono: "exito",
      titulo: "Justificativo enviado",
      mensaje: "Le avisaremos aquí cuando su jefatura lo revise.",
    });
    enfocar.current = solicitud.id_novedad;
    setIntento((n) => n + 1);
  };

  // Hora del servidor al consultar: referencia para el tiempo restante de cada plazo.
  const ahora = resultado?.datos ? new Date(resultado.datos.generado_en).getTime() : 0;

  let contenido;
  if (!resultado) {
    contenido = (
      <div aria-busy="true">
        <p className="ds-solo-lector" role="status">
          Cargando sus novedades…
        </p>
        <Esqueleto />
        <Esqueleto />
      </div>
    );
  } else if (resultado.error) {
    contenido = (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudieron cargar sus novedades"
        acciones={
          <Boton tamano="sm" onClick={reintentar}>
            Reintentar
          </Boton>
        }
      >
        {resultado.error}
      </Alerta>
    );
  } else if (resultado.datos.novedades.length === 0) {
    contenido = (
      <EstadoVacio
        icono={ShieldCheck}
        titulo="Sin atrasos ni faltas"
        mensaje="No tiene novedades de asistencia en los últimos 30 días."
      />
    );
  } else {
    contenido = (
      <>
        <p className="jf-sutil">
          Tiene {resultado.datos.horas_plazo} horas desde la incidencia para presentar un justificativo con su respaldo.
        </p>
        <ul className="jf-novedades">
          {resultado.datos.novedades.map((n) => {
            const idResumen = `jf-novedad-${n.id_novedad}`;
            const rechazada = n.solicitud?.estado.codigo === "RECHAZADA";
            return (
              <li
                key={n.id_novedad}
                className="jf-novedad"
                tabIndex={-1}
                ref={(nodo) => (nodo ? refsItems.current.set(n.id_novedad, nodo) : refsItems.current.delete(n.id_novedad))}
              >
                <div className="jf-novedad__datos">
                  <p className="jf-novedad__titulo" id={idResumen}>
                    <time dateTime={n.fecha_jornada}>{formatearJornada(n.fecha_jornada)}</time>
                    <Etiqueta tono={TONO_TIPO[n.tipo.codigo] ?? "neutral"}>{n.tipo.nombre}</Etiqueta>
                    <span className="jf-novedad__detalle">{describirNovedad(n)}</span>
                  </p>
                  <div className="jf-novedad__estado">
                    <EstadoNovedad novedad={n} ahora={ahora} />
                  </div>
                  {rechazada && n.solicitud.revision?.comentario && (
                    <p className="jf-novedad__comentario">
                      <span className="jf-sutil">Motivo del rechazo:</span> {n.solicitud.revision.comentario}
                    </p>
                  )}
                </div>
                {n.plazo.justificable && (
                  <Boton icono={FilePlus} onClick={() => setSeleccionada(n)} aria-describedby={idResumen}>
                    {rechazada ? "Presentar otro" : "Justificar"}
                  </Boton>
                )}
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <Tarjeta className="marcaje-tarjeta" titulo="Mis atrasos y faltas" nivelTitulo={2}>
      {contenido}
      <FormularioJustificacion
        novedad={seleccionada}
        idEmpleado={idEmpleado}
        motivos={motivos}
        ahora={ahora}
        onCerrar={() => setSeleccionada(null)}
        onEnviada={alEnviar}
      />
    </Tarjeta>
  );
}
