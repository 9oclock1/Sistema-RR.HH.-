import { Alerta, Boton, Modal } from "../../components/ui";
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

// "12,71 % sobre Bs 3.976,67 · 27 de 30 días"
function describir(r) {
  const valor = formatearValor(r.valor, r.forma_calculo);
  const base = r.forma_calculo === "PORCENTAJE" && r.base !== null ? `${valor} sobre ${formatearBs(r.base)}` : valor;
  return [base, r.detalle].filter(Boolean).join(" · ");
}

// Renglones de un tipo (ingresos, descuentos o aportes) con su total.
function GrupoCalculo({ id, titulo, renglones, total, etiquetaTotal, vacio }) {
  return (
    <div className="planilla-calculo__grupo" aria-labelledby={id} role="group">
      <h4 id={id} className="planilla-calculo__subtitulo">
        {titulo}
      </h4>
      {renglones.length === 0 ? (
        <p className="concepto-nota">{vacio}</p>
      ) : (
        <ul className="planilla-detalle__bonos">
          {renglones.map((r) => (
            <li key={r.orden}>
              <div className="conceptos-nombre">
                <span>{r.nombre}</span>
                <span className="conceptos-nota">{describir(r)}</span>
              </div>
              <span className="planilla-cifra">{formatearBs(r.resultado)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="planilla-calculo__total">
        <span>{etiquetaTotal}</span>
        <span className="planilla-cifra">{formatearBs(total)}</span>
      </p>
    </div>
  );
}

// Novedades consolidadas de un colaborador: contrato, días, atrasos, horas y bonos del mes.
export default function DetalleColaboradorModal({ fila, onCerrar }) {
  const { empleado, contrato, dias, atrasos, minutos, novedades, observaciones, calculo, alertas } = fila;
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

        {alertas.length > 0 && (
          <Alerta tono="peligro" titulo="Inconsistencias del cálculo">
            <ul className="planilla-advertencias">
              {alertas.map((texto) => (
                <li key={texto}>{texto}</li>
              ))}
            </ul>
          </Alerta>
        )}

        {observaciones.length > 0 && (
          <ul className="planilla-detalle__observaciones">
            {observaciones.map((texto) => (
              <li key={texto}>{texto}</li>
            ))}
          </ul>
        )}

        <section aria-labelledby="detalle-calculo" className="planilla-calculo">
          <h3 id="detalle-calculo" className="planilla-detalle__titulo">
            Cálculo
          </h3>
          <GrupoCalculo
            id="calculo-ingresos"
            titulo="Haberes"
            renglones={calculo.ingresos}
            total={calculo.total_ganado}
            etiquetaTotal="Total ganado"
            vacio="Sin haberes en el mes."
          />
          <GrupoCalculo
            id="calculo-descuentos"
            titulo="Descuentos"
            renglones={calculo.descuentos}
            total={calculo.total_descuentos}
            etiquetaTotal="Total descuentos"
            vacio="Sin descuentos en el mes."
          />
          <p className={`planilla-calculo__liquido${calculo.liquido_pagable < 0 ? " planilla-negativo" : ""}`}>
            <span>Líquido pagable</span>
            <span className="planilla-cifra">{formatearBs(calculo.liquido_pagable)}</span>
          </p>
          <GrupoCalculo
            id="calculo-aportes"
            titulo="Aportes patronales (a cargo del empleador)"
            renglones={calculo.aportes}
            total={calculo.total_aportes}
            etiquetaTotal="Total aportes patronales"
            vacio="Sin aportes patronales."
          />
        </section>

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
