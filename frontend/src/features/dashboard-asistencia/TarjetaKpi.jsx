import { Etiqueta, Tarjeta } from "../../components/ui";
import { estadoDe, porcentaje } from "./formato";

// Tarjeta de un KPI (ausentismo o puntualidad) con su semáforo (RF-73, KAN-93).
export default function TarjetaKpi({ titulo, kpi, metaTexto, detalle }) {
  const estado = estadoDe(kpi.semaforo);
  return (
    <Tarjeta titulo={titulo} nivelTitulo={2} className="da-kpi">
      <p className={`da-kpi__valor da-kpi__valor--${kpi.semaforo ?? "sin_datos"}`}>{porcentaje(kpi.valor)}</p>
      <Etiqueta tono={estado.tono} icono={estado.icono}>
        {estado.texto}
      </Etiqueta>
      <p className="da-sutil">{metaTexto}</p>
      {detalle && <p className="da-sutil">{detalle}</p>}
    </Tarjeta>
  );
}
