import { useCallback, useState } from "react";
import { Download, FileSpreadsheet, RefreshCw } from "lucide-react";
import { exportarPlanillaTributaria, generarPlanillaTributaria, obtenerPlanillaTributaria } from "../../api/planillasFiscales";
import { Alerta, Boton, EstadoVacio, Esqueleto, Etiqueta, Tabla, TextoTruncado, useAvisos } from "../../components/ui";
import { formatearMomento } from "../condiciones/formato";
import { formatearBs, plural } from "../planillas/formato";
import { descargarArchivo } from "../quejas/historial/historial";
import useRecurso from "../quejas/casos/useRecurso";
import {
  cerrarSiVencio,
  esSinGenerar,
  formatearPorcentaje,
  formatearUfv,
  nombreArchivoTributaria,
} from "./planillasFiscales";

const cifra = (valor) => <span className="pf-cifra">{formatearBs(valor)}</span>;

const COLUMNAS = [
  {
    clave: "colaborador",
    titulo: "Colaborador",
    ancho: "22%",
    celda: (r) => (
      <div className="pf-celda">
        <TextoTruncado>{r.nombre_empleado}</TextoTruncado>
        <span className="pf-sutil">CI {r.numero_documento ?? "—"}</span>
      </div>
    ),
  },
  { clave: "sueldo_neto", titulo: "Sueldo neto", alinear: "fin", celda: (r) => cifra(r.sueldo_neto) },
  { clave: "base_imponible", titulo: "Base imponible", alinear: "fin", celda: (r) => cifra(r.base_imponible) },
  { clave: "impuesto_determinado", titulo: "Impuesto RC-IVA", alinear: "fin", celda: (r) => cifra(r.impuesto_determinado) },
  { clave: "computo", titulo: "Cómputo 2 SMN", alinear: "fin", celda: (r) => cifra(r.computo_salarios_minimos) },
  {
    clave: "credito",
    titulo: "Crédito aplicado",
    alinear: "fin",
    celda: (r) => (
      <div className="pf-celda pf-celda--fin">
        {cifra(r.credito_aplicado)}
        {r.monto_facturas > 0 && <span className="pf-sutil">Facturas {formatearBs(r.monto_facturas)}</span>}
        {r.saldo_anterior_favor > 0 && (
          <span className="pf-sutil">
            Saldo anterior {formatearBs(r.saldo_anterior_favor)}
            {r.actualizacion_ufv > 0 ? ` (UFV +${formatearBs(r.actualizacion_ufv)})` : ""}
          </span>
        )}
      </div>
    ),
  },
  {
    clave: "retenido",
    titulo: "Impuesto retenido",
    alinear: "fin",
    celda: (r) => (r.impuesto_retenido > 0 ? <strong className="pf-cifra">{formatearBs(r.impuesto_retenido)}</strong> : <span className="pf-sutil">Sin retención</span>),
  },
  { clave: "saldo", titulo: "Saldo a favor", alinear: "fin", celda: (r) => cifra(r.saldo_favor_siguiente) },
];

function describirSaldoAnterior({ saldo_anterior: saldo }) {
  if (!saldo.periodo) return "Saldo anterior: el saldo inicial declarado (no hay planilla tributaria del mes anterior).";
  const ufv = saldo.ufv_inicial ? `, actualizado con la UFV de ${formatearUfv(saldo.ufv_inicial)} a ${formatearUfv(saldo.ufv_final)}` : ", sin actualizar (falta la UFV)";
  return `Saldo anterior: el saldo a favor de ${saldo.periodo}${ufv}.`;
}

export default function PlanillaTributariaVista({ planilla }) {
  const avisar = useAvisos();
  const [generando, setGenerando] = useState(false);
  const [descargando, setDescargando] = useState(null);
  const cargar = useCallback(
    () =>
      obtenerPlanillaTributaria(planilla.id_planilla).catch((fallo) => {
        cerrarSiVencio(fallo);
        throw fallo;
      }),
    [planilla.id_planilla],
  );
  const { datos, error, cargando, reintentar } = useRecurso(cargar);

  const generar = async () => {
    setGenerando(true);
    try {
      const generada = await generarPlanillaTributaria(planilla.id_planilla);
      avisar({
        tono: "exito",
        titulo: "Planilla tributaria generada",
        mensaje: `${plural(generada.totales.cantidad_dependientes, "dependiente", "dependientes")}, ${plural(generada.totales.dependientes_con_retencion, "con retención", "con retención")}.`,
      });
      reintentar();
    } catch (fallo) {
      if (!cerrarSiVencio(fallo)) avisar({ tono: "peligro", titulo: "No se pudo generar la planilla tributaria", mensaje: fallo.message });
    } finally {
      setGenerando(false);
    }
  };

  const descargar = async (formato) => {
    setDescargando(formato);
    try {
      const archivo = await exportarPlanillaTributaria(planilla.id_planilla, formato);
      descargarArchivo(archivo, nombreArchivoTributaria(planilla.periodo, formato));
    } catch (fallo) {
      if (!cerrarSiVencio(fallo)) avisar({ tono: "peligro", titulo: "No se pudo descargar el archivo", mensaje: fallo.message });
    } finally {
      setDescargando(null);
    }
  };

  const botonGenerar = (etiqueta, variante) => (
    <Boton variante={variante} icono={variante === "primario" ? FileSpreadsheet : RefreshCw} cargando={generando} onClick={generar}>
      {etiqueta}
    </Boton>
  );

  if (error && !esSinGenerar(error)) {
    return (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudo cargar la planilla tributaria"
        acciones={
          <Boton tamano="sm" onClick={reintentar}>
            Reintentar
          </Boton>
        }
      >
        {error.message}
      </Alerta>
    );
  }

  if (error && esSinGenerar(error)) {
    return (
      <EstadoVacio
        icono={FileSpreadsheet}
        titulo="La planilla tributaria de este mes aún no se generó"
        mensaje="Se calcula el RC-IVA de cada dependiente con el mínimo no imponible, el cómputo del 13 % de dos salarios mínimos, las facturas declaradas y el saldo a favor del mes anterior."
        accion={botonGenerar("Generar planilla tributaria", "primario")}
      />
    );
  }

  if (!datos) return <Esqueleto forma="bloque" alto="14rem" />;

  const { parametros, totales } = datos;
  const resumen = [
    { etiqueta: "Dependientes", valor: totales.cantidad_dependientes, nota: `${totales.dependientes_con_retencion} con retención` },
    { etiqueta: "Impuesto determinado", valor: formatearBs(totales.total_impuesto_determinado), nota: `Base imponible ${formatearBs(totales.total_base_imponible)}` },
    { etiqueta: "Cómputo de 2 salarios mínimos", valor: formatearBs(totales.total_computo_salarios_minimos), nota: `Hasta ${formatearBs(parametros.computo_salarios_minimos)} por dependiente` },
    { etiqueta: "Crédito fiscal aplicado", valor: formatearBs(totales.total_credito_aplicado), nota: "Facturas y saldo anterior" },
    { etiqueta: "Impuesto a retener", valor: formatearBs(totales.total_impuesto_retenido), nota: "Se descuenta al dependiente" },
  ];

  return (
    <div className="pf-apilado" aria-busy={cargando}>
      <div className="pf-barra">
        <div className="pf-celda">
          <p className="pf-sutil">
            Mínimo no imponible {formatearBs(parametros.minimo_no_imponible)} ({parametros.multiplo_minimo_no_imponible} × salario mínimo{" "}
            {formatearBs(parametros.salario_minimo)}) · RC-IVA {formatearPorcentaje(parametros.alicuota_rciva)} · Crédito fiscal{" "}
            {formatearPorcentaje(parametros.alicuota_credito_fiscal)}
          </p>
          <p className="pf-sutil">{describirSaldoAnterior(datos)}</p>
        </div>
        <div className="pf-acciones">
          <Boton icono={Download} cargando={descargando === "xlsx"} disabled={Boolean(descargando)} onClick={() => descargar("xlsx")}>
            Descargar Excel
          </Boton>
          <Boton icono={Download} cargando={descargando === "txt"} disabled={Boolean(descargando)} onClick={() => descargar("txt")}>
            Descargar TXT
          </Boton>
          {botonGenerar("Volver a generar", "predeterminado")}
        </div>
      </div>

      {datos.advertencias.map((advertencia) => (
        <Alerta key={advertencia} tono="aviso" titulo="Revise antes de declarar">
          {advertencia}
        </Alerta>
      ))}

      <dl className="pf-resumen">
        {resumen.map(({ etiqueta, valor, nota }) => (
          <div key={etiqueta} className="pf-resumen__dato">
            <dt>{etiqueta}</dt>
            <dd>{valor}</dd>
            <dd className="pf-sutil">{nota}</dd>
          </div>
        ))}
      </dl>

      <Tabla
        className="pf-tabla"
        descripcion="RC-IVA de cada dependiente"
        columnas={COLUMNAS}
        filas={datos.retenciones}
        claveFila="id_empleado"
        vacio={<EstadoVacio titulo="Sin dependientes" />}
      />
      <p className="pf-sutil">
        Generada el {formatearMomento(datos.generada_en)}
        {datos.generada_por_nombre ? ` por ${datos.generada_por_nombre}` : ""}. <Etiqueta tono="neutral">{datos.periodo}</Etiqueta>
      </p>
    </div>
  );
}
