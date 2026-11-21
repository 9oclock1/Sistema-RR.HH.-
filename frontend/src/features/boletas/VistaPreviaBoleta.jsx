import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { obtenerBoleta } from "../../api/boletas";
import { Alerta, Boton, Esqueleto, Modal } from "../../components/ui";
import { bs, describir, fechaHora, nombreMes } from "./formato";

function Grupo({ id, titulo, renglones, etiquetaTotal, total, vacio }) {
  return (
    <section className="boleta-grupo" aria-labelledby={id}>
      <h3 id={id} className="boleta-grupo__titulo">
        {titulo}
      </h3>
      {renglones.length === 0 ? (
        <p className="boleta-sutil">{vacio}</p>
      ) : (
        <ul className="boleta-renglones">
          {renglones.map((r) => (
            <li key={r.orden}>
              <div className="boleta-renglon__concepto">
                <span>{r.nombre}</span>
                <span className="boleta-sutil">{describir(r)}</span>
              </div>
              <span className="boleta-cifra">{bs(r.resultado)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="boleta-total">
        <span>{etiquetaTotal}</span>
        <span className="boleta-cifra">{bs(total)}</span>
      </p>
    </section>
  );
}

function Contenido({ boleta }) {
  const { empleado, contrato, dias, totales } = boleta;
  const datos = [
    ["Cargo", empleado.cargo ?? "—"],
    ["Área", empleado.area ?? "—"],
    ["Sucursal", empleado.sucursal ?? "—"],
    ["Contrato", contrato.numero_contrato],
    ["Haber mensual", bs(contrato.haber_mensual)],
    ["Días pagados", `${dias.pagados} de ${dias.contrato}`],
  ];
  return (
    // Región enfocable para poder desplazar con el teclado el cuerpo del modal, que no tiene otros controles.
    <div className="boleta-detalle ds-foco" role="region" aria-label="Detalle de la boleta" tabIndex={0}>
      <dl className="boleta-datos">
        {datos.map(([termino, valor]) => (
          <div key={termino}>
            <dt>{termino}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
      <Grupo
        id="boleta-haberes"
        titulo="Haberes"
        renglones={boleta.ingresos}
        etiquetaTotal="Total ganado"
        total={totales.total_ganado}
        vacio="Sin haberes en el mes."
      />
      <Grupo
        id="boleta-descuentos"
        titulo="Descuentos"
        renglones={boleta.descuentos}
        etiquetaTotal="Total descuentos"
        total={totales.total_descuentos}
        vacio="Sin descuentos en el mes."
      />
      <p className="boleta-liquido">
        <span>Líquido pagable</span>
        <span className="boleta-cifra">{bs(totales.liquido_pagable)}</span>
      </p>
      <Grupo
        id="boleta-aportes"
        titulo="Aportes patronales"
        renglones={boleta.aportes}
        etiquetaTotal="Total aportes patronales"
        total={totales.total_aportes}
        vacio="Sin aportes patronales en el mes."
      />
      <p className="boleta-sutil">A cargo del empleador: no se descuentan de su sueldo.</p>
      <dl className="boleta-verificacion">
        <div>
          <dt>Emitida</dt>
          <dd>{fechaHora(boleta.emitida_en)}</dd>
        </div>
        <div>
          <dt>Código de verificación</dt>
          <dd className="boleta-codigo">{boleta.codigo_verificacion}</dd>
        </div>
      </dl>
    </div>
  );
}

// Vista previa de la boleta (criterio 2) con el mismo contenido verificado que el PDF.
export default function VistaPreviaBoleta({ boleta, identidad, descargando, onDescargar, onCerrar }) {
  const [estado, setEstado] = useState({ id: null, detalle: null, error: null });
  const id = boleta?.id_boleta ?? null;

  useEffect(() => {
    if (!id) return undefined;
    let vigente = true;
    obtenerBoleta(id, identidad)
      .then((detalle) => vigente && setEstado({ id, detalle, error: null }))
      .catch((error) => vigente && setEstado({ id, detalle: null, error }));
    return () => {
      vigente = false;
    };
  }, [id, identidad]);

  const actual = estado.id === id ? estado : { detalle: null, error: null };
  const cargando = Boolean(id) && !actual.detalle && !actual.error;

  return (
    <Modal
      abierto={Boolean(boleta)}
      titulo={boleta ? `Boleta de pago de ${nombreMes(boleta.periodo)}` : "Boleta de pago"}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton onClick={onCerrar}>Cerrar</Boton>
          <Boton
            variante="primario"
            icono={Download}
            cargando={descargando}
            disabled={!actual.detalle}
            onClick={() => onDescargar(boleta)}
          >
            Descargar PDF
          </Boton>
        </>
      }
    >
      {cargando && (
        <div className="boleta-detalle" aria-busy="true">
          <p className="ds-solo-lector" role="status">
            Cargando la boleta…
          </p>
          <Esqueleto forma="bloque" alto="calc(var(--size-row) * 2.5)" />
          <Esqueleto forma="bloque" alto="calc(var(--size-row) * 4)" />
          <Esqueleto forma="bloque" alto="calc(var(--size-row) * 4)" />
        </div>
      )}
      {actual.error && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo abrir la boleta">
          {actual.error.message}
        </Alerta>
      )}
      {actual.detalle && <Contenido boleta={actual.detalle} />}
    </Modal>
  );
}
