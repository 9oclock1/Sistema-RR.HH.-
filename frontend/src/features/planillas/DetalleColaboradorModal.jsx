import { Boton, Modal } from "../../components/ui";
import { formatearFecha, formatearValor } from "../conceptos/formato";
import { formatearBs, formatearHoras, plural, TIPOS_MINUTOS } from "./formato";

function Dato({ termino, children }) {
  return (
    <div>
      <dt>{termino}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// Novedades consolidadas de un colaborador: contrato, días, atrasos, horas y bonos del mes.
export default function DetalleColaboradorModal({ fila, onCerrar }) {
  const { empleado, contrato, dias, atrasos, minutos, novedades, observaciones } = fila;
  const subtitulo = [empleado.cargo, empleado.area, empleado.sucursal].filter(Boolean).join(" · ");

  return (
    <Modal
      abierto
      titulo={empleado.nombre_completo}
      onCerrar={onCerrar}
      pie={
        <Boton onClick={onCerrar} data-autofocus>
          Cerrar
        </Boton>
      }
    >
      {/* Enfocable para desplazar el detalle con el teclado en pantallas angostas. */}
      <div className="planilla-detalle ds-foco" tabIndex={0} role="region" aria-label={`Novedades de ${empleado.nombre_completo}`}>
        {(subtitulo || empleado.numero_documento) && (
          <p className="concepto-nota">
            {subtitulo}
            {empleado.numero_documento && `${subtitulo ? " · " : ""}CI ${empleado.numero_documento}`}
          </p>
        )}

        {observaciones.length > 0 && (
          <ul className="planilla-detalle__observaciones">
            {observaciones.map((texto) => (
              <li key={texto}>{texto}</li>
            ))}
          </ul>
        )}

        <section aria-labelledby="detalle-contrato">
          <h3 id="detalle-contrato" className="planilla-detalle__titulo">
            Contrato
          </h3>
          <dl className="vigencias-resumen planilla-detalle__datos">
            <Dato termino="Número">{contrato.numero_contrato}</Dato>
            <Dato termino="Haber mensual">{formatearBs(contrato.haber_mensual)}</Dato>
            <Dato termino="En el mes">
              {formatearFecha(contrato.desde)} al {formatearFecha(contrato.hasta)}
            </Dato>
          </dl>
        </section>

        <section aria-labelledby="detalle-dias">
          <h3 id="detalle-dias" className="planilla-detalle__titulo">
            Días
          </h3>
          <dl className="vigencias-resumen planilla-detalle__datos">
            <Dato termino="Por contrato">{dias.contrato}</Dato>
            <Dato termino="Faltas injustificadas">{dias.faltas_injustificadas}</Dato>
            <Dato termino="Licencia sin goce">{dias.licencia_sin_goce}</Dato>
            <Dato termino="Licencia con goce">{dias.licencia_con_goce}</Dato>
            <Dato termino="Atrasos">
              {atrasos.cantidad ? `${plural(atrasos.cantidad, "atraso", "atrasos")} · ${atrasos.minutos} min` : "—"}
            </Dato>
            <Dato termino="Días a pagar">
              <strong>{dias.pagados}</strong>
            </Dato>
          </dl>
        </section>

        <section aria-labelledby="detalle-horas">
          <h3 id="detalle-horas" className="planilla-detalle__titulo">
            Horas aprobadas
          </h3>
          <dl className="vigencias-resumen planilla-detalle__datos">
            {TIPOS_MINUTOS.map(({ clave, etiqueta }) => (
              <Dato key={clave} termino={etiqueta}>
                {formatearHoras(minutos[clave])}
              </Dato>
            ))}
          </dl>
        </section>

        <section aria-labelledby="detalle-bonos">
          <h3 id="detalle-bonos" className="planilla-detalle__titulo">
            Bonos por condiciones especiales
          </h3>
          {novedades.length === 0 ? (
            <p className="concepto-nota">Sin bonos en el mes.</p>
          ) : (
            <ul className="planilla-detalle__bonos">
              {novedades.map((n) => (
                <li key={n.id_novedad}>
                  <div className="conceptos-nombre">
                    <span>
                      <span className="conceptos-codigo">{n.codigo}</span> {n.nombre}
                    </span>
                    <span className="conceptos-nota">
                      {n.detalle} · {formatearValor(n.valor, n.forma_calculo)}
                      {n.forma_calculo === "PORCENTAJE" ? " del haber" : ""}
                    </span>
                  </div>
                  <span className="planilla-cifra">
                    {n.monto === null ? <span className="conceptos-nota">En el cálculo</span> : formatearBs(n.monto)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
