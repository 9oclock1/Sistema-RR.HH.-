import { Etiqueta, Tarjeta } from "../../components/ui";
import { detalleKpi, estadoDe, formatearPorcentaje, textoMeta, textoTramo } from "./formato";

export default function TarjetaKpi({ kpi, periodo, esMesActual }) {
  const estado = estadoDe(kpi.estado);
  return (
    <Tarjeta titulo={kpi.nombre} nivelTitulo={2} className="rp-kpi">
      <p className={`rp-kpi__valor rp-kpi__valor--${kpi.estado}`}>{formatearPorcentaje(kpi.valor)}</p>
      <Etiqueta tono={estado.tono} icono={estado.icono}>
        {estado.texto}
      </Etiqueta>
      <p className="rp-sutil">
        {textoMeta(kpi)} · {textoTramo(kpi, { periodo, esMesActual })}
      </p>
      <p className="rp-sutil">{detalleKpi(kpi)}</p>
    </Tarjeta>
  );
}
