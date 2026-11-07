import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { FilterX, Inbox, RefreshCw } from "lucide-react";
import {
  listarCasosAsignados,
  listarCasosQueja,
  listarCatalogosAsignados,
  listarCatalogosCasos,
} from "../../../api/casosQueja";
import {
  Alerta,
  Avatar,
  Boton,
  EncabezadoPagina,
  EstadoVacio,
  Etiqueta,
  Paginacion,
  Selector,
  Tabla,
  Tarjeta,
  TextoTruncado,
} from "../../../components/ui";
import { useRol, useUsuario } from "../../../context/sesion";
import { tonoEstado } from "../formato";
import {
  formatearFechaCorta,
  nombreDe,
  rutaCasoQueja,
  rutaMiCasoQueja,
  SIN_PRIORIDAD,
  TAMANO_PAGINA,
  tonoPrioridad,
} from "./casos";
import "./casos.css";

const SIN_FILTROS = { estado: "", categoria: "", prioridad: "" };

const ALCANCES = {
  administrador: {
    titulo: "Casos de quejas",
    descripcion: "Quejas recibidas en el buzón: clasifíquelas y derívelas a la persona que debe atenderlas.",
    catalogos: ({ rol }) => listarCatalogosCasos({ rol }),
    listar: ({ rol }, filtros) => listarCasosQueja({ rol }, filtros),
    ruta: rutaCasoQueja,
    estadoNuevo: "REGISTRADA",
    vacio: {
      titulo: "No hay quejas registradas",
      mensaje: "Cuando un empleado registre una queja en el buzón, aparecerá aquí.",
    },
  },
  responsable: {
    titulo: "Mis casos de quejas",
    descripcion: "Quejas que RRHH le derivó: registre las acciones y actualice el estado de cada caso.",
    catalogos: (sesion) => listarCatalogosAsignados(sesion),
    listar: (sesion, filtros) => listarCasosAsignados(sesion, filtros),
    ruta: rutaMiCasoQueja,
    estadoNuevo: "ASIGNADA",
    sinColumnas: ["responsable"],
    vacio: {
      titulo: "No tiene casos asignados",
      mensaje: "Cuando RRHH le derive una queja, aparecerá aquí.",
    },
  },
};

const columnasPara = (config) => [
  {
    clave: "codigo",
    titulo: "Código",
    ancho: "17%",
    celda: (c) => (
      <div className="qc-celda">
        <span className="qc-codigo">{c.codigo_seguimiento}</span>
        {c.es_anonima && <span className="qc-sutil">Anónima</span>}
      </div>
    ),
  },
  {
    clave: "categoria",
    titulo: "Categoría",
    ancho: "16%",
    celda: (c) => <TextoTruncado>{c.categoria.nombre}</TextoTruncado>,
  },
  {
    clave: "prioridad",
    titulo: "Prioridad",
    ancho: "13%",
    celda: (c) =>
      c.prioridad ? (
        <Etiqueta tono={tonoPrioridad(c.prioridad.codigo)}>{c.prioridad.nombre}</Etiqueta>
      ) : (
        <span className="qc-sutil">Sin clasificar</span>
      ),
  },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "13%",
    celda: (c) => <Etiqueta tono={tonoEstado(c.estado.codigo)}>{c.estado.nombre}</Etiqueta>,
  },
  {
    clave: "responsable",
    titulo: "Responsable",
    ancho: "19%",
    celda: (c) =>
      c.responsable ? (
        <div className="qc-persona">
          <Avatar nombre={nombreDe(c.responsable)} decorativo />
          <TextoTruncado>{nombreDe(c.responsable)}</TextoTruncado>
        </div>
      ) : (
        <span className="qc-sutil">Sin asignar</span>
      ),
  },
  {
    clave: "registrada",
    titulo: "Registrada",
    ancho: "12%",
    celda: (c) => <span className="qc-fecha">{formatearFechaCorta(c.registrada_en)}</span>,
  },
  {
    clave: "accion",
    titulo: <span className="ds-solo-lector">Acción</span>,
    ancho: "10%",
    alinear: "fin",
    celda: (c) => {
      const nueva = c.estado.codigo === config.estadoNuevo;
      return (
        <Boton
          as={Link}
          to={config.ruta(c.id_queja)}
          tamano="sm"
          variante={nueva ? "primario" : "predeterminado"}
          aria-label={`${nueva ? "Revisar" : "Ver"} la queja ${c.codigo_seguimiento}`}
        >
          {nueva ? "Revisar" : "Ver"}
        </Boton>
      );
    },
  },
].filter((columna) => !config.sinColumnas?.includes(columna.clave));

const opcionesDe = (lista, id) => (lista ?? []).map((item) => ({ valor: String(item[id]), etiqueta: item.nombre }));

export default function BandejaCasosQuejaPage({ alcance = "administrador" }) {
  const config = ALCANCES[alcance];
  const rol = useRol();
  const idEmpleado = useUsuario();
  const responsable = alcance === "responsable";
  const sinUsuario = responsable && !idEmpleado;
  const sesion = useMemo(() => (responsable ? { rol, idEmpleado } : { rol }), [responsable, rol, idEmpleado]);
  const columnas = useMemo(() => columnasPara(config), [config]);
  const [catalogos, setCatalogos] = useState(null);
  const [filtros, setFiltros] = useState(SIN_FILTROS);
  const [pagina, setPagina] = useState(1);
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState({ clave: null });

  const clave = JSON.stringify({ sesion, filtros, pagina, intento });

  useEffect(() => {
    if (sinUsuario) return undefined;
    let vigente = true;
    config
      .catalogos(sesion)
      .then((datos) => vigente && setCatalogos(datos))
      .catch(() => vigente && setCatalogos({ categorias: [], prioridades: [], estados: [] }));
    return () => {
      vigente = false;
    };
  }, [config, sesion, sinUsuario, intento]);

  useEffect(() => {
    if (sinUsuario) return undefined;
    let vigente = true;
    config
      .listar(sesion, { ...filtros, pagina, limite: TAMANO_PAGINA })
      .then((datos) => vigente && setResultado({ clave, datos }))
      .catch((error) => vigente && setResultado({ clave, error: error.message }));
    return () => {
      vigente = false;
    };
  }, [config, clave, sesion, sinUsuario, filtros, pagina]);

  const vista = resultado.clave === clave ? resultado : {};
  const hayFiltros = Object.values(filtros).some(Boolean);

  const opciones = useMemo(
    () => ({
      estados: opcionesDe(catalogos?.estados, "id_estado_queja"),
      categorias: opcionesDe(catalogos?.categorias, "id_categoria_queja"),
      prioridades: [
        { valor: SIN_PRIORIDAD, etiqueta: "Sin clasificar" },
        ...opcionesDe(catalogos?.prioridades, "id_prioridad_queja"),
      ],
    }),
    [catalogos],
  );

  const cambiarFiltro = (campo) => (evento) => {
    setFiltros((actuales) => ({ ...actuales, [campo]: evento.target.value }));
    setPagina(1);
  };

  const limpiarFiltros = () => {
    setFiltros(SIN_FILTROS);
    setPagina(1);
  };

  const actualizar = () => setIntento((n) => n + 1);

  return (
    <section className="qc-pagina" aria-labelledby="qc-bandeja-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Desempeño" }]}
        enlace={Link}
        titulo={config.titulo}
        idTitulo="qc-bandeja-titulo"
        descripcion={config.descripcion}
        acciones={
          <Boton icono={RefreshCw} onClick={actualizar}>
            Actualizar
          </Boton>
        }
      />

      {sinUsuario ? (
        <Alerta tono="aviso" titulo="Elija su usuario de prueba">
          Para ver los casos que le derivaron, seleccione quién es en «Usuario de prueba», al pie de la barra lateral.
        </Alerta>
      ) : (
      <Tarjeta nivelTitulo={2} titulo="Bandeja de casos">
        <div className="qc-filtros">
          <Selector
            etiqueta="Estado"
            value={filtros.estado}
            onChange={cambiarFiltro("estado")}
            opciones={opciones.estados}
            textoVacio="Todos los estados"
            disabled={!catalogos}
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
            etiqueta="Prioridad"
            value={filtros.prioridad}
            onChange={cambiarFiltro("prioridad")}
            opciones={opciones.prioridades}
            textoVacio="Todas las prioridades"
            disabled={!catalogos}
          />
        </div>

        {vista.error ? (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudieron cargar las quejas"
            acciones={
              <Boton tamano="sm" onClick={actualizar}>
                Reintentar
              </Boton>
            }
          >
            {vista.error}
          </Alerta>
        ) : (
          <>
            <Tabla
              className="qc-tabla"
              columnas={columnas}
              filas={vista.datos?.casos ?? []}
              claveFila="id_queja"
              descripcion="Quejas recibidas"
              cargando={!vista.datos}
              vacio={
                hayFiltros ? (
                  <EstadoVacio
                    icono={FilterX}
                    titulo="Ninguna queja coincide con los filtros"
                    mensaje="Pruebe con otro estado, categoría o prioridad."
                    accion={<Boton onClick={limpiarFiltros}>Quitar filtros</Boton>}
                  />
                ) : (
                  <EstadoVacio icono={Inbox} titulo={config.vacio.titulo} mensaje={config.vacio.mensaje} />
                )
              }
            />
            {vista.datos && (
              <Paginacion
                etiqueta="Páginas de la bandeja de quejas"
                pagina={vista.datos.pagina}
                limite={vista.datos.limite}
                total={vista.datos.total}
                onCambiar={setPagina}
              />
            )}
          </>
        )}
      </Tarjeta>
      )}
    </section>
  );
}
