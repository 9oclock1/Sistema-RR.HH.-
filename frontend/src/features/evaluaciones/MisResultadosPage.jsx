import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Award, RefreshCw, UserRound } from "lucide-react";
import { listarMisResultados, obtenerHistorialDesempeno, obtenerMiResultado } from "../../api/evaluaciones";
import { Alerta, Boton, EncabezadoPagina, Esqueleto, EstadoVacio, Tabla, Tarjeta } from "../../components/ui";
import { useRol, useUsuario } from "../../context/sesion";
import { formatearFechaHora } from "../justificaciones/formato";
import { formatearPuntaje } from "./formato";
import HistorialDesempeno from "./HistorialDesempeno";
import { TablaResultado } from "./ResultadoEvaluacion";
import { VistaRetroalimentacion } from "./RetroalimentacionEvaluacion";
import { RUTA_MIS_RESULTADOS, rutaMiResultado } from "./ruta";
import "./evaluaciones.css";

// KAN-26: el colaborador consulta los resultados de sus evaluaciones enviadas, con la retroalimentación
// cualitativa de su evaluador. Todo es de solo lectura.

const MIGAS = [{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Desempeño" }];

const COLUMNAS = [
  { clave: "ciclo", titulo: "Ciclo", ancho: "30%", celda: (r) => <span className="ev-ciclo">{r.ciclo.nombre}</span> },
  { clave: "evaluador", titulo: "Evaluador", ancho: "22%", celda: (r) => r.evaluador.nombre_completo },
  { clave: "enviada", titulo: "Enviada", ancho: "18%", celda: (r) => formatearFechaHora(r.enviada_en) },
  { clave: "puntaje", titulo: "Puntaje", ancho: "10%", alinear: "fin", celda: (r) => formatearPuntaje(r.puntaje_final) },
  {
    clave: "accion",
    titulo: <span className="ds-solo-lector">Acción</span>,
    ancho: "20%",
    alinear: "fin",
    celda: (r) => (
      <Boton as={Link} to={rutaMiResultado(r.id_evaluacion)} tamano="sm" aria-label={`Ver el resultado de ${r.ciclo.nombre}`}>
        Ver resultado
      </Boton>
    ),
  },
];

// Carga con una clave: si cambia el usuario o se reintenta, la respuesta vieja se descarta.
function useCarga(cargar, dependencias) {
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState({ clave: null });
  const clave = `${dependencias.join("|")}|${intento}`;

  useEffect(() => {
    if (dependencias.some((d) => !d)) return undefined;
    let vigente = true;
    cargar()
      .then((datos) => vigente && setResultado({ clave, datos }))
      .catch((error) => vigente && setResultado({ clave, error }));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return { ...(resultado.clave === clave ? resultado : {}), reintentar: () => setIntento((n) => n + 1) };
}

function ErrorCarga({ error, titulo, onReintentar, accion }) {
  return (
    <Alerta
      tono="peligro"
      role="alert"
      titulo={titulo}
      acciones={
        <>
          {error.estado !== 403 && error.estado !== 404 && error.estado !== 409 && (
            <Boton tamano="sm" onClick={onReintentar}>
              Reintentar
            </Boton>
          )}
          {accion}
        </>
      }
    >
      {error.message}
    </Alerta>
  );
}

function Historial({ idEmpleado, clave }) {
  const rol = useRol();
  const { datos, error, reintentar } = useCarga(() => obtenerHistorialDesempeno(idEmpleado, rol), [idEmpleado, clave]);
  if (error) return <ErrorCarga error={error} titulo="No se pudo cargar su historial de desempeño" onReintentar={reintentar} />;
  if (!datos) {
    return (
      <div className="ev-carga" aria-busy="true">
        <p className="ds-solo-lector" role="status">
          Cargando su historial…
        </p>
        <Esqueleto forma="bloque" alto="14rem" />
      </div>
    );
  }
  return <HistorialDesempeno historial={datos} />;
}

function ListaResultados({ idEmpleado }) {
  const { datos, error, reintentar } = useCarga(() => listarMisResultados(idEmpleado), [idEmpleado]);
  const [actualizaciones, setActualizaciones] = useState(0);
  const actualizar = () => {
    reintentar();
    setActualizaciones((n) => n + 1);
  };

  return (
    <section className="ev-bandeja" aria-labelledby="ev-mis-resultados-titulo">
      <EncabezadoPagina
        migas={MIGAS}
        enlace={Link}
        titulo="Mis resultados"
        idTitulo="ev-mis-resultados-titulo"
        descripcion="Su puntaje de desempeño histórico, el consolidado de cada ciclo cerrado y sus evaluaciones enviadas con la retroalimentación de cada evaluador."
        acciones={
          <Boton icono={RefreshCw} onClick={actualizar}>
            Actualizar
          </Boton>
        }
      />
      <Historial idEmpleado={idEmpleado} clave={String(actualizaciones + 1)} />
      {error ? (
        <ErrorCarga error={error} titulo="No se pudieron cargar sus resultados" onReintentar={reintentar} />
      ) : (
        <Tarjeta nivelTitulo={2} titulo="Evaluaciones enviadas">
          <Tabla
            columnas={COLUMNAS}
            filas={datos ?? []}
            claveFila="id_evaluacion"
            descripcion="Sus evaluaciones enviadas"
            cargando={!datos}
            vacio={
              <EstadoVacio
                icono={Award}
                titulo="Aún no tiene resultados"
                mensaje="Cuando su evaluador envíe una evaluación de desempeño, verá aquí su puntaje y la retroalimentación."
              />
            }
          />
        </Tarjeta>
      )}
    </section>
  );
}

function VolverALaLista() {
  return (
    <Boton as={Link} to={RUTA_MIS_RESULTADOS} icono={ArrowLeft}>
      Volver a mis resultados
    </Boton>
  );
}

function DetalleResultado({ idEmpleado, idEvaluacion }) {
  const { datos, error, reintentar } = useCarga(() => obtenerMiResultado(idEmpleado, idEvaluacion), [idEmpleado, idEvaluacion]);
  const migas = [...MIGAS, { etiqueta: "Mis resultados", href: RUTA_MIS_RESULTADOS }];

  if (!datos) {
    return (
      <div className="ev-formulario">
        <EncabezadoPagina migas={migas} enlace={Link} titulo="Resultado de la evaluación" idTitulo="ev-mi-resultado-titulo" />
        {error ? (
          <ErrorCarga
            error={error}
            titulo={error.estado === 404 ? "No se encontró la evaluación" : "No se pudo abrir el resultado"}
            onReintentar={reintentar}
            accion={<VolverALaLista />}
          />
        ) : (
          <div className="ev-carga" aria-busy="true">
            <p className="ds-solo-lector" role="status">
              Cargando el resultado…
            </p>
            <Esqueleto forma="bloque" alto="6rem" />
            <Esqueleto forma="bloque" alto="12rem" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ev-formulario">
      <EncabezadoPagina
        migas={migas}
        enlace={Link}
        titulo={datos.ciclo.nombre}
        idTitulo="ev-mi-resultado-titulo"
        descripcion={datos.plantilla.objetivo}
      />
      <Tarjeta className="ev-resumen">
        <dl className="ev-datos">
          <div>
            <dt>Puntaje final</dt>
            <dd>
              <strong>{formatearPuntaje(datos.puntaje_final)}</strong> de 100
            </dd>
          </div>
          <div>
            <dt>Evaluador</dt>
            <dd>{datos.evaluador.nombre_completo}</dd>
          </div>
          <div>
            <dt>Enviada</dt>
            <dd>{formatearFechaHora(datos.enviada_en)}</dd>
          </div>
          <div>
            <dt>Plantilla</dt>
            <dd>{datos.plantilla.nombre}</dd>
          </div>
        </dl>
      </Tarjeta>
      <VistaRetroalimentacion retroalimentacion={datos.retroalimentacion} />
      <TablaResultado resultado={datos.resultado} />
      <div className="ev-pie">
        <VolverALaLista />
      </div>
    </div>
  );
}

export default function MisResultadosPage() {
  const { idEvaluacion } = useParams();
  const idEmpleado = useUsuario();

  if (!idEmpleado) {
    return (
      <section className="ev-bandeja">
        <EncabezadoPagina migas={MIGAS} enlace={Link} titulo="Mis resultados" />
        <EstadoVacio
          icono={UserRound}
          titulo="Elija su usuario de prueba"
          mensaje="Seleccione quién es en «Usuario de prueba», al pie de la barra lateral, para ver sus resultados."
        />
      </section>
    );
  }
  return idEvaluacion ? (
    <DetalleResultado key={`${idEmpleado}|${idEvaluacion}`} idEmpleado={idEmpleado} idEvaluacion={idEvaluacion} />
  ) : (
    <ListaResultados key={idEmpleado} idEmpleado={idEmpleado} />
  );
}
