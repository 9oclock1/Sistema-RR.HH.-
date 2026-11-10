import { useCallback, useState } from "react";
import { Inbox, RefreshCw, RotateCcw, Send } from "lucide-react";
import { listarMensajesCrm, reprocesarMensajeCrm, simularMensajeCrm } from "../../api/desempenoGlobal";
import { Alerta, Boton, CampoAreaTexto, EstadoVacio, Etiqueta, Selector, Tabla, TextoTruncado, useAvisos } from "../../components/ui";
import useRecurso from "../quejas/casos/useRecurso";
import { formatearMomento } from "../ciclos-evaluacion/ciclo";
import { OPCIONES_ESTADO_MENSAJE, armarMensajeSimulado, estadoMensajeCrm } from "./desempenoGlobal";

// Mensajes de métricas que llegaron del CRM. Los que agotaron sus reintentos quedan en la cola de errores (DLQ) para
// revisarlos; el consolidado sigue funcionando sin ellos. Solo el administrador reprocesa y simula.
export default function MensajesCrm({ rol, esAdmin, ciclo, colaboradores, alCambiar }) {
  const avisar = useAvisos();
  const [estado, setEstado] = useState("EN_DLQ");
  const [reprocesando, setReprocesando] = useState(null);
  const cargar = useCallback(() => listarMensajesCrm(rol, estado), [rol, estado]);
  const { datos: mensajes, error, cargando, reintentar } = useRecurso(cargar);

  async function reprocesar(mensaje) {
    setReprocesando(mensaje.id_mensaje);
    try {
      await reprocesarMensajeCrm(rol, mensaje.id_mensaje);
      avisar({ tono: "exito", titulo: "Mensaje reprocesado", mensaje: "Las métricas del CRM ya se aplicaron al consolidado." });
      alCambiar();
    } catch (falla) {
      avisar({ tono: "peligro", titulo: "No se pudo reprocesar el mensaje", mensaje: falla.message });
    } finally {
      setReprocesando(null);
      reintentar();
    }
  }

  const columnas = [
    {
      clave: "recibido",
      titulo: "Recibido",
      ancho: "15%",
      celda: (m) => <span className="dg-numero">{formatearMomento(m.recibido_en)}</span>,
    },
    {
      clave: "mensaje",
      titulo: "Mensaje",
      ancho: "20%",
      celda: (m) => (
        <div className="dg-celda">
          <span>{m.tipo_evento ?? "Sin tipo"}</span>
          <span className="dg-sutil dg-codigo">
            <TextoTruncado>{m.id_mensaje_externo}</TextoTruncado>
          </span>
        </div>
      ),
    },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "20%",
      celda: (m) => {
        const actual = estadoMensajeCrm(m.estado);
        return (
          <Etiqueta tono={actual.tono} icono={actual.icono}>
            {actual.texto}
          </Etiqueta>
        );
      },
    },
    { clave: "intentos", titulo: "Intentos", ancho: "8%", alinear: "fin", celda: (m) => <span className="dg-numero">{m.intentos}</span> },
    {
      clave: "motivo",
      titulo: "Motivo del error",
      celda: (m) => (m.ultimo_error ? <span className="dg-motivo">{m.ultimo_error}</span> : <span className="dg-sutil">—</span>),
    },
    {
      clave: "metricas",
      titulo: "Métricas",
      ancho: "9%",
      alinear: "fin",
      celda: (m) => <span className="dg-numero">{m.metricas}</span>,
    },
    ...(esAdmin
      ? [
          {
            clave: "accion",
            titulo: <span className="ds-solo-lector">Acción</span>,
            ancho: "14%",
            alinear: "fin",
            celda: (m) =>
              m.estado === "EN_DLQ" ? (
                <Boton
                  tamano="sm"
                  icono={RotateCcw}
                  cargando={reprocesando === m.id_mensaje}
                  disabled={reprocesando !== null}
                  aria-label={`Reprocesar el mensaje ${m.id_mensaje_externo}`}
                  onClick={() => reprocesar(m)}
                >
                  Reprocesar
                </Boton>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <div className="dg-apilado">
      <p className="dg-sutil">
        El CRM responde de forma asíncrona. Si un mensaje falla, se reintenta y, al agotar los intentos, pasa a la cola de errores:
        no bloquea el consolidado.
      </p>
      <div className="dg-filtros">
        <Selector
          etiqueta="Mostrar"
          value={estado}
          onChange={(evento) => setEstado(evento.target.value)}
          opciones={OPCIONES_ESTADO_MENSAJE}
        />
        <Boton icono={RefreshCw} onClick={reintentar} cargando={cargando}>
          Actualizar
        </Boton>
      </div>

      {error ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar los mensajes del CRM"
          acciones={
            <Boton tamano="sm" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          {error.message}
        </Alerta>
      ) : (
        <Tabla
          className="dg-tabla dg-tabla--ancha"
          descripcion="Mensajes de métricas recibidos del CRM"
          columnas={columnas}
          filas={mensajes ?? []}
          claveFila="id_mensaje"
          cargando={cargando}
          vacio={
            <EstadoVacio
              icono={Inbox}
              titulo={estado === "EN_DLQ" ? "La cola de errores está vacía" : "No hay mensajes en este estado"}
              mensaje={estado === "EN_DLQ" ? "Ningún mensaje del CRM agotó sus reintentos." : undefined}
            />
          }
        />
      )}

      {esAdmin && <SimuladorCrm rol={rol} ciclo={ciclo} colaboradores={colaboradores} alEnviar={reintentar} />}
    </div>
  );
}

// Simula la llegada de un mensaje del CRM sin pasar por Pub/Sub, para probar duplicados (enviar el mismo texto dos
// veces) y datos inválidos (editar el texto antes de enviar).
function SimuladorCrm({ rol, ciclo, colaboradores, alEnviar }) {
  const ejemplo = useCallback(
    () => armarMensajeSimulado({ idCiclo: ciclo.id_ciclo, periodo: ciclo.periodo.nombre, colaboradores }),
    [ciclo, colaboradores],
  );
  const [texto, setTexto] = useState(ejemplo);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  async function enviar() {
    setEnviando(true);
    setResultado(null);
    try {
      const recibido = await simularMensajeCrm(rol, texto);
      setResultado({ tono: recibido.duplicado ? "aviso" : "exito", recibido });
      alEnviar();
    } catch (falla) {
      setResultado({ tono: "peligro", error: falla.message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <details className="dg-simulador">
      <summary>Simular la llegada de un mensaje del CRM</summary>
      <div className="dg-apilado">
        <p className="dg-sutil">
          Envía el texto al sistema como si lo hubiera publicado el CRM. Envíe el mismo texto dos veces para ver un duplicado, o
          estropéelo (por ejemplo, un colaborador que no fue evaluado) para verlo llegar a la cola de errores tras sus reintentos.
        </p>
        <CampoAreaTexto
          etiqueta="Mensaje del CRM (JSON)"
          filas={14}
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          spellCheck={false}
          className="dg-area-json"
        />
        <div className="dg-acciones">
          <Boton onClick={() => setTexto(ejemplo())}>Generar otro ejemplo</Boton>
          <Boton variante="primario" icono={Send} cargando={enviando} onClick={enviar}>
            Enviar al sistema
          </Boton>
        </div>
        {resultado && (
          <Alerta tono={resultado.tono} role={resultado.tono === "peligro" ? "alert" : "status"}>
            {resultado.error
              ? resultado.error
              : resultado.recibido.duplicado
                ? `Ese mensaje ya se había recibido (${estadoMensajeCrm(resultado.recibido.estado).texto}); se descartó sin cambiar nada.`
                : "Mensaje recibido. Se procesa en segundo plano: actualice la lista en unos segundos para ver su resultado."}
          </Alerta>
        )}
      </div>
    </details>
  );
}
