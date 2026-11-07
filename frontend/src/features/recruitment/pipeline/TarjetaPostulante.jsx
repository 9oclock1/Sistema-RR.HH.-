import { ArrowRightLeft, CalendarClock, CircleAlert, History } from "lucide-react";
import { Avatar, Boton, Etiqueta, TextoTruncado } from "../../../components/ui";
import { esAgendable, formatearDia, partesLocales } from "../entrevistas/reglasEntrevista";
import { CODIGO_ETAPA, formatearAfinidad, formatearFecha, nombreCompleto } from "./reglas";

// Estado del alta del colaborador contratado en Contabilidad y en el módulo operativo de su cargo.
function EstadoAlta({ postulacion }) {
  if (postulacion.integraciones_fallidas > 0) {
    return (
      <Etiqueta tono="peligro" icono={CircleAlert}>
        Alta con error
      </Etiqueta>
    );
  }
  const completa = postulacion.alta_contabilidad_enviada && postulacion.alta_operativa_enviada;
  return <Etiqueta tono={completa ? "exito" : "aviso"}>{completa ? "Alta enviada" : "Alta en curso"}</Etiqueta>;
}

export default function TarjetaPostulante({
  postulacion,
  movible,
  arrastrando,
  alIniciarArrastre,
  alTerminarArrastre,
  alMover,
  alVerDetalle,
  alVerEntrevistas,
}) {
  const nombre = nombreCompleto(postulacion);
  const afinidad = formatearAfinidad(postulacion.porcentaje_afinidad);
  const contratado = postulacion.codigo_etapa === CODIGO_ETAPA.CONTRATADO;
  const conEntrevistas = esAgendable(postulacion) || Boolean(postulacion.proxima_entrevista);

  const iniciarArrastre = (evento) => {
    evento.dataTransfer.effectAllowed = "move";
    evento.dataTransfer.setData("text/plain", postulacion.id_postulacion);
    alIniciarArrastre(postulacion);
  };

  return (
    <article
      className={`pl-tarjeta${movible ? " pl-tarjeta--movible" : ""}${arrastrando ? " pl-tarjeta--arrastrando" : ""}`}
      draggable={movible}
      onDragStart={movible ? iniciarArrastre : undefined}
      onDragEnd={movible ? alTerminarArrastre : undefined}
      aria-label={nombre}
    >
      <div className="pl-tarjeta__cabecera">
        <Avatar nombre={nombre} decorativo />
        <div className="pl-tarjeta__nombre">
          <TextoTruncado as="p" className="pl-tarjeta__titulo">
            {nombre}
          </TextoTruncado>
          <TextoTruncado as="p" className="pl-sutil">
            {postulacion.correo_electronico}
          </TextoTruncado>
        </div>
      </div>

      <div className="pl-tarjeta__etiquetas">
        <Etiqueta tono={afinidad ? "info" : "neutral"}>{afinidad ? `Afinidad ${afinidad}` : "Sin evaluar"}</Etiqueta>
        {contratado && postulacion.nombre_cargo && <Etiqueta tono="morado">{postulacion.nombre_cargo}</Etiqueta>}
        {contratado && <EstadoAlta postulacion={postulacion} />}
        {postulacion.esta_archivada && <Etiqueta>Archivada</Etiqueta>}
        {postulacion.proxima_entrevista && (
          <Etiqueta tono="morado" icono={CalendarClock}>
            {`Entrevista ${formatearDia(postulacion.proxima_entrevista)} · ${partesLocales(postulacion.proxima_entrevista).hora}`}
          </Etiqueta>
        )}
      </div>

      <p className="pl-sutil">Desde el {formatearFecha(postulacion.actualizado_en)}</p>

      <div className="pl-tarjeta__acciones">
        {movible && (
          <Boton variante="sutil" tamano="sm" icono={ArrowRightLeft} onClick={() => alMover(postulacion)}>
            Mover
          </Boton>
        )}
        {conEntrevistas && (
          <Boton variante="sutil" tamano="sm" icono={CalendarClock} onClick={() => alVerEntrevistas(postulacion)}>
            Entrevistas
          </Boton>
        )}
        <Boton variante="sutil" tamano="sm" icono={History} onClick={() => alVerDetalle(postulacion)}>
          Historial
        </Boton>
      </div>
    </article>
  );
}
