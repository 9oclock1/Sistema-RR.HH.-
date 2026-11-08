import { ArrowRightLeft, CircleCheck, Inbox, ShieldCheck, Wrench } from "lucide-react";
import { Alerta, Boton, Esqueleto, Etiqueta, LineaTiempo, Tarjeta } from "../../../components/ui";
import { formatearFechaHora, tonoEstado } from "../formato";
import { ESTADO_RESUELTA, nombreDe } from "./casos";

const ICONOS_ACCION = { PREVENTIVA: ShieldCheck, CORRECTIVA: Wrench };
const TONOS_ACCION = { PREVENTIVA: "info", CORRECTIVA: "morado" };

const meta = (autor, fecha) => `${autor} · ${formatearFechaHora(fecha)}`;

function pasoDeEstado(paso, indice, resolucion) {
  const inicial = !paso.estado_anterior;
  const resuelto = paso.estado.codigo === ESTADO_RESUELTA;
  return {
    id: `estado-${indice}`,
    fecha: paso.fecha,
    icono: inicial ? Inbox : resuelto ? CircleCheck : ArrowRightLeft,
    tono: tonoEstado(paso.estado.codigo),
    titulo: (
      <>
        <Etiqueta>Estado</Etiqueta>
        <span>{inicial ? `Queja ${paso.estado.nombre.toLowerCase()}` : `${paso.estado_anterior.nombre} → ${paso.estado.nombre}`}</span>
      </>
    ),
    meta: meta(paso.registrado_por ? nombreDe(paso.registrado_por) : "Buzón de quejas", paso.fecha),
    contenido:
      resuelto && resolucion ? (
        <div className="qc-bloque">
          <span className="qc-subtitulo">Resolución</span>
          <span className="qc-texto">{resolucion.descripcion}</span>
        </div>
      ) : null,
  };
}

const pasoDeAccion = (accion) => ({
  id: `accion-${accion.id_accion}`,
  fecha: accion.registrada_en,
  icono: ICONOS_ACCION[accion.tipo.codigo],
  tono: TONOS_ACCION[accion.tipo.codigo] ?? "neutral",
  titulo: <Etiqueta tono={TONOS_ACCION[accion.tipo.codigo]}>{`Acción ${accion.tipo.nombre.toLowerCase()}`}</Etiqueta>,
  meta: meta(nombreDe(accion.registrada_por), accion.registrada_en),
  contenido: accion.descripcion,
});

function elementosLineaTiempo(caso, seguimiento) {
  const estados = caso.historial.map((paso, indice) => pasoDeEstado(paso, indice, seguimiento?.resolucion));
  const acciones = (seguimiento?.acciones ?? []).map(pasoDeAccion);
  return [...estados, ...acciones].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

export default function LineaTiempoCaso({ caso, seguimiento }) {
  return (
    <Tarjeta nivelTitulo={2} titulo="Línea de tiempo del caso" className="qc-tarjeta">
      {seguimiento.error && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar las acciones del caso"
          acciones={
            <Boton tamano="sm" onClick={seguimiento.reintentar}>
              Reintentar
            </Boton>
          }
        >
          {seguimiento.error.message}
        </Alerta>
      )}
      {seguimiento.cargando && !seguimiento.datos ? (
        <Esqueleto forma="bloque" alto="calc(var(--size-row) * 4)" />
      ) : (
        <LineaTiempo etiqueta="Estados y acciones del caso" elementos={elementosLineaTiempo(caso, seguimiento.datos)} />
      )}
    </Tarjeta>
  );
}
