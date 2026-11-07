import { useCallback, useMemo } from "react";
import { Link } from "react-router";
import { ArrowLeft, FileText, SearchX, ShieldCheck } from "lucide-react";
import {
  listarCatalogosCasos,
  listarEmpleadosQueja,
  listarResponsablesQueja,
  obtenerCasoQueja,
} from "../../../api/casosQueja";
import {
  Alerta,
  Boton,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  Tarjeta,
} from "../../../components/ui";
import { useRol, useUsuario } from "../../../context/sesion";
import { formatearFechaHora, tonoEstado } from "../formato";
import DerivacionesQueja from "./DerivacionesQueja";
import FormularioDerivacion from "./FormularioDerivacion";
import InvolucradosQueja from "./InvolucradosQueja";
import { nombreDe, RUTA_CASOS_QUEJA, tonoPrioridad } from "./casos";
import useRecurso from "./useRecurso";
import "../quejas.css";
import "./casos.css";

const tamanoLegible = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function ResumenCaso({ caso }) {
  return (
    <Tarjeta nivelTitulo={2} titulo="Queja" className="qc-tarjeta">
      <div className="qc-etiquetas">
        <Etiqueta tono={tonoEstado(caso.estado.codigo)}>{caso.estado.nombre}</Etiqueta>
        {caso.prioridad ? (
          <Etiqueta tono={tonoPrioridad(caso.prioridad.codigo)}>Prioridad {caso.prioridad.nombre.toLowerCase()}</Etiqueta>
        ) : (
          <Etiqueta>Sin prioridad</Etiqueta>
        )}
        {caso.es_anonima && <Etiqueta tono="morado">Anónima</Etiqueta>}
      </div>

      <dl className="qj-datos">
        <div>
          <dt>Categoría</dt>
          <dd>{caso.categoria.nombre}</dd>
        </div>
        <div>
          <dt>Registrada</dt>
          <dd>{formatearFechaHora(caso.registrada_en)}</dd>
        </div>
        <div>
          <dt>Presentada por</dt>
          <dd>{caso.es_anonima ? "Anónimo, sin datos de quien la presentó" : nombreDe(caso.denunciante)}</dd>
        </div>
        <div>
          <dt>Responsable</dt>
          <dd>{caso.responsable ? nombreDe(caso.responsable) : "Sin asignar"}</dd>
        </div>
      </dl>

      <div className="qc-bloque">
        <h3 className="qc-subtitulo">Asunto</h3>
        <p className="qc-texto">{caso.asunto}</p>
      </div>
      <div className="qc-bloque">
        <h3 className="qc-subtitulo">Descripción</h3>
        <p className="qc-texto">{caso.descripcion}</p>
      </div>

      {caso.adjuntos.length > 0 && (
        <div className="qc-bloque">
          <h3 className="qc-subtitulo">Adjuntos</h3>
          <ul className="qj-archivos">
            {caso.adjuntos.map((adjunto) => (
              <li key={adjunto.orden} className="qj-archivo">
                <FileText className="ds-icono qj-archivo__icono" aria-hidden="true" />
                <span className="qj-archivo__nombre">{adjunto.nombre}</span>
                <span className="qj-archivo__tamano">{tamanoLegible(adjunto.tamano_bytes)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="qj-nota qj-nota--privacidad">
        <ShieldCheck className="ds-icono" aria-hidden="true" />
        La descripción solo la ve el Administrador de RRHH; el aviso al responsable no la incluye.
      </p>
    </Tarjeta>
  );
}

function HistorialCaso({ caso }) {
  return (
    <Tarjeta nivelTitulo={2} titulo="Historial de estados" className="qc-tarjeta">
      <ol className="qj-historial">
        {caso.historial.map((paso) => (
          <li key={`${paso.estado.codigo}-${paso.fecha}`} className="qj-historial__paso">
            <span className="qj-historial__estado">
              {paso.estado.nombre}
              {paso.registrado_por && <span className="qc-sutil"> · por {nombreDe(paso.registrado_por)}</span>}
            </span>
            <span className="qj-historial__fecha">{formatearFechaHora(paso.fecha)}</span>
          </li>
        ))}
      </ol>
    </Tarjeta>
  );
}

function Cargando() {
  return (
    <div className="qc-detalle" aria-busy="true">
      <div className="qc-columna">
        <Esqueleto forma="bloque" alto="calc(var(--size-row) * 8)" />
      </div>
      <div className="qc-columna">
        <Esqueleto forma="bloque" alto="calc(var(--size-row) * 6)" />
      </div>
    </div>
  );
}

export default function DetalleCasoQuejaPage({ idQueja }) {
  const rol = useRol();
  const idEmpleado = useUsuario();
  const sesion = useMemo(() => ({ rol, idEmpleado }), [rol, idEmpleado]);

  const caso = useRecurso(useCallback(() => obtenerCasoQueja(sesion, idQueja), [sesion, idQueja]));
  const catalogos = useRecurso(useCallback(() => listarCatalogosCasos(sesion), [sesion]));
  const responsables = useRecurso(useCallback(() => listarResponsablesQueja(sesion), [sesion]));
  const empleados = useRecurso(useCallback(() => listarEmpleadosQueja(), []));

  const datos = caso.datos;
  const editable = datos && !datos.estado.es_final;
  const sinUsuario = !idEmpleado;
  const deshabilitado = sinUsuario || !editable;

  const listaResponsables = {
    lista: responsables.datos,
    cargando: responsables.cargando,
    error: responsables.error?.message,
    reintentar: responsables.reintentar,
  };
  const listaEmpleados = {
    lista: empleados.datos,
    error: empleados.error?.message,
    reintentar: empleados.reintentar,
  };

  let contenido;
  if (caso.error && !datos) {
    contenido =
      caso.error.estado === 404 ? (
        <EstadoVacio
          icono={SearchX}
          titulo="No se encontró la queja"
          mensaje="Puede que el enlace esté incompleto. Vuelva a la bandeja y ábrala desde la lista."
          accion={
            <Boton as={Link} to={RUTA_CASOS_QUEJA}>
              Volver a la bandeja
            </Boton>
          }
        />
      ) : (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudo cargar la queja"
          acciones={
            <Boton tamano="sm" onClick={caso.reintentar}>
              Reintentar
            </Boton>
          }
        >
          {caso.error.message}
        </Alerta>
      );
  } else if (catalogos.error && !catalogos.datos) {
    contenido = (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudieron cargar las categorías y prioridades"
        acciones={
          <Boton tamano="sm" onClick={catalogos.reintentar}>
            Reintentar
          </Boton>
        }
      >
        {catalogos.error.message}
      </Alerta>
    );
  } else if (!datos || !catalogos.datos) {
    contenido = <Cargando />;
  } else {
    contenido = (
      <>
        {sinUsuario && editable && (
          <Alerta tono="aviso" titulo="Elija su usuario de prueba">
            Para clasificar, derivar o registrar involucrados, seleccione quién es en «Usuario de prueba», al pie de la
            barra lateral.
          </Alerta>
        )}
        {!editable && (
          <Alerta tono="info" titulo="Queja cerrada">
            La queja está en estado «{datos.estado.nombre}» y ya no admite cambios.
          </Alerta>
        )}
        <div className="qc-detalle">
          <div className="qc-columna">
            <ResumenCaso caso={datos} />
            <HistorialCaso caso={datos} />
          </div>
          <div className="qc-columna">
            {editable && (
              <FormularioDerivacion
                key={datos.actualizada_en}
                caso={datos}
                sesion={sesion}
                catalogos={catalogos.datos}
                responsables={listaResponsables}
                deshabilitado={deshabilitado}
                onActualizado={caso.reintentar}
              />
            )}
            <InvolucradosQueja
              caso={datos}
              sesion={sesion}
              empleados={listaEmpleados}
              deshabilitado={deshabilitado}
              onActualizado={caso.reintentar}
            />
            <DerivacionesQueja
              caso={datos}
              sesion={sesion}
              deshabilitado={deshabilitado}
              onActualizado={caso.reintentar}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <section className="qc-pagina" aria-labelledby="qc-detalle-titulo">
      <EncabezadoPagina
        migas={[
          { etiqueta: "Inicio", href: "/" },
          { etiqueta: "Desempeño" },
          { etiqueta: "Casos de quejas", href: RUTA_CASOS_QUEJA },
        ]}
        enlace={Link}
        titulo={datos ? `Queja ${datos.codigo_seguimiento}` : "Caso de queja"}
        idTitulo="qc-detalle-titulo"
        acciones={
          <Boton as={Link} to={RUTA_CASOS_QUEJA} icono={ArrowLeft}>
            Volver a la bandeja
          </Boton>
        }
      />
      {contenido}
    </section>
  );
}
