import { Alerta, Tabla, Tarjeta } from "../../components/ui";
import { formatearFechaHora } from "../justificaciones/formato";
import { formatearPuntaje } from "./formato";

const COLUMNAS = [
  { clave: "competencia", titulo: "Competencia" },
  { clave: "peso", titulo: "Peso", ancho: "20%", alinear: "fin", celda: (s) => `${formatearPuntaje(s.peso_porcentual)} %` },
  { clave: "puntaje", titulo: "Puntaje", ancho: "20%", alinear: "fin", celda: (s) => formatearPuntaje(s.puntaje) },
];

// Desglose del puntaje por competencia; también lo usa la vista del colaborador (KAN-26).
export function TablaResultado({ resultado }) {
  return (
    <Tarjeta nivelTitulo={2} titulo="Resultado por competencia">
      <Tabla descripcion="Puntaje por competencia" columnas={COLUMNAS} filas={resultado.secciones} claveFila="id_seccion" />
    </Tarjeta>
  );
}

export default function ResultadoEvaluacion({ resultado, enviadaEn, ref }) {
  return (
    <>
      <Alerta ref={ref} tabIndex={-1} tono="exito" titulo="Evaluación enviada">
        <p>
          El puntaje final es <strong>{formatearPuntaje(resultado.puntaje_final)}</strong> de 100
          {enviadaEn && <> (enviada el {formatearFechaHora(enviadaEn)})</>}. Ya no se puede modificar.
        </p>
      </Alerta>
      <TablaResultado resultado={resultado} />
    </>
  );
}
