import { TriangleAlert } from "lucide-react";
import { nombreDeDia, numeroDeDia, plural, textoDeAlerta, visualDeTipo } from "./calendario";

const ENCABEZADOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Bloque de una ausencia: color por tipo y el tipo escrito, para no depender solo del color (criterio 2).
export function BloqueAusencia({ ausencia, onAbrir, compacto = false }) {
  const visual = visualDeTipo(ausencia.tipo.codigo);
  return (
    <button
      type="button"
      className={`cal-bloque cal-tipo--${visual.clase} ds-foco`}
      onClick={() => onAbrir(ausencia)}
      aria-label={`${ausencia.empleado.nombre_completo}, ${ausencia.tipo.nombre}. Ver detalle`}
      title={`${ausencia.empleado.nombre_completo} · ${ausencia.tipo.nombre}`}
    >
      <span className="cal-bloque__tipo" aria-hidden="true">
        {visual.abreviatura}
      </span>
      <span className="cal-bloque__nombre">{compacto ? ausencia.empleado.nombre_completo.split(" ")[0] : ausencia.empleado.nombre_completo}</span>
    </button>
  );
}

function Celda({ fecha, ausencias, estado, hoy, delMes, maxBloques, onAbrirDia, onAbrirAusencia }) {
  const visibles = maxBloques ? ausencias.slice(0, maxBloques) : ausencias;
  const ocultas = ausencias.length - visibles.length;
  const baja = Boolean(estado?.baja_cobertura);
  const clases = [
    "cal-celda",
    !delMes && "cal-celda--fuera",
    fecha === hoy && "cal-celda--hoy",
    baja && "cal-celda--baja",
    estado && !estado.laborable && "cal-celda--descanso",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div role="gridcell" className={clases} data-fecha={fecha}>
      <div className="cal-celda__cabecera">
        <button
          type="button"
          className="cal-celda__dia ds-foco"
          onClick={() => onAbrirDia(fecha)}
          aria-label={`${nombreDeDia(fecha)}: ${plural(ausencias.length, "ausencia", "ausencias")}${baja ? ", baja cobertura" : ""}. Ver el día`}
        >
          {numeroDeDia(fecha)}
        </button>
        {estado?.feriado && (
          <span className="cal-celda__feriado" title={estado.feriado}>
            Feriado
          </span>
        )}
        {baja && (
          <span className="cal-celda__alerta" title={estado.alertas.map(textoDeAlerta).join("\n")}>
            <TriangleAlert className="ds-icono" aria-hidden="true" />
            <span className="ds-solo-lector">Baja cobertura. {estado.alertas.map(textoDeAlerta).join(". ")}</span>
          </span>
        )}
        {ausencias.length > 0 && (
          <span className="cal-celda__conteo" aria-hidden="true">
            {ausencias.length}
          </span>
        )}
      </div>
      <div className="cal-celda__bloques">
        {visibles.map((ausencia) => (
          <BloqueAusencia key={ausencia.clave} ausencia={ausencia} onAbrir={onAbrirAusencia} compacto={Boolean(maxBloques)} />
        ))}
        {ocultas > 0 && (
          <button type="button" className="cal-mas ds-foco" onClick={() => onAbrirDia(fecha)}>
            +{ocultas} más
          </button>
        )}
      </div>
    </div>
  );
}

// Cuadrícula de 7 columnas para la vista mensual (con tope de bloques por día) y la semanal (con todos).
export default function Cuadricula({ dias, porDia, estadoDias, hoy, mesDeReferencia, maxBloques, onAbrirDia, onAbrirAusencia, etiqueta }) {
  const renglones = [];
  for (let i = 0; i < dias.length; i += 7) renglones.push(dias.slice(i, i + 7));

  return (
    <div className="cal-cuadricula" role="grid" aria-label={etiqueta}>
      <div className="cal-cuadricula__encabezado" role="row">
        {ENCABEZADOS.map((nombre) => (
          <span key={nombre} role="columnheader" className="cal-cuadricula__titulo">
            {nombre}
          </span>
        ))}
      </div>
      {renglones.map((semana) => (
        <div key={semana[0]} className="cal-cuadricula__semana" role="row">
          {semana.map((fecha) => (
            <Celda
              key={fecha}
              fecha={fecha}
              ausencias={porDia.get(fecha) ?? []}
              estado={estadoDias.get(fecha)}
              hoy={hoy}
              delMes={!mesDeReferencia || fecha.slice(0, 7) === mesDeReferencia}
              maxBloques={maxBloques}
              onAbrirDia={onAbrirDia}
              onAbrirAusencia={onAbrirAusencia}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
