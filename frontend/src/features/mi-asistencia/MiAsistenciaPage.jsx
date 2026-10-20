import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeftRight, CalendarSearch, CalendarX2, Eye } from "lucide-react";
import { consultarMiAsistencia } from "../../api/miAsistencia";
import {
  Alerta,
  Boton,
  CampoTexto,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  Selector,
  Tabla,
  Tarjeta,
} from "../../components/ui";
import IdentificacionEmpleado from "../marcaje/IdentificacionEmpleado";
import { guardarEmpleado, leerEmpleado, olvidarEmpleado } from "../marcaje/sesionEmpleado";
import DetalleJornada from "./DetalleJornada";
import {
  ESTADOS_DIA,
  TONO_NOVEDAD,
  describirNovedad,
  estadoSolicitud,
  fechaCorta,
  filtrosIniciales,
  formatearDia,
  formatearHoraExacta,
  formatearMinutos,
  hoyBolivia,
} from "./formato";
import "./miAsistencia.css";

const esRechazoDeIdentidad = (error) => error.estado === 401 || error.estado === 403;

const OPCIONES_MODO = [
  { valor: "mes", etiqueta: "Un mes" },
  { valor: "rango", etiqueta: "Rango de fechas" },
];

const pedidoDe = ({ modo, mes, desde, hasta }) => (modo === "mes" ? { mes } : { desde, hasta });

const horaDe = (marcaje) =>
  marcaje ? (
    <time dateTime={marcaje.fecha_hora}>{formatearHoraExacta(marcaje.fecha_hora)}</time>
  ) : (
    <span className="ma-sutil">—</span>
  );

// Resumen en la fila: cada novedad o licencia con el estado de su trámite (criterio 3).
function Incidencias({ dia }) {
  if (dia.novedades.length === 0 && dia.licencias.length === 0) return <span className="ma-sutil">—</span>;
  return (
    <ul className="ma-chips">
      {dia.novedades.map((n) => {
        const estado = n.justificacion ? estadoSolicitud(n.justificacion.estado.codigo) : null;
        return (
          <li key={n.id_novedad}>
            <Etiqueta tono={TONO_NOVEDAD[n.tipo.codigo] ?? "neutral"}>{describirNovedad(n)}</Etiqueta>
            {estado && (
              <Etiqueta tono={estado.tono} icono={estado.icono} title={`Justificativo ${n.justificacion.estado.nombre}`}>
                {n.justificacion.estado.nombre}
              </Etiqueta>
            )}
          </li>
        );
      })}
      {dia.licencias.map((l) => {
        const estado = estadoSolicitud(l.estado.codigo);
        return (
          <li key={l.id_solicitud}>
            <Etiqueta tono="morado">{l.tipo.nombre}</Etiqueta>
            <Etiqueta tono={estado.tono} icono={estado.icono}>
              {l.estado.nombre}
            </Etiqueta>
          </li>
        );
      })}
    </ul>
  );
}

function columnas(verDetalle) {
  return [
    {
      clave: "fecha",
      titulo: "Fecha",
      ancho: "12%",
      celda: (d) => <time dateTime={d.fecha}>{formatearDia(d.fecha)}</time>,
    },
    {
      clave: "turno",
      titulo: "Turno",
      ancho: "16%",
      celda: (d) =>
        d.turno?.descanso ? (
          <span className="ma-sutil">Descanso</span>
        ) : d.turno ? (
          <div className="ma-celda">
            <span>{d.turno.nombre}</span>
            <span className="ma-sutil">
              {d.turno.hora_inicio}–{d.turno.hora_fin}
            </span>
          </div>
        ) : (
          <span className="ma-sutil">Sin turno</span>
        ),
    },
    { clave: "entrada", titulo: "Entrada", ancho: "9%", celda: (d) => horaDe(d.entrada) },
    { clave: "salida", titulo: "Salida", ancho: "9%", celda: (d) => horaDe(d.salida) },
    {
      clave: "horas",
      titulo: "Horas",
      alinear: "fin",
      ancho: "9%",
      celda: (d) => (d.minutos_trabajados === null ? <span className="ma-sutil">—</span> : formatearMinutos(d.minutos_trabajados)),
    },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "11%",
      celda: (d) => <Etiqueta tono={ESTADOS_DIA[d.estado].tono}>{ESTADOS_DIA[d.estado].texto}</Etiqueta>,
    },
    { clave: "incidencias", titulo: "Incidencias", celda: (d) => <Incidencias dia={d} /> },
    {
      clave: "detalle",
      titulo: <span className="ds-solo-lector">Acciones</span>,
      ancho: "6%",
      alinear: "fin",
      celda: (d) => (
        <Boton
          variante="sutil"
          soloIcono
          icono={Eye}
          aria-label={`Ver detalle del ${formatearDia(d.fecha)}`}
          title="Ver detalle"
          onClick={() => verDetalle(d)}
        />
      ),
    },
  ];
}

function Indicadores({ resumen }) {
  const lista = [
    ["Días laborados", `${resumen.dias_laborados} de ${resumen.dias_programados}`],
    [
      "Atrasos acumulados",
      `${formatearMinutos(resumen.minutos_atraso)}`,
      `${resumen.atrasos} ${resumen.atrasos === 1 ? "atraso" : "atrasos"}, ${resumen.atrasos_justificados} justificado${resumen.atrasos_justificados === 1 ? "" : "s"}`,
    ],
    ["Faltas", resumen.faltas, `${resumen.faltas_justificadas} justificada${resumen.faltas_justificadas === 1 ? "" : "s"}, ${resumen.faltas_injustificadas} sin justificar`],
    ["Horas computadas", formatearMinutos(resumen.minutos_trabajados)],
    ["Horas extra aprobadas", formatearMinutos(resumen.minutos_extra_aprobados)],
    ["Días con licencia", resumen.dias_con_licencia],
  ];
  return (
    <dl className="ma-indicadores">
      {lista.map(([etiqueta, valor, detalle]) => (
        <div key={etiqueta} className="ma-indicador">
          <dt className="ma-indicador__etiqueta">{etiqueta}</dt>
          <dd className="ma-indicador__valor">{valor}</dd>
          {detalle && <dd className="ma-indicador__detalle">{detalle}</dd>}
        </div>
      ))}
    </dl>
  );
}

// RF-28: «Mi asistencia». El colaborador ve solo su propio historial de marcajes, atrasos, faltas y horas.
export default function MiAsistenciaPage() {
  const [idInicial] = useState(leerEmpleado);
  const [idEmpleado, setIdEmpleado] = useState(idInicial);
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [historial, setHistorial] = useState(null);
  const [cargando, setCargando] = useState(Boolean(idInicial));
  const [error, setError] = useState(null);
  const [errorIdentificacion, setErrorIdentificacion] = useState(null);
  const [enfocarIdentificacion, setEnfocarIdentificacion] = useState(false);
  const [diaAbierto, setDiaAbierto] = useState(null);

  const cargar = useCallback(
    (id, pedido) =>
      consultarMiAsistencia(id, pedido)
        .then((datos) => {
          guardarEmpleado(id);
          setIdEmpleado(id);
          setHistorial(datos);
          setError(null);
        })
        .catch((e) => {
          if (!esRechazoDeIdentidad(e)) {
            setError(e);
            return;
          }
          olvidarEmpleado();
          setIdEmpleado(null);
          setHistorial(null);
          setError(null);
          setErrorIdentificacion(e.message);
        })
        .finally(() => setCargando(false)),
    []
  );

  useEffect(() => {
    if (idInicial) cargar(idInicial, pedidoDe(filtrosIniciales()));
  }, [cargar, idInicial]);

  const identificar = (id) => {
    setErrorIdentificacion(null);
    setCargando(true);
    cargar(id.trim().toLowerCase(), pedidoDe(filtros));
  };

  const cambiarEmpleado = () => {
    olvidarEmpleado();
    setIdEmpleado(null);
    setHistorial(null);
    setError(null);
    setEnfocarIdentificacion(true);
  };

  const cambiar = (campo) => (evento) => setFiltros((actual) => ({ ...actual, [campo]: evento.target.value }));

  const filtrar = (evento) => {
    evento.preventDefault();
    setCargando(true);
    cargar(idEmpleado, pedidoDe(filtros));
  };

  const hoy = hoyBolivia();
  const errorDeCampo = (campo) => error?.detalles?.find((d) => d.campo === campo)?.mensaje;
  const nombre = historial?.empleado.nombre_completo;

  return (
    <section className="ma" aria-labelledby="mi-asistencia-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Asistencia" }]}
        enlace={Link}
        titulo="Mi asistencia"
        idTitulo="mi-asistencia-titulo"
        descripcion="Sus marcajes de entrada y salida, atrasos, faltas y horas computadas."
        acciones={
          idEmpleado && (
            <Boton variante="sutil" icono={ArrowLeftRight} onClick={cambiarEmpleado}>
              Cambiar empleado
            </Boton>
          )
        }
      />

      <div className="ma-columna">
        {!idEmpleado && (
          <IdentificacionEmpleado
            error={errorIdentificacion}
            procesando={cargando}
            enfocar={enfocarIdentificacion}
            onIdentificar={identificar}
            onEditar={() => setErrorIdentificacion(null)}
          />
        )}

        {idEmpleado && (
          <Tarjeta titulo={nombre ? `Historial de ${nombre}` : "Historial"} nivelTitulo={2} className="ma-tarjeta">
            <form className="ma-filtros" onSubmit={filtrar} noValidate>
              <Selector etiqueta="Consultar" value={filtros.modo} onChange={cambiar("modo")} opciones={OPCIONES_MODO} />
              {filtros.modo === "mes" ? (
                <CampoTexto
                  type="month"
                  etiqueta="Mes"
                  value={filtros.mes}
                  max={hoy.slice(0, 7)}
                  onChange={cambiar("mes")}
                  error={errorDeCampo("mes")}
                  requerido
                />
              ) : (
                <>
                  <CampoTexto
                    type="date"
                    etiqueta="Desde"
                    value={filtros.desde}
                    max={filtros.hasta || hoy}
                    onChange={cambiar("desde")}
                    error={errorDeCampo("desde")}
                    requerido
                  />
                  <CampoTexto
                    type="date"
                    etiqueta="Hasta"
                    value={filtros.hasta}
                    min={filtros.desde || undefined}
                    max={hoy}
                    onChange={cambiar("hasta")}
                    error={errorDeCampo("hasta")}
                    requerido
                  />
                </>
              )}
              <Boton type="submit" variante="primario" icono={CalendarSearch} cargando={cargando} className="ma-filtros__boton">
                Consultar
              </Boton>
            </form>
          </Tarjeta>
        )}

        {error && !error.detalles?.length && (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudo cargar su historial"
            acciones={
              <Boton tamano="sm" onClick={filtrar} cargando={cargando}>
                Reintentar
              </Boton>
            }
          >
            {error.message}
          </Alerta>
        )}

        {idEmpleado && !historial && cargando && (
          <div className="ma-indicadores" aria-busy="true">
            <p className="ds-solo-lector" role="status">
              Cargando su historial…
            </p>
            {Array.from({ length: 6 }, (_, i) => (
              <Esqueleto key={i} forma="bloque" />
            ))}
          </div>
        )}

        {historial && (
          <>
            <Indicadores resumen={historial.resumen} />
            <Tarjeta
              titulo={`Del ${fechaCorta(historial.filtros.desde)} al ${fechaCorta(historial.filtros.hasta_efectiva)}`}
              nivelTitulo={2}
              className="ma-tarjeta"
            >
              <Tabla
                className="ma-tabla"
                descripcion="Marcajes e incidencias por jornada"
                columnas={columnas(setDiaAbierto)}
                filas={historial.dias}
                claveFila="fecha"
                cargando={cargando}
                vacio={<EstadoVacio icono={CalendarX2} titulo="Sin jornadas" mensaje="No hay jornadas en el periodo elegido." />}
              />
            </Tarjeta>
          </>
        )}
      </div>

      <DetalleJornada dia={diaAbierto} onCerrar={() => setDiaAbierto(null)} />
    </section>
  );
}
