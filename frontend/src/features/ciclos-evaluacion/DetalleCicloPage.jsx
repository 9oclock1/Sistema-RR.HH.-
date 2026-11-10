import { useCallback, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, BellRing, ClipboardList, RefreshCw } from "lucide-react";
import { obtenerCiclo } from "../../api/ciclosEvaluacion";
import {
  Alerta,
  Avatar,
  Boton,
  Contador,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  Paginacion,
  Tabla,
  Tarjeta,
  TextoTruncado,
} from "../../components/ui";
import { useRol } from "../../context/sesion";
import { ESTADOS_EVALUACION, describirPlazo } from "../evaluaciones/formato";
import useRecurso from "../quejas/casos/useRecurso";
import { RUTA_CICLOS, TAMANO_PAGINA, estadoCiclo, formatearDia, formatearMomento, nombreDe } from "./ciclo";
import "./ciclosEvaluacion.css";

const columnas = [
  {
    clave: "evaluado",
    titulo: "Evaluado",
    ancho: "28%",
    celda: ({ evaluado, area, sucursal }) => (
      <div className="cev-celda">
        <TextoTruncado>{nombreDe(evaluado)}</TextoTruncado>
        <span className="cev-sutil">{[area, sucursal].filter(Boolean).join(" · ")}</span>
      </div>
    ),
  },
  {
    clave: "evaluador",
    titulo: "Evaluador",
    ancho: "28%",
    celda: ({ evaluador }) => (
      <div className="cev-persona">
        <Avatar nombre={nombreDe(evaluador)} decorativo />
        <TextoTruncado>{nombreDe(evaluador)}</TextoTruncado>
      </div>
    ),
  },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "18%",
    celda: ({ estado_codigo: codigo, estado_nombre: nombre }) => {
      const estado = ESTADOS_EVALUACION[codigo];
      return (
        <Etiqueta tono={estado?.tono ?? "neutral"} icono={estado?.icono}>
          {nombre}
        </Etiqueta>
      );
    },
  },
  {
    clave: "recordatorio",
    titulo: "Recordatorio",
    ancho: "26%",
    celda: ({ recordatorio_enviado_en: enviado }) =>
      enviado ? (
        <span className="cev-recordatorio">
          <BellRing className="ds-icono" aria-hidden="true" />
          {formatearMomento(enviado)}
        </span>
      ) : (
        <span className="cev-sutil">No enviado</span>
      ),
  },
];

export default function DetalleCicloPage({ idCiclo }) {
  const rol = useRol();
  const [pagina, setPagina] = useState(1);
  const cargar = useCallback(() => obtenerCiclo({ rol }, idCiclo), [rol, idCiclo]);
  const { datos: ciclo, error, reintentar } = useRecurso(cargar);

  const migas = [
    { etiqueta: "Inicio", href: "/" },
    { etiqueta: "Desempeño" },
    { etiqueta: "Ciclos de evaluación", href: RUTA_CICLOS },
  ];
  const volver = (
    <Boton as={Link} to={RUTA_CICLOS} icono={ArrowLeft}>
      Volver a los ciclos
    </Boton>
  );

  if (error) {
    return (
      <section className="cev-pagina" aria-labelledby="cev-detalle-titulo">
        <EncabezadoPagina migas={migas} enlace={Link} titulo="Ciclo de evaluación" idTitulo="cev-detalle-titulo" />
        <Alerta
          tono="peligro"
          role="alert"
          titulo={error.estado === 404 ? "No se encontró el ciclo" : "No se pudo cargar el ciclo"}
          acciones={
            <>
              {error.estado !== 404 && (
                <Boton tamano="sm" onClick={reintentar}>
                  Reintentar
                </Boton>
              )}
              {volver}
            </>
          }
        >
          {error.message}
        </Alerta>
      </section>
    );
  }

  if (!ciclo) {
    return (
      <section className="cev-pagina" aria-busy="true" aria-label="Cargando el ciclo">
        <EncabezadoPagina migas={migas} enlace={Link} titulo="Ciclo de evaluación" />
        <Tarjeta>
          <Esqueleto forma="bloque" alto="96px" />
        </Tarjeta>
      </section>
    );
  }

  const estado = estadoCiclo(ciclo.estado_codigo);
  const filas = ciclo.asignaciones
    .slice((pagina - 1) * TAMANO_PAGINA, pagina * TAMANO_PAGINA)
    .map((asignacion) => ({ ...asignacion, clave: asignacion.id_evaluacion }));

  return (
    <section className="cev-pagina" aria-labelledby="cev-detalle-titulo">
      <EncabezadoPagina
        migas={migas}
        enlace={Link}
        titulo={ciclo.nombre}
        idTitulo="cev-detalle-titulo"
        acciones={
          <>
            <Boton icono={RefreshCw} onClick={reintentar}>
              Actualizar
            </Boton>
            {volver}
          </>
        }
      />

      <Tarjeta nivelTitulo={2} titulo="Resumen" acciones={<Etiqueta tono={estado.tono} icono={estado.icono}>{estado.texto}</Etiqueta>}>
        <dl className="cev-datos" aria-label="Datos del ciclo">
          <div>
            <dt>Plantilla</dt>
            <dd>
              {ciclo.plantilla} · versión {ciclo.numero_version}
            </dd>
          </div>
          <div>
            <dt>Periodo</dt>
            <dd>{ciclo.periodo}</dd>
          </div>
          <div>
            <dt>Plazo</dt>
            <dd>
              {formatearDia(ciclo.fecha_inicio)} – {formatearDia(ciclo.fecha_limite)}
              {ciclo.estado_codigo === "ACTIVO" && (
                <span className="cev-sutil"> · {describirPlazo(ciclo.fecha_limite).texto}</span>
              )}
            </dd>
          </div>
          {ciclo.cerrado_en && (
            <div>
              <dt>Cerrado el</dt>
              <dd>{formatearMomento(ciclo.cerrado_en)}</dd>
            </div>
          )}
        </dl>
        <ul className="cev-contadores" aria-label="Avance de las evaluaciones">
          <li>
            Total <Contador>{ciclo.total}</Contador>
          </li>
          <li>
            Pendientes <Contador>{ciclo.pendientes}</Contador>
          </li>
          <li>
            En borrador <Contador>{ciclo.en_borrador}</Contador>
          </li>
          <li>
            Enviadas <Contador>{ciclo.enviadas}</Contador>
          </li>
          <li>
            Vencidas <Contador>{ciclo.vencidas}</Contador>
          </li>
        </ul>
      </Tarjeta>

      <Tarjeta nivelTitulo={2} titulo="Asignaciones evaluador–evaluado">
        <Tabla
          className="cev-tabla"
          columnas={columnas}
          filas={filas}
          claveFila="clave"
          descripcion="Asignaciones del ciclo"
          vacio={<EstadoVacio icono={ClipboardList} titulo="Sin asignaciones" mensaje="Este ciclo no tiene evaluaciones." />}
        />
        <Paginacion
          etiqueta="Páginas de asignaciones"
          pagina={pagina}
          limite={TAMANO_PAGINA}
          total={ciclo.asignaciones.length}
          onCambiar={setPagina}
        />
      </Tarjeta>
    </section>
  );
}
