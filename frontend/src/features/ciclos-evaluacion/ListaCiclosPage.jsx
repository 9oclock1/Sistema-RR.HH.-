import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { CalendarPlus, CalendarRange, FilterX, RefreshCw } from "lucide-react";
import { listarCiclos } from "../../api/ciclosEvaluacion";
import {
  Alerta,
  Boton,
  EncabezadoPagina,
  EstadoVacio,
  Etiqueta,
  Selector,
  Tabla,
  Tarjeta,
  TextoTruncado,
} from "../../components/ui";
import { useRol, useUsuario } from "../../context/sesion";
import useRecurso from "../quejas/casos/useRecurso";
import { describirPlazo } from "../evaluaciones/formato";
import { ESTADOS_CICLO, RUTA_NUEVO_CICLO, estadoCiclo, formatearDia, rutaCiclo } from "./ciclo";
import "./ciclosEvaluacion.css";

const columnas = [
  {
    clave: "nombre",
    titulo: "Ciclo",
    ancho: "32%",
    celda: (ciclo) => (
      <div className="cev-celda">
        <Link className="cev-enlace" to={rutaCiclo(ciclo.id_ciclo)}>
          <TextoTruncado>{ciclo.nombre}</TextoTruncado>
        </Link>
        <span className="cev-sutil">
          {ciclo.plantilla} · versión {ciclo.numero_version} · {ciclo.periodo}
        </span>
      </div>
    ),
  },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "14%",
    celda: (ciclo) => {
      const estado = estadoCiclo(ciclo.estado_codigo);
      return (
        <Etiqueta tono={estado.tono} icono={estado.icono}>
          {estado.texto}
        </Etiqueta>
      );
    },
  },
  {
    clave: "plazo",
    titulo: "Plazo",
    ancho: "24%",
    celda: (ciclo) => (
      <div className="cev-celda">
        <span className="cev-fecha">
          {formatearDia(ciclo.fecha_inicio)} – {formatearDia(ciclo.fecha_limite)}
        </span>
        {ciclo.estado_codigo === "ACTIVO" && (
          <span className="cev-sutil">{describirPlazo(ciclo.fecha_limite).texto}</span>
        )}
      </div>
    ),
  },
  {
    clave: "avance",
    titulo: "Avance",
    ancho: "18%",
    celda: (ciclo) => (
      <div className="cev-celda">
        <span>
          {ciclo.enviadas} de {ciclo.total} enviadas
        </span>
        {ciclo.vencidas > 0 && <span className="cev-sutil">{ciclo.vencidas} vencidas</span>}
      </div>
    ),
  },
  {
    clave: "accion",
    titulo: <span className="ds-solo-lector">Acción</span>,
    ancho: "12%",
    alinear: "fin",
    celda: (ciclo) => (
      <Boton as={Link} to={rutaCiclo(ciclo.id_ciclo)} tamano="sm" aria-label={`Ver el ciclo ${ciclo.nombre}`}>
        Ver
      </Boton>
    ),
  },
];

const opcionesEstado = Object.entries(ESTADOS_CICLO).map(([valor, { texto }]) => ({ valor, etiqueta: texto }));

export default function ListaCiclosPage() {
  const rol = useRol();
  const idEmpleado = useUsuario();
  const [estado, setEstado] = useState("");
  const cargar = useCallback(() => listarCiclos({ rol }), [rol]);
  const { datos: ciclos, error, cargando, reintentar } = useRecurso(cargar);

  const filas = useMemo(
    () => (ciclos ?? []).filter((ciclo) => !estado || ciclo.estado_codigo === estado),
    [ciclos, estado],
  );

  const botonProgramar = idEmpleado ? (
    <Boton as={Link} to={RUTA_NUEVO_CICLO} variante="primario" icono={CalendarPlus}>
      Programar ciclo
    </Boton>
  ) : (
    <Boton variante="primario" icono={CalendarPlus} disabled title="Elija su usuario de prueba para programar ciclos">
      Programar ciclo
    </Boton>
  );

  return (
    <section className="cev-pagina" aria-labelledby="cev-lista-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Desempeño" }]}
        enlace={Link}
        titulo="Ciclos de evaluación"
        idTitulo="cev-lista-titulo"
        descripcion="Programe los ciclos de evaluación por periodo y asígnelos a áreas, sucursales o colaboradores con fecha límite."
        acciones={
          <>
            <Boton icono={RefreshCw} onClick={reintentar}>
              Actualizar
            </Boton>
            {botonProgramar}
          </>
        }
      />

      {!idEmpleado && (
        <Alerta tono="aviso" titulo="Elija su usuario de prueba">
          Seleccione quién es en «Usuario de prueba», al pie de la barra lateral, para programar ciclos.
        </Alerta>
      )}

      <Tarjeta nivelTitulo={2} titulo="Ciclos programados">
        {error ? (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudieron cargar los ciclos"
            acciones={
              <Boton tamano="sm" onClick={reintentar}>
                Reintentar
              </Boton>
            }
          >
            {error.message}
          </Alerta>
        ) : (
          <>
            <div className="cev-filtros">
              <Selector
                etiqueta="Estado"
                value={estado}
                onChange={(evento) => setEstado(evento.target.value)}
                opciones={opcionesEstado}
                textoVacio="Todos los estados"
                disabled={!ciclos}
              />
            </div>
            <Tabla
              className="cev-tabla"
              columnas={columnas}
              filas={filas}
              claveFila="id_ciclo"
              descripcion="Ciclos de evaluación"
              cargando={cargando}
              vacio={
                estado ? (
                  <EstadoVacio
                    icono={FilterX}
                    titulo="Ningún ciclo coincide con el filtro"
                    mensaje="Pruebe con otro estado."
                    accion={<Boton onClick={() => setEstado("")}>Quitar filtro</Boton>}
                  />
                ) : (
                  <EstadoVacio
                    icono={CalendarRange}
                    titulo="Aún no hay ciclos de evaluación"
                    mensaje="Programe el primero para asignar evaluaciones al personal."
                    accion={botonProgramar}
                  />
                )
              }
            />
          </>
        )}
      </Tarjeta>
    </section>
  );
}
