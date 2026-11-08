import { Etiqueta, Modal, Tabla } from "../../components/ui";
import { ESTADOS, TIPOS, formatearFecha, formatearMonto, formatearPeriodo } from "./formato";

const COLUMNAS = [
  { clave: "numero_cuota", titulo: "Cuota", ancho: "10%", celda: (c) => c.numero_cuota },
  { clave: "periodo", titulo: "Periodo", celda: (c) => formatearPeriodo(c.periodo) },
  { clave: "monto", titulo: "Monto", alinear: "fin", celda: (c) => formatearMonto(c.monto) },
  {
    clave: "estado",
    titulo: "Estado",
    celda: (c) => <Etiqueta tono={c.estado === "PAGADA" ? "exito" : "neutral"}>{c.estado === "PAGADA" ? "Pagada" : "Pendiente"}</Etiqueta>,
  },
  {
    clave: "pagada_en",
    titulo: "Pagada el",
    celda: (c) => (c.pagada_en ? formatearFecha(c.pagada_en.slice(0, 10)) : "—"),
  },
];

export default function AmortizacionModal({ anticipo, empleado, onCerrar }) {
  return (
    <Modal abierto titulo="Tabla de amortización" onCerrar={onCerrar}>
      <div className="amortizacion">
        <dl className="amortizacion-resumen">
          <div>
            <dt>Colaborador</dt>
            <dd>{empleado?.nombre_completo ?? "Colaborador no encontrado"}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>
              <Etiqueta tono={TIPOS[anticipo.tipo].tono}>{TIPOS[anticipo.tipo].etiqueta}</Etiqueta>
            </dd>
          </div>
          <div>
            <dt>Monto total</dt>
            <dd>{formatearMonto(anticipo.monto)}</dd>
          </div>
          <div>
            <dt>Saldo pendiente</dt>
            <dd>{formatearMonto(anticipo.saldo_pendiente)}</dd>
          </div>
          <div>
            <dt>Líquido pagable de referencia</dt>
            <dd>
              {formatearMonto(anticipo.liquido_pagable_referencial)} ({anticipo.porcentaje_cuota}% por cuota)
            </dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>
              <Etiqueta tono={ESTADOS[anticipo.estado].tono}>{ESTADOS[anticipo.estado].etiqueta}</Etiqueta>
            </dd>
          </div>
          {anticipo.motivo && (
            <div>
              <dt>Motivo</dt>
              <dd>{anticipo.motivo}</dd>
            </div>
          )}
        </dl>

        <Tabla
          className="amortizacion-tabla"
          descripcion={`Plan de cuotas de ${empleado?.nombre_completo ?? "el colaborador"}`}
          columnas={COLUMNAS}
          filas={anticipo.cuotas ?? []}
          claveFila="id_cuota"
        />
      </div>
    </Modal>
  );
}
