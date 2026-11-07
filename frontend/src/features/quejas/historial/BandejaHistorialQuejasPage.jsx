import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Archive, Download, FilterX, Lock, RefreshCw } from "lucide-react";
import { exportarHistorialQuejas, listarCatalogosHistorial, listarHistorialQuejas } from "../../../api/historialQuejas";
import {
  Alerta,
  Avatar,
  Boton,
  CampoTexto,
  EncabezadoPagina,
  EstadoVacio,
  Etiqueta,
  Paginacion,
  Selector,
  Tabla,
  Tarjeta,
  TextoTruncado,
  useAvisos,
} from "../../../components/ui";
import { useRol } from "../../../context/sesion";
import { tonoEstado } from "../formato";
import { formatearFechaCorta, nombreDe, TAMANO_PAGINA } from "../casos/casos";
import {
  descargarArchivo,
  formatearDuracion,
  MENSAJE_SIN_PERMISO,
  nombreExportacion,
  rutaHistorialQueja,
  SIN_SUCURSAL,
  validarRango,
} from "./historial";
import "../casos/casos.css";
import "./historial.css";

const SIN_FILTROS = { desde: "", hasta: "", categoria: "", sucursal: "" };

const sinPermiso = (error) => error?.estado === 401 || error?.estado === 403;

const COLUMNAS = [
  {
    clave: "codigo",
    titulo: "Código",
    ancho: "15%",
    celda: (c) => (
      <div className="qc-celda">
        <span className="qc-codigo">{c.codigo_seguimiento}</span>
        <span className="qc-sutil">{c.es_anonima ? "Anónima" : "Identificada"}</span>
      </div>
    ),
  },
  {
    clave: "categoria",
    titulo: "Categoría",
    ancho: "14%",
    celda: (c) => <TextoTruncado>{c.categoria.nombre}</TextoTruncado>,
  },
  {
    clave: "sucursal",
    titulo: "Sucursal",
    ancho: "13%",
    celda: (c) =>
      c.sucursal ? <TextoTruncado>{c.sucursal.nombre}</TextoTruncado> : <span className="qc-sutil">Sin sucursal</span>,
  },
  {
    clave: "responsable",
    titulo: "Responsable",
    ancho: "18%",
    celda: (c) =>
      c.responsable ? (
        <div className="qc-persona">
          <Avatar nombre={nombreDe(c.responsable)} decorativo />
          <TextoTruncado>{nombreDe(c.responsable)}</TextoTruncado>
        </div>
      ) : (
        <span className="qc-sutil">Sin responsable</span>
      ),
  },
  {
    clave: "cerrada",
    titulo: "Cerrada",
    ancho: "12%",
    celda: (c) => <span className="qc-fecha">{formatearFechaCorta(c.cerrada_en)}</span>,
  },
  {
    clave: "duracion",
    titulo: "Atención",
    ancho: "10%",
    celda: (c) => <span className="qc-fecha">{formatearDuracion(c.duracion_dias)}</span>,
  },
  {
    clave: "estado",
    titulo: "Estado final",
    ancho: "11%",
    celda: (c) => <Etiqueta tono={tonoEstado(c.estado.codigo)}>{c.estado.nombre}</Etiqueta>,
  },
  {
    clave: "accion",
    titulo: <span className="ds-solo-lector">Acción</span>,
    ancho: "7%",
    alinear: "fin",
    celda: (c) => (
      <Boton
        as={Link}
        to={rutaHistorialQueja(c.id_queja)}
        tamano="sm"
        aria-label={`Ver la trazabilidad de la queja ${c.codigo_seguimiento}`}
      >
        Ver
      </Boton>
    ),
  },
];

const opcionesDe = (lista, id) => (lista ?? []).map((item) => ({ valor: String(item[id]), etiqueta: item.nombre }));

function AccesoRestringido() {
  return <EstadoVacio icono={Lock} titulo="Acceso restringido" mensaje={MENSAJE_SIN_PERMISO} />;
}

export default function BandejaHistorialQuejasPage() {
  const rol = useRol();
  const avisar = useAvisos();
  const sesion = useMemo(() => ({ rol }), [rol]);
  const [catalogos, setCatalogos] = useState(null);
  const [filtros, setFiltros] = useState(SIN_FILTROS);
  const [pagina, setPagina] = useState(1);
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState({ clave: null });
  const [exportando, setExportando] = useState(false);
  const [errorExportacion, setErrorExportacion] = useState(null);

  const errores = validarRango(filtros);
  const rangoValido = Object.keys(errores).length === 0;
  const clave = JSON.stringify({ sesion, filtros, pagina, intento });

  useEffect(() => {
    let vigente = true;
    listarCatalogosHistorial(sesion)
      .then((datos) => vigente && setCatalogos(datos))
      .catch(() => vigente && setCatalogos({ categorias: [], sucursales: [] }));
    return () => {
      vigente = false;
    };
  }, [sesion, intento]);

  useEffect(() => {
    if (!rangoValido) return undefined;
    let vigente = true;
    listarHistorialQuejas(sesion, { ...filtros, pagina, limite: TAMANO_PAGINA })
      .then((datos) => vigente && setResultado({ clave, datos }))
      .catch((error) => vigente && setResultado({ clave, error }));
    return () => {
      vigente = false;
    };
  }, [clave, sesion, filtros, pagina, rangoValido]);

  const vista = resultado.clave === clave ? resultado : {};
  const hayFiltros = Object.values(filtros).some(Boolean);
  const total = vista.datos?.total ?? 0;

  const opciones = useMemo(
    () => ({
      categorias: opcionesDe(catalogos?.categorias, "id_categoria_queja"),
      sucursales: [
        { valor: SIN_SUCURSAL, etiqueta: "Sin sucursal" },
        ...opcionesDe(catalogos?.sucursales, "id_sucursal"),
      ],
    }),
    [catalogos],
  );

  const cambiarFiltro = (campo) => (evento) => {
    setFiltros((actuales) => ({ ...actuales, [campo]: evento.target.value }));
    setPagina(1);
    setErrorExportacion(null);
  };

  const limpiarFiltros = () => {
    setFiltros(SIN_FILTROS);
    setPagina(1);
  };

  const actualizar = () => setIntento((n) => n + 1);

  const exportar = async () => {
    setErrorExportacion(null);
    setExportando(true);
    try {
      const archivo = await exportarHistorialQuejas(sesion, filtros);
      descargarArchivo(archivo, nombreExportacion());
      avisar({ tono: "exito", titulo: "Historial exportado", mensaje: `${total} ${total === 1 ? "caso" : "casos"} en CSV.` });
    } catch (error) {
      setErrorExportacion(sinPermiso(error) ? MENSAJE_SIN_PERMISO : "No se pudo generar el archivo. Intente nuevamente.");
    } finally {
      setExportando(false);
    }
  };

  let contenido;
  if (sinPermiso(vista.error)) {
    contenido = <AccesoRestringido />;
  } else {
    contenido = (
      <Tarjeta
        nivelTitulo={2}
        titulo="Casos cerrados"
        acciones={
          <Boton
            icono={Download}
            cargando={exportando}
            disabled={!vista.datos || total === 0 || !rangoValido}
            onClick={exportar}
          >
            Exportar CSV
          </Boton>
        }
      >
        <div className="qc-filtros qh-filtros">
          <CampoTexto
            type="date"
            etiqueta="Cerradas desde"
            value={filtros.desde}
            max={filtros.hasta || undefined}
            onChange={cambiarFiltro("desde")}
          />
          <CampoTexto
            type="date"
            etiqueta="Cerradas hasta"
            value={filtros.hasta}
            min={filtros.desde || undefined}
            onChange={cambiarFiltro("hasta")}
            error={errores.hasta}
          />
          <Selector
            etiqueta="Categoría"
            value={filtros.categoria}
            onChange={cambiarFiltro("categoria")}
            opciones={opciones.categorias}
            textoVacio="Todas las categorías"
            disabled={!catalogos}
          />
          <Selector
            etiqueta="Sucursal"
            value={filtros.sucursal}
            onChange={cambiarFiltro("sucursal")}
            opciones={opciones.sucursales}
            textoVacio="Todas las sucursales"
            disabled={!catalogos}
          />
        </div>

        {errorExportacion && (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudo exportar el historial"
            onCerrar={() => setErrorExportacion(null)}
          >
            {errorExportacion}
          </Alerta>
        )}

        {vista.error ? (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudo cargar el historial"
            acciones={
              <Boton tamano="sm" onClick={actualizar}>
                Reintentar
              </Boton>
            }
          >
            {vista.error.message}
          </Alerta>
        ) : (
          <>
            <Tabla
              className="qc-tabla"
              columnas={COLUMNAS}
              filas={vista.datos?.casos ?? []}
              claveFila="id_queja"
              descripcion="Quejas cerradas"
              cargando={rangoValido && !vista.datos}
              vacio={
                hayFiltros ? (
                  <EstadoVacio
                    icono={FilterX}
                    titulo="Ningún caso cerrado coincide con los filtros"
                    mensaje="Pruebe con otras fechas, categoría o sucursal."
                    accion={<Boton onClick={limpiarFiltros}>Quitar filtros</Boton>}
                  />
                ) : (
                  <EstadoVacio
                    icono={Archive}
                    titulo="Todavía no hay quejas cerradas"
                    mensaje="Cuando un responsable resuelva un caso, aparecerá aquí con su trazabilidad."
                  />
                )
              }
            />
            {vista.datos && (
              <Paginacion
                etiqueta="Páginas del historial de quejas"
                pagina={vista.datos.pagina}
                limite={vista.datos.limite}
                total={vista.datos.total}
                onCambiar={setPagina}
              />
            )}
          </>
        )}
      </Tarjeta>
    );
  }

  return (
    <section className="qc-pagina" aria-labelledby="qh-bandeja-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Desempeño" }]}
        enlace={Link}
        titulo="Historial de quejas"
        idTitulo="qh-bandeja-titulo"
        descripcion="Quejas cerradas con su trazabilidad completa, para auditoría de bienestar laboral."
        acciones={
          <Boton icono={RefreshCw} onClick={actualizar}>
            Actualizar
          </Boton>
        }
      />
      {contenido}
    </section>
  );
}
