import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeftRight, FileChartColumn, FileDown, FileSpreadsheet, Users } from "lucide-react";
import {
  descargarReporteAsistencia,
  generarReporteAsistencia,
  obtenerAlcanceReportes,
} from "../../api/reportesAsistencia";
import {
  Alerta,
  Boton,
  CampoTexto,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Selector,
  Tabla,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import { useRol } from "../../context/sesion";
import { puedeAcceder } from "../../utils/permisos";
import IdentificacionEmpleado from "../marcaje/IdentificacionEmpleado";
import { guardarEmpleado, leerEmpleado, olvidarEmpleado } from "../marcaje/sesionEmpleado";
import { fechaCorta, filtrosIniciales, horas, porciento } from "./formato";
import "./reportesAsistencia.css";

const esRechazoDeIdentidad = (error) => error.estado === 401 || error.estado === 403;

const COLUMNAS = [
  {
    clave: "empleado",
    titulo: "Empleado",
    celda: (f) => (
      <div className="rep-celda">
        <span>{f.empleado.nombre_completo}</span>
        <span className="rep-celda__sub">{[f.empleado.cargo, f.empleado.area].filter(Boolean).join(" · ")}</span>
      </div>
    ),
  },
  { clave: "dias_programados", titulo: "Días prog.", alinear: "fin", ancho: "7%" },
  { clave: "dias_asistidos", titulo: "Asistidos", alinear: "fin", ancho: "7%" },
  {
    clave: "faltas",
    titulo: "Faltas just. / injust.",
    alinear: "fin",
    ancho: "11%",
    celda: (f) => `${f.faltas_justificadas} / ${f.faltas_injustificadas}`,
  },
  { clave: "porcentaje_ausentismo", titulo: "Ausentismo", alinear: "fin", ancho: "9%", celda: (f) => porciento(f.porcentaje_ausentismo) },
  {
    clave: "retraso",
    titulo: "Atrasos (min)",
    alinear: "fin",
    ancho: "10%",
    celda: (f) => `${f.atrasos} (${f.minutos_retraso})`,
  },
  { clave: "porcentaje_puntualidad", titulo: "Puntualidad", alinear: "fin", ancho: "9%", celda: (f) => porciento(f.porcentaje_puntualidad) },
  { clave: "salidas_anticipadas", titulo: "Salidas antic.", alinear: "fin", ancho: "9%" },
  { clave: "minutos_extra", titulo: "Horas extra", alinear: "fin", ancho: "8%", celda: (f) => horas(f.minutos_extra) },
];

function Indicadores({ totales }) {
  const lista = [
    ["Empleados", totales.empleados],
    ["Ausentismo", porciento(totales.porcentaje_ausentismo)],
    ["Faltas justificadas / injustificadas", `${totales.faltas_justificadas} / ${totales.faltas_injustificadas}`],
    ["Minutos de retraso", totales.minutos_retraso],
    ["Puntualidad", porciento(totales.porcentaje_puntualidad)],
    ["Horas extra aprobadas", horas(totales.minutos_extra)],
  ];
  return (
    <dl className="rep-indicadores">
      {lista.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="rep-indicador">
          <dt className="rep-indicador__etiqueta">{etiqueta}</dt>
          <dd className="rep-indicador__valor">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

// RF-29: reportes de asistencia, ausentismo y puntualidad por sucursal y área, exportables a PDF y Excel (CSV).
export default function ReportesAsistenciaPage() {
  const avisar = useAvisos();
  const rol = useRol();
  // RRHH (administrador y gerente) ve toda la empresa; el supervisor se identifica y ve solo su dependencia directa.
  const esRrhh = puedeAcceder(rol, ["gerente"]);
  const [idSupervisor, setIdSupervisor] = useState(leerEmpleado);
  const [errorIdentificacion, setErrorIdentificacion] = useState(null);
  const identidad = esRrhh ? { idEmpleado: null, rol } : { idEmpleado: idSupervisor, rol };
  const claveAlcance = esRrhh ? `rrhh:${rol}` : idSupervisor ? `supervisor:${idSupervisor}` : null;

  const [alcance, setAlcance] = useState({ clave: null, datos: null, error: null });
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [reporte, setReporte] = useState(null);
  const [consulta, setConsulta] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [errorReporte, setErrorReporte] = useState(null);
  const [descargando, setDescargando] = useState(null);

  useEffect(() => {
    if (!claveAlcance) return undefined;
    let vigente = true;
    obtenerAlcanceReportes(esRrhh ? { idEmpleado: null, rol } : { idEmpleado: idSupervisor, rol })
      .then((datos) => {
        if (!vigente) return;
        if (!esRrhh) guardarEmpleado(idSupervisor);
        setAlcance({ clave: claveAlcance, datos, error: null });
      })
      .catch((error) => {
        if (!vigente) return;
        if (!esRrhh && esRechazoDeIdentidad(error)) {
          olvidarEmpleado();
          setIdSupervisor(null);
          setErrorIdentificacion(error.message);
          return;
        }
        setAlcance({ clave: claveAlcance, datos: null, error: error.message });
      });
    return () => {
      vigente = false;
    };
  }, [claveAlcance, esRrhh, idSupervisor, rol]);

  const cargandoAlcance = Boolean(claveAlcance) && alcance.clave !== claveAlcance;
  const datosAlcance = alcance.clave === claveAlcance ? alcance.datos : null;
  const errorAlcance = alcance.clave === claveAlcance ? alcance.error : null;
  // El supervisor no elige la sucursal: queda fijada en la suya (criterio 4).
  const sucursalElegida = datosAlcance?.sucursal_fija ?? filtros.id_sucursal;

  const cambiar = (campo) => (evento) => setFiltros((actual) => ({ ...actual, [campo]: evento.target.value }));

  const identificar = (id) => {
    setErrorIdentificacion(null);
    setIdSupervisor(id.trim().toLowerCase());
  };

  const cambiarSupervisor = () => {
    olvidarEmpleado();
    setIdSupervisor(null);
    setReporte(null);
  };

  const generar = async (evento) => {
    evento.preventDefault();
    const pedido = { ...filtros, id_sucursal: sucursalElegida };
    setGenerando(true);
    setErrorReporte(null);
    try {
      setReporte(await generarReporteAsistencia(pedido, identidad));
      setConsulta(pedido);
    } catch (error) {
      setReporte(null);
      setErrorReporte(error);
    } finally {
      setGenerando(false);
    }
  };

  // Criterio 2: descarga del reporte en pantalla con los mismos filtros.
  const descargar = async (formato) => {
    setDescargando(formato);
    try {
      const blob = await descargarReporteAsistencia(consulta, formato, identidad);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `reporte-asistencia_${reporte.filtros.desde}_${reporte.filtros.hasta_efectiva}.${formato}`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      avisar({ tono: "peligro", titulo: "No se pudo descargar el reporte", mensaje: error.message });
    } finally {
      setDescargando(null);
    }
  };

  const errorDeCampo = (campo) => errorReporte?.detalles?.find((d) => d.campo === campo)?.mensaje;
  const opcionesSucursal = (datosAlcance?.sucursales ?? []).map((s) => ({ valor: s.id_sucursal, etiqueta: s.nombre }));
  const opcionesArea = (datosAlcance?.areas ?? []).map((a) => ({ valor: a.id_departamento, etiqueta: a.nombre }));

  return (
    <section className="rep" aria-labelledby="reportes-asistencia-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Asistencia" }]}
        enlace={Link}
        titulo="Reportes de asistencia"
        idTitulo="reportes-asistencia-titulo"
        descripcion="Consolidado de asistencia, ausentismo y puntualidad por empleado, exportable a PDF y Excel."
        acciones={
          !esRrhh &&
          idSupervisor && (
            <Boton variante="sutil" icono={ArrowLeftRight} onClick={cambiarSupervisor}>
              Cambiar supervisor
            </Boton>
          )
        }
      />

      <div className="rep-columna">
        {!esRrhh && !idSupervisor && (
          <IdentificacionEmpleado
            error={errorIdentificacion}
            procesando={false}
            enfocar={false}
            onIdentificar={identificar}
            onEditar={() => setErrorIdentificacion(null)}
          />
        )}

        {errorAlcance && (
          <Alerta tono="peligro" role="alert" titulo="No se pudieron cargar los filtros">
            {errorAlcance}
          </Alerta>
        )}

        {datosAlcance?.tipo === "SUPERVISOR" && (
          <Alerta tono="info" titulo={`Personal a cargo de ${datosAlcance.supervisor.nombre_completo}`}>
            Solo ve al personal de {datosAlcance.sucursales[0].nombre} que depende directamente de su cargo (
            {datosAlcance.personal_a_cargo} {datosAlcance.personal_a_cargo === 1 ? "persona" : "personas"}).
          </Alerta>
        )}

        {claveAlcance && !errorAlcance && (
          <Tarjeta titulo="Filtros del reporte" nivelTitulo={2} className="rep-tarjeta">
            {cargandoAlcance ? (
              <div className="rep-filtros" aria-busy="true">
                <Esqueleto forma="bloque" />
                <Esqueleto forma="bloque" />
              </div>
            ) : (
              <form className="rep-formulario" onSubmit={generar} noValidate>
                <div className="rep-filtros">
                  <Selector
                    etiqueta="Sucursal"
                    value={sucursalElegida}
                    onChange={cambiar("id_sucursal")}
                    opciones={opcionesSucursal}
                    textoVacio={datosAlcance?.sucursal_fija ? undefined : "Todas las sucursales"}
                    disabled={Boolean(datosAlcance?.sucursal_fija)}
                    error={errorDeCampo("id_sucursal")}
                  />
                  <Selector
                    etiqueta="Área"
                    value={filtros.id_departamento}
                    onChange={cambiar("id_departamento")}
                    opciones={opcionesArea}
                    textoVacio="Todas las áreas"
                    error={errorDeCampo("id_departamento")}
                  />
                  <CampoTexto
                    type="date"
                    etiqueta="Desde"
                    value={filtros.desde}
                    max={filtros.hasta || undefined}
                    onChange={cambiar("desde")}
                    error={errorDeCampo("desde")}
                    requerido
                  />
                  <CampoTexto
                    type="date"
                    etiqueta="Hasta"
                    value={filtros.hasta}
                    min={filtros.desde || undefined}
                    onChange={cambiar("hasta")}
                    error={errorDeCampo("hasta")}
                    requerido
                  />
                </div>
                <Boton type="submit" variante="primario" icono={FileChartColumn} cargando={generando}>
                  Generar reporte
                </Boton>
              </form>
            )}
          </Tarjeta>
        )}

        {errorReporte && !errorReporte.detalles?.length && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo generar el reporte">
            {errorReporte.message}
          </Alerta>
        )}

        {reporte && (
          <>
            {reporte.filtros.hasta_efectiva < reporte.filtros.hasta && (
              <Alerta tono="info" titulo="Solo jornadas cerradas">
                El reporte incluye hasta el {fechaCorta(reporte.filtros.hasta_efectiva)}: los días que aún no terminan se
                consolidan después.
              </Alerta>
            )}

            <Indicadores totales={reporte.totales} />

            <Tarjeta
              titulo={`Del ${fechaCorta(reporte.filtros.desde)} al ${fechaCorta(reporte.filtros.hasta_efectiva)}`}
              nivelTitulo={2}
              className="rep-tarjeta"
              acciones={
                <div className="rep-exportar">
                  <Boton
                    icono={FileDown}
                    onClick={() => descargar("pdf")}
                    cargando={descargando === "pdf"}
                    disabled={Boolean(descargando)}
                  >
                    Exportar PDF
                  </Boton>
                  <Boton
                    icono={FileSpreadsheet}
                    onClick={() => descargar("csv")}
                    cargando={descargando === "csv"}
                    disabled={Boolean(descargando)}
                  >
                    Exportar Excel (CSV)
                  </Boton>
                </div>
              }
            >
              <Tabla
                className="rep-tabla"
                descripcion="Consolidado de asistencia por empleado"
                columnas={COLUMNAS}
                filas={reporte.empleados.map((f) => ({ ...f, id: f.empleado.id_empleado }))}
                vacio={
                  <EstadoVacio
                    icono={Users}
                    titulo="Sin personal"
                    mensaje="No hay personal en la sucursal y el área elegidas."
                  />
                }
              />
            </Tarjeta>
          </>
        )}
      </div>
    </section>
  );
}
