import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Download, Gift, Lock, ScrollText } from "lucide-react";
import {
  exportarAuditoriaBonos,
  exportarHistorialBonos,
  exportarHistorialPorSucursal,
  listarAuditoriaBonos,
  listarHistorialBonos,
  listarHistorialPorSucursal,
} from "../../api/bonificaciones";
import {
  Alerta,
  Boton,
  CampoTexto,
  Etiqueta,
  EstadoVacio,
  Pestanas,
  Selector,
  Tabla,
  Tarjeta,
  EncabezadoPagina,
  useAvisos,
} from "../../components/ui";
import { useRol, useUsuario } from "../../context/sesion";
import { useEmpleados } from "../Asignaciones/hooks/useEmpleados";
import { useSucursales } from "../Asignaciones/hooks/useSucursales";
import { TIPOS_CONDICION, describirValor } from "../condiciones/formato";
import {
  describirCambio,
  ETIQUETAS_ACCION,
  ETIQUETAS_TIPO_BONO,
  formatearFechaHora,
  guardarComo,
  MENSAJE_SIN_PERMISO,
  nombreExportacionAuditoria,
  TONOS_ACCION,
} from "./auditoria";

const sinPermiso = (error) => error?.estado === 401 || error?.estado === 403;

function AccesoRestringido() {
  return <EstadoVacio icono={Lock} titulo="Acceso restringido" mensaje={MENSAJE_SIN_PERMISO} />;
}

// ---- Pestaña 1: auditoría de altas, modificaciones y anulaciones (quién, cuándo, valor anterior y nuevo) ----

const COLUMNAS_AUDITORIA = [
  { clave: "fecha", titulo: "Fecha", ancho: "14%", celda: (a) => formatearFechaHora(a.realizado_en) },
  { clave: "colaborador", titulo: "Colaborador", ancho: "20%", celda: (a) => a.empleado.nombre_completo },
  { clave: "tipo", titulo: "Tipo de bono", ancho: "16%", celda: (a) => ETIQUETAS_TIPO_BONO[a.tipo_bono] ?? a.tipo_bono },
  {
    clave: "accion",
    titulo: "Acción",
    ancho: "13%",
    celda: (a) => <Etiqueta tono={TONOS_ACCION[a.accion]}>{ETIQUETAS_ACCION[a.accion] ?? a.accion}</Etiqueta>,
  },
  { clave: "cambio", titulo: "Valor anterior → nuevo", ancho: "17%", celda: describirCambio },
  {
    clave: "realizado_por",
    titulo: "Realizado por",
    ancho: "20%",
    celda: (a) => (a.realizado_por_rol ? a.realizado_por_rol : <span className="ds-sutil">Proceso automático</span>),
  },
];

function PanelAuditoria({ identidad }) {
  const avisar = useAvisos();
  const [filtros, setFiltros] = useState({ periodo: "", tipo_bono: "", id_empleado: "" });
  const [resultado, setResultado] = useState({ clave: null });
  const [exportando, setExportando] = useState(false);
  const clave = JSON.stringify(filtros);
  const puedeConsultar = Boolean(filtros.periodo || filtros.id_empleado);

  useEffect(() => {
    if (!puedeConsultar) return undefined;
    let vigente = true;
    const query = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
    listarAuditoriaBonos(query, identidad)
      .then((datos) => vigente && setResultado({ clave, datos }))
      .catch((error) => vigente && setResultado({ clave, error }));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, puedeConsultar]);

  const vista = resultado.clave === clave ? resultado : {};
  const cambiar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));

  const exportar = async () => {
    setExportando(true);
    try {
      const query = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
      const archivo = await exportarAuditoriaBonos(query, identidad);
      guardarComo(archivo, nombreExportacionAuditoria());
    } catch (e) {
      avisar({ tono: "peligro", titulo: "No se pudo exportar la auditoría", mensaje: e.message });
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="kardex-seccion">
      <div className="kardex-seccion__acciones kardex-bonos-filtros">
        <CampoTexto id="aud-periodo" etiqueta="Periodo" type="month" value={filtros.periodo} onChange={cambiar("periodo")} />
        <Selector
          id="aud-tipo-bono"
          etiqueta="Tipo de bono"
          value={filtros.tipo_bono}
          onChange={cambiar("tipo_bono")}
          textoVacio="Todos"
          opciones={[
            { valor: "CONDICION", etiqueta: "Condición especial" },
            { valor: "PRODUCTIVIDAD", etiqueta: "Productividad" },
          ]}
        />
        <Boton variante="sutil" icono={Download} cargando={exportando} disabled={!puedeConsultar || !vista.datos || vista.datos.length === 0} onClick={exportar}>
          Exportar CSV
        </Boton>
      </div>

      {!puedeConsultar && (
        <Alerta tono="info" titulo="Indique un periodo o un colaborador" role="status">
          La auditoría necesita al menos un periodo o un colaborador para acotar la consulta.
        </Alerta>
      )}

      {sinPermiso(vista.error) && <AccesoRestringido />}

      {vista.error && !sinPermiso(vista.error) && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo cargar la auditoría">
          {vista.error.message}
        </Alerta>
      )}

      {puedeConsultar && !sinPermiso(vista.error) && (
        <Tabla
          className="kardex-tabla"
          descripcion="Auditoría de bonificaciones"
          columnas={COLUMNAS_AUDITORIA}
          filas={vista.datos ?? []}
          claveFila="id_auditoria"
          cargando={!vista.datos && !vista.error}
          vacio={
            <EstadoVacio
              icono={ScrollText}
              titulo="Sin movimientos para estos filtros"
              mensaje="No hubo altas, modificaciones ni anulaciones de bonos que coincidan."
            />
          }
        />
      )}
    </div>
  );
}

// ---- Pestaña 2: historial de un colaborador (condición, productividad y antigüedad) ----

const detalleHistorial = (b) => {
  if (b.tipo_bono === "CONDICION") {
    const jornadas = b.cantidad === 1 ? "1 jornada" : `${b.cantidad} jornadas o días`;
    return b.origen === "ASIGNACION" ? `${jornadas} asignados` : `${jornadas} detectadas`;
  }
  if (b.tipo_bono === "PRODUCTIVIDAD") return `${b.porcentaje_cumplimiento}% de cumplimiento`;
  return b.detalle ?? "Según la escala de antigüedad vigente";
};

const origenHistorial = (b) => {
  if (b.condicion) {
    return (
      <>
        <Etiqueta tono={TIPOS_CONDICION[b.condicion.tipo_condicion]?.tono}>
          {TIPOS_CONDICION[b.condicion.tipo_condicion]?.etiqueta ?? b.condicion.tipo_condicion}
        </Etiqueta>
        <div className="kardex-nota">{`${b.condicion.codigo} · ${b.condicion.nombre}`}</div>
      </>
    );
  }
  if (b.regla) {
    return (
      <>
        <Etiqueta tono="info">Productividad</Etiqueta>
        <div className="kardex-nota">{`Regla de ${b.regla.tipo_meta.toLowerCase()}`}</div>
      </>
    );
  }
  return <Etiqueta tono="morado">Antigüedad</Etiqueta>;
};

const COLUMNAS_HISTORIAL = [
  { clave: "periodo", titulo: "Periodo", ancho: "10%", celda: (b) => b.periodo },
  { clave: "origen", titulo: "Bono (regla)", ancho: "24%", celda: origenHistorial },
  { clave: "detalle", titulo: "Detalle", ancho: "26%", celda: detalleHistorial },
  {
    clave: "valor",
    titulo: "Valor",
    ancho: "16%",
    celda: (b) => (b.condicion ? describirValor(b.valor, b.monto === null ? "PORCENTAJE" : "MONTO_FIJO", b.condicion.tipo_condicion) : `${b.valor}`),
  },
  {
    clave: "monto",
    titulo: "Monto",
    ancho: "14%",
    alinear: "fin",
    celda: (b) => (b.monto === null ? <span className="kardex-nota">En la planilla</span> : `Bs ${Number(b.monto).toFixed(2)}`),
  },
];

function PanelHistorialColaborador({ identidad }) {
  const avisar = useAvisos();
  const empleados = useEmpleados();
  const [idEmpleado, setIdEmpleado] = useState("");
  const [filtros, setFiltros] = useState({ periodo: "", tipo_bono: "" });
  const [resultado, setResultado] = useState({ clave: null });
  const [exportando, setExportando] = useState(false);
  const clave = JSON.stringify({ idEmpleado, filtros });

  useEffect(() => {
    if (!idEmpleado) return undefined;
    let vigente = true;
    const query = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
    listarHistorialBonos(idEmpleado, query, identidad)
      .then((datos) => vigente && setResultado({ clave, datos }))
      .catch((error) => vigente && setResultado({ clave, error }));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, idEmpleado]);

  const vista = resultado.clave === clave ? resultado : {};
  const cambiar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));
  const nombreElegido = empleados.empleados.find((e) => e.id_empleado === idEmpleado)?.nombre_completo;

  const exportar = async () => {
    setExportando(true);
    try {
      const query = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
      const archivo = await exportarHistorialBonos(idEmpleado, query, identidad);
      guardarComo(archivo, `bonificaciones-${(nombreElegido ?? idEmpleado).replace(/\s+/g, "-").toLowerCase()}.csv`);
    } catch (e) {
      avisar({ tono: "peligro", titulo: "No se pudo exportar el historial", mensaje: e.message });
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="kardex-seccion">
      <div className="kardex-seccion__acciones kardex-bonos-filtros">
        <Selector
          id="hist-colaborador"
          etiqueta="Colaborador"
          value={idEmpleado}
          onChange={(e) => setIdEmpleado(e.target.value)}
          disabled={empleados.cargando || Boolean(empleados.error)}
          textoVacio={empleados.cargando ? "Cargando…" : "Seleccione un colaborador"}
          opciones={empleados.empleados.map((e) => ({ valor: e.id_empleado, etiqueta: e.nombre_completo }))}
        />
        <CampoTexto id="hist-periodo" etiqueta="Periodo" type="month" value={filtros.periodo} onChange={cambiar("periodo")} />
        <Selector
          id="hist-tipo-bono"
          etiqueta="Tipo de bono"
          value={filtros.tipo_bono}
          onChange={cambiar("tipo_bono")}
          textoVacio="Todos"
          opciones={[
            { valor: "CONDICION", etiqueta: "Condición especial" },
            { valor: "PRODUCTIVIDAD", etiqueta: "Productividad" },
            { valor: "ANTIGUEDAD", etiqueta: "Antigüedad" },
          ]}
        />
        <Boton variante="sutil" icono={Download} cargando={exportando} disabled={!idEmpleado || !vista.datos || vista.datos.length === 0} onClick={exportar}>
          Exportar CSV
        </Boton>
      </div>

      {!idEmpleado && (
        <Alerta tono="info" titulo="Seleccione un colaborador" role="status">
          Elija un colaborador para ver su historial de bonificaciones.
        </Alerta>
      )}

      {sinPermiso(vista.error) && <AccesoRestringido />}

      {vista.error && !sinPermiso(vista.error) && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo cargar el historial">
          {vista.error.message}
        </Alerta>
      )}

      {idEmpleado && !vista.error && (
        <Tabla
          className="kardex-tabla"
          descripcion={`Historial de bonificaciones${nombreElegido ? ` de ${nombreElegido}` : ""}`}
          columnas={COLUMNAS_HISTORIAL}
          filas={vista.datos ?? []}
          claveFila="id_bono"
          cargando={!vista.datos}
          vacio={
            <EstadoVacio icono={Gift} titulo="Sin bonificaciones registradas" mensaje="Este colaborador no tiene bonos en el periodo consultado." />
          }
        />
      )}
    </div>
  );
}

// ---- Pestaña 3: historial de todos los colaboradores de una sucursal ----

function PanelHistorialSucursal({ identidad }) {
  const avisar = useAvisos();
  const sucursales = useSucursales();
  const [sucursal, setSucursal] = useState("");
  const [filtros, setFiltros] = useState({ periodo: "", tipo_bono: "" });
  const [resultado, setResultado] = useState({ clave: null });
  const [exportando, setExportando] = useState(false);
  const clave = JSON.stringify({ sucursal, filtros });

  useEffect(() => {
    if (!sucursal) return undefined;
    let vigente = true;
    const query = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
    listarHistorialPorSucursal(sucursal, query, identidad)
      .then((datos) => vigente && setResultado({ clave, datos }))
      .catch((error) => vigente && setResultado({ clave, error }));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, sucursal]);

  const vista = resultado.clave === clave ? resultado : {};
  const cambiar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));

  const exportar = async () => {
    setExportando(true);
    try {
      const query = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
      const archivo = await exportarHistorialPorSucursal(sucursal, query, identidad);
      guardarComo(archivo, `bonificaciones-${sucursal.replace(/\s+/g, "-").toLowerCase()}.csv`);
    } catch (e) {
      avisar({ tono: "peligro", titulo: "No se pudo exportar el historial", mensaje: e.message });
    } finally {
      setExportando(false);
    }
  };

  const COLUMNAS_SUCURSAL = [
    { clave: "colaborador", titulo: "Colaborador", ancho: "18%", celda: (b) => b.empleado.nombre_completo },
    ...COLUMNAS_HISTORIAL,
  ];

  return (
    <div className="kardex-seccion">
      <div className="kardex-seccion__acciones kardex-bonos-filtros">
        <Selector
          id="suc-sucursal"
          etiqueta="Sucursal"
          value={sucursal}
          onChange={(e) => setSucursal(e.target.value)}
          disabled={sucursales.cargando || Boolean(sucursales.error)}
          textoVacio={sucursales.cargando ? "Cargando…" : "Seleccione una sucursal"}
          opciones={sucursales.sucursales.map((s) => ({ valor: s.nombre, etiqueta: s.nombre }))}
        />
        <CampoTexto id="suc-periodo" etiqueta="Periodo" type="month" value={filtros.periodo} onChange={cambiar("periodo")} />
        <Selector
          id="suc-tipo-bono"
          etiqueta="Tipo de bono"
          value={filtros.tipo_bono}
          onChange={cambiar("tipo_bono")}
          textoVacio="Todos"
          opciones={[
            { valor: "CONDICION", etiqueta: "Condición especial" },
            { valor: "PRODUCTIVIDAD", etiqueta: "Productividad" },
            { valor: "ANTIGUEDAD", etiqueta: "Antigüedad" },
          ]}
        />
        <Boton variante="sutil" icono={Download} cargando={exportando} disabled={!sucursal || !vista.datos || vista.datos.length === 0} onClick={exportar}>
          Exportar CSV
        </Boton>
      </div>

      {!sucursal && (
        <Alerta tono="info" titulo="Seleccione una sucursal" role="status">
          Elija una sucursal para ver los bonos de todos sus colaboradores.
        </Alerta>
      )}

      {sinPermiso(vista.error) && <AccesoRestringido />}

      {vista.error && !sinPermiso(vista.error) && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo cargar el historial">
          {vista.error.message}
        </Alerta>
      )}

      {sucursal && !vista.error && (
        <Tabla
          className="kardex-tabla"
          descripcion={`Historial de bonificaciones de ${sucursal}`}
          columnas={COLUMNAS_SUCURSAL}
          filas={vista.datos ?? []}
          claveFila="id_bono"
          cargando={!vista.datos}
          vacio={
            <EstadoVacio icono={Gift} titulo="Sin bonificaciones registradas" mensaje="Nadie en esta sucursal tiene bonos en el periodo consultado." />
          }
        />
      )}
    </div>
  );
}

export default function AuditoriaBonosPage() {
  const rol = useRol();
  const idUsuario = useUsuario();
  const identidad = { idEmpleado: idUsuario, rol };
  const [pestana, setPestana] = useState("auditoria");

  const pestanas = [
    { id: "auditoria", etiqueta: "Auditoría", contenido: <PanelAuditoria identidad={identidad} /> },
    { id: "colaborador", etiqueta: "Por colaborador", contenido: <PanelHistorialColaborador identidad={identidad} /> },
    { id: "sucursal", etiqueta: "Por sucursal", contenido: <PanelHistorialSucursal identidad={identidad} /> },
  ];

  return (
    <section className="qc-pagina" aria-labelledby="aud-bonos-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Planillas" }]}
        enlace={Link}
        titulo="Auditoría de bonificaciones"
        idTitulo="aud-bonos-titulo"
        descripcion="Quién cambió qué bono y cuándo, el historial de un colaborador o de toda una sucursal, con exportación."
      />
      <Tarjeta nivelTitulo={2} titulo="Bonificaciones">
        <Pestanas etiqueta="Vistas de la auditoría de bonificaciones" pestanas={pestanas} activa={pestana} onCambiar={setPestana} />
      </Tarjeta>
    </section>
  );
}
