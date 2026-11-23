import { useCallback, useMemo, useState } from "react";
import { Download, FileArchive, Landmark, RefreshCw } from "lucide-react";
import { exportarPlanillaAportes, generarPlanillaAportes, obtenerPlanillaAportes } from "../../api/planillasFiscales";
import { Alerta, Boton, EstadoVacio, Esqueleto, Etiqueta, Selector, Tabla, TextoTruncado, useAvisos } from "../../components/ui";
import { formatearMomento } from "../condiciones/formato";
import { formatearBs, plural } from "../planillas/formato";
import { descargarArchivo } from "../quejas/historial/historial";
import useRecurso from "../quejas/casos/useRecurso";
import {
  ETIQUETAS_TIPO,
  TONOS_TIPO,
  cerrarSiVencio,
  esSinGenerar,
  formatearTasa,
  nombreArchivoAportes,
  nombreArchivoZip,
} from "./planillasFiscales";

const cifra = (valor) => <span className="pf-cifra">{formatearBs(valor)}</span>;

const COLUMNAS_DETALLE = [
  {
    clave: "colaborador",
    titulo: "Colaborador",
    ancho: "26%",
    celda: (d) => (
      <div className="pf-celda">
        <TextoTruncado>{d.nombre_empleado}</TextoTruncado>
        <span className="pf-sutil">CI {d.numero_documento ?? "—"}</span>
      </div>
    ),
  },
  {
    clave: "concepto",
    titulo: "Concepto",
    celda: (d) => (
      <div className="pf-celda">
        <TextoTruncado>{d.nombre_concepto}</TextoTruncado>
        <span className="pf-sutil">{d.codigo_concepto}</span>
      </div>
    ),
  },
  {
    clave: "tipo",
    titulo: "Aporte",
    ancho: "12%",
    celda: (d) => <Etiqueta tono={TONOS_TIPO[d.tipo]}>{ETIQUETAS_TIPO[d.tipo]}</Etiqueta>,
  },
  { clave: "base", titulo: "Base", alinear: "fin", celda: (d) => cifra(d.base) },
  { clave: "tasa", titulo: "Tasa", alinear: "fin", celda: (d) => <span className="pf-cifra">{formatearTasa(d.tasa)}</span> },
  { clave: "monto", titulo: "Monto", alinear: "fin", celda: (d) => <strong className="pf-cifra">{formatearBs(d.monto)}</strong> },
];

export default function PlanillaAportesVista({ planilla }) {
  const avisar = useAvisos();
  const [generando, setGenerando] = useState(false);
  const [descargando, setDescargando] = useState(null);
  const [entidadVista, setEntidadVista] = useState("");
  const cargar = useCallback(
    () =>
      obtenerPlanillaAportes(planilla.id_planilla).catch((fallo) => {
        cerrarSiVencio(fallo);
        throw fallo;
      }),
    [planilla.id_planilla],
  );
  const { datos, error, cargando, reintentar } = useRecurso(cargar);

  const entidadActual = datos ? (datos.entidades.find((e) => e.codigo === entidadVista) ?? datos.entidades[0]) : null;
  const detalleVisible = useMemo(
    () => (datos && entidadActual ? datos.detalle.filter((d) => d.codigo_entidad === entidadActual.codigo) : []),
    [datos, entidadActual],
  );

  const generar = async () => {
    setGenerando(true);
    try {
      const generada = await generarPlanillaAportes(planilla.id_planilla);
      avisar({
        tono: "exito",
        titulo: "Planilla de aportes generada",
        mensaje: `${plural(generada.totales.cantidad_empleados, "colaborador", "colaboradores")} en ${plural(generada.entidades.length, "entidad", "entidades")}.`,
      });
      reintentar();
    } catch (fallo) {
      if (!cerrarSiVencio(fallo)) avisar({ tono: "peligro", titulo: "No se pudo generar la planilla de aportes", mensaje: fallo.message });
    } finally {
      setGenerando(false);
    }
  };

  const descargar = async (entidad) => {
    const clave = entidad ? entidad.codigo : "todo";
    setDescargando(clave);
    try {
      const archivo = await exportarPlanillaAportes(planilla.id_planilla, entidad?.codigo);
      const nombre = entidad
        ? nombreArchivoAportes(planilla.periodo, entidad.codigo, entidad.formato_archivo.toLowerCase())
        : nombreArchivoZip(planilla.periodo);
      descargarArchivo(archivo, nombre);
    } catch (fallo) {
      if (!cerrarSiVencio(fallo)) avisar({ tono: "peligro", titulo: "No se pudo descargar el archivo", mensaje: fallo.message });
    } finally {
      setDescargando(null);
    }
  };

  const botonGenerar = (etiqueta, variante) => (
    <Boton variante={variante} icono={variante === "primario" ? Landmark : RefreshCw} cargando={generando} onClick={generar}>
      {etiqueta}
    </Boton>
  );

  if (error && !esSinGenerar(error)) {
    return (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudo cargar la planilla de aportes"
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
        icono={Landmark}
        titulo="La planilla de aportes de este mes aún no se generó"
        mensaje="Reúne los aportes laborales y patronales de la planilla cerrada, con el porcentaje vigente en ese periodo, y los separa por entidad."
        accion={botonGenerar("Generar planilla de aportes", "primario")}
      />
    );
  }

  if (!datos) return <Esqueleto forma="bloque" alto="14rem" />;

  const { totales } = datos;
  const resumen = [
    { etiqueta: "Aportes laborales", valor: formatearBs(totales.total_laboral), nota: "Descontados al colaborador" },
    { etiqueta: "Aportes patronales", valor: formatearBs(totales.total_patronal), nota: "A cargo de la empresa" },
    { etiqueta: "Total a declarar", valor: formatearBs(totales.total), nota: plural(totales.cantidad_empleados, "colaborador", "colaboradores") },
  ];

  const columnasEntidad = [
    {
      clave: "entidad",
      titulo: "Entidad",
      ancho: "34%",
      celda: (e) => (
        <div className="pf-celda">
          <TextoTruncado>{e.nombre}</TextoTruncado>
          <span className="pf-sutil">Archivo {e.formato_archivo === "XLSX" ? "Excel" : "TXT"}</span>
        </div>
      ),
    },
    { clave: "laboral", titulo: "Laboral", alinear: "fin", celda: (e) => cifra(e.total_laboral) },
    { clave: "patronal", titulo: "Patronal", alinear: "fin", celda: (e) => cifra(e.total_patronal) },
    { clave: "total", titulo: "Total", alinear: "fin", celda: (e) => <strong className="pf-cifra">{formatearBs(e.total)}</strong> },
    {
      clave: "descarga",
      titulo: "Archivo",
      alinear: "fin",
      celda: (e) => (
        <Boton
          tamano="sm"
          icono={Download}
          cargando={descargando === e.codigo}
          disabled={Boolean(descargando) || e.empleados === 0}
          onClick={() => descargar(e)}
        >
          Descargar
        </Boton>
      ),
    },
  ];

  return (
    <div className="pf-apilado" aria-busy={cargando}>
      <div className="pf-barra">
        <p className="pf-sutil">
          Generada el {formatearMomento(datos.generada_en)}
          {datos.generada_por_nombre ? ` por ${datos.generada_por_nombre}` : ""}.
        </p>
        <div className="pf-acciones">
          <Boton icono={FileArchive} cargando={descargando === "todo"} disabled={Boolean(descargando)} onClick={() => descargar(null)}>
            Descargar todo (ZIP)
          </Boton>
          {botonGenerar("Volver a generar", "predeterminado")}
        </div>
      </div>

      {datos.advertencias.map((advertencia) => (
        <Alerta key={advertencia} tono="aviso" titulo="Revise la configuración">
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
        descripcion="Aportes por entidad"
        columnas={columnasEntidad}
        filas={datos.entidades}
        claveFila="codigo"
        vacio={<EstadoVacio titulo="Sin entidades" />}
      />

      <div className="pf-vista">
        <Selector
          etiqueta="Vista previa del archivo de"
          value={entidadActual?.codigo ?? ""}
          onChange={(evento) => setEntidadVista(evento.target.value)}
          opciones={datos.entidades.map((e) => ({ valor: e.codigo, etiqueta: e.nombre }))}
        />
        <p className="pf-sutil">{plural(detalleVisible.length, "renglón", "renglones")}</p>
      </div>
      <Tabla
        className="pf-tabla pf-tabla--ancha"
        descripcion="Detalle de aportes de la entidad elegida"
        columnas={COLUMNAS_DETALLE}
        filas={detalleVisible.map((d, i) => ({ ...d, clave: `${d.id_empleado}-${d.codigo_concepto}-${i}` }))}
        claveFila="clave"
        vacio={<EstadoVacio titulo="Sin aportes para esta entidad" />}
      />
    </div>
  );
}
