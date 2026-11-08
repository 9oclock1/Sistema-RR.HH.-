import { Link } from "react-router";
import { Alerta, Selector } from "../../components/ui";
import { formatearDia, formatearMomento } from "./ciclo";

// Paso 1: plantilla publicada y periodo que se evalúa.
export default function PasoPlantilla({ versiones, periodos, datos, errores, onCambiar }) {
  const version = versiones.find((item) => item.id_version === datos.idVersion);

  return (
    <div className="cev-campos">
      {versiones.length === 0 && (
        <Alerta
          tono="aviso"
          titulo="No hay plantillas publicadas"
          acciones={<Link to="/desempeno/plantillas">Ir a plantillas de evaluación</Link>}
        >
          Publique una plantilla antes de programar un ciclo: solo las versiones publicadas se pueden asignar.
        </Alerta>
      )}
      {periodos.length === 0 && (
        <Alerta tono="aviso" titulo="No hay periodos de evaluación">
          Se necesita al menos un periodo registrado para programar un ciclo.
        </Alerta>
      )}

      <Selector
        etiqueta="Plantilla publicada"
        requerido
        value={datos.idVersion}
        onChange={(evento) => onCambiar("idVersion", evento.target.value)}
        textoVacio="Seleccione una plantilla"
        opciones={versiones.map((item) => ({
          valor: item.id_version,
          etiqueta: `${item.plantilla} · versión ${item.numero_version}`,
        }))}
        error={errores.id_version}
        disabled={versiones.length === 0}
      />

      {version && (
        <dl className="cev-datos" aria-label="Datos de la plantilla elegida">
          <div>
            <dt>Dirigida al área</dt>
            <dd>{version.area}</dd>
          </div>
          <div>
            <dt>Vigencia</dt>
            <dd>
              {formatearDia(version.vigencia_desde)} – {formatearDia(version.vigencia_hasta)}
            </dd>
          </div>
          <div>
            <dt>Publicada el</dt>
            <dd>{formatearMomento(version.publicada_en)}</dd>
          </div>
        </dl>
      )}

      <Selector
        etiqueta="Periodo de evaluación"
        requerido
        value={datos.idPeriodo}
        onChange={(evento) => onCambiar("idPeriodo", evento.target.value)}
        textoVacio="Seleccione un periodo"
        opciones={periodos.map((item) => ({
          valor: item.id_periodo,
          etiqueta: `${item.nombre} (${formatearDia(item.fecha_inicio)} – ${formatearDia(item.fecha_fin)})`,
        }))}
        error={errores.id_periodo}
        disabled={periodos.length === 0}
      />
    </div>
  );
}
