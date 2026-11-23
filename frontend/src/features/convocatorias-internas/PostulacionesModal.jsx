import { useCallback, useState } from "react";
import { Trophy, Users } from "lucide-react";
import { listarPostulaciones, revalidarPostulacion } from "../../api/convocatoriasInternas";
import { Alerta, Boton, EstadoVacio, Esqueleto, Etiqueta, Modal, Tabla, useAvisos } from "../../components/ui";
import useRecurso from "../quejas/casos/useRecurso";
import { describirPermanencia, estadoConvocatoria, formatearNota, formatearPuntaje } from "./convocatorias";

const Postulante = ({ postulacion }) => (
  <div className="cv-celda">
    <span>{postulacion.nombre_completo}</span>
    <span className="cv-sutil">
      {postulacion.cargo_actual} · {postulacion.sucursal_actual}
    </span>
  </div>
);

// Compacta para que entre en el modal: permanencia y nota van juntas y el puntaje queda siempre visible.
const COLUMNAS_RANKING = [
  { clave: "posicion", titulo: "Puesto", ancho: "10%", celda: (p) => <span className="cv-numero">{p.posicion}</span> },
  { clave: "postulante", titulo: "Postulante", ancho: "36%", celda: (p) => <Postulante postulacion={p} /> },
  {
    clave: "meritos",
    titulo: "Méritos",
    ancho: "34%",
    celda: (p) => (
      <div className="cv-celda">
        <span>Última evaluación: {formatearNota(p.nota_ultima_evaluacion)}</span>
        <span className="cv-sutil">Permanencia: {describirPermanencia(p.meses_permanencia)}</span>
      </div>
    ),
  },
  {
    clave: "puntaje",
    titulo: "Puntaje",
    ancho: "20%",
    alinear: "fin",
    celda: (p) => <span className="cv-numero cv-puntaje">{formatearPuntaje(p.puntaje_meritos)}</span>,
  },
];

// Criterio 4: RRHH revisa las postulaciones de una convocatoria. Al cerrar, el ranking de aptos es el definitivo.
export default function PostulacionesModal({ convocatoria, sesion, puedeRevalidar, onCerrar }) {
  const avisar = useAvisos();
  const [revalidando, setRevalidando] = useState(null);
  const cargar = useCallback(() => listarPostulaciones(sesion, convocatoria.id_convocatoria), [sesion, convocatoria.id_convocatoria]);
  const { datos, error, cargando, reintentar } = useRecurso(cargar);

  const revalidar = async (postulacion) => {
    setRevalidando(postulacion.id_postulacion);
    try {
      const resultado = await revalidarPostulacion(sesion, convocatoria.id_convocatoria, postulacion.id_postulacion);
      avisar({
        tono: resultado.estado_postulacion === "PENDIENTE_VALIDACION" ? "aviso" : "exito",
        titulo: `Postulación de ${postulacion.nombre_completo}`,
        mensaje:
          resultado.estado_postulacion === "PENDIENTE_VALIDACION"
            ? "PerformanceService sigue sin responder. Intente más tarde."
            : resultado.estado_postulacion === "APTO"
              ? "Validada: cumple los requisitos."
              : "Validada: no cumple algún requisito.",
      });
    } catch (fallo) {
      avisar({ tono: "peligro", titulo: "No se pudo validar la postulación", mensaje: fallo.message });
    } finally {
      setRevalidando(null);
      reintentar();
    }
  };

  const estado = estadoConvocatoria(convocatoria.estado);

  return (
    <Modal abierto titulo={`Postulaciones: ${convocatoria.titulo}`} tamano="lg" onCerrar={onCerrar} pie={<Boton onClick={onCerrar}>Cerrar</Boton>}>
      <div className="cv-apilado">
        {error && (
          <Alerta tono="peligro" role="alert" titulo="No se pudieron cargar las postulaciones" acciones={<Boton tamano="sm" onClick={reintentar}>Reintentar</Boton>}>
            {error.message}
          </Alerta>
        )}
        {!datos && !error && <Esqueleto forma="bloque" alto="10rem" />}

        {datos && (
          <>
            <div className="cv-resumen-postulaciones">
              <Etiqueta tono={estado.tono} icono={estado.icono}>
                {estado.texto}
              </Etiqueta>
              <span className="cv-sutil" role="status">
                {datos.totales.postulaciones} postulaciones · {datos.totales.aptos} aptos · {datos.totales.no_aptos} no aptos
                {datos.totales.pendientes > 0 && ` · ${datos.totales.pendientes} pendientes de validar`}
              </span>
            </div>
            <p className="cv-sutil">
              Requisitos: {describirPermanencia(datos.convocatoria.meses_antiguedad_minima)} de permanencia y nota mínima{" "}
              {formatearNota(datos.convocatoria.nota_minima_desempeno)} en la última evaluación. Puntaje de méritos: {datos.formula_meritos.descripcion}.
            </p>

            <section className="cv-apilado" aria-labelledby="cv-ranking-titulo">
              <h3 id="cv-ranking-titulo" className="cv-subtitulo">
                <Trophy className="ds-icono" aria-hidden="true" /> {datos.ranking_definitivo ? "Ranking final de aptos" : "Ranking provisional de aptos"}
              </h3>
              {!datos.ranking_definitivo && (
                <Alerta tono="info" titulo="La convocatoria sigue recibiendo postulaciones">
                  El ranking es definitivo cuando la convocatoria cierra.
                </Alerta>
              )}
              <Tabla
                className="cv-tabla-ranking"
                descripcion="Ranking de postulantes aptos por puntaje de méritos"
                columnas={COLUMNAS_RANKING}
                filas={datos.ranking}
                claveFila="id_postulacion"
                cargando={cargando && !datos}
                vacio={<EstadoVacio icono={Users} titulo="Todavía no hay postulantes aptos" />}
              />
            </section>

            {datos.no_aptos.length > 0 && (
              <section className="cv-apilado" aria-labelledby="cv-no-aptos-titulo">
                <h3 id="cv-no-aptos-titulo" className="cv-subtitulo">
                  No aptos
                </h3>
                <ul className="cv-lista-postulaciones" aria-label="Postulantes no aptos">
                  {datos.no_aptos.map((p) => (
                    <li key={p.id_postulacion}>
                      <Postulante postulacion={p} />
                      <ul className="cv-motivos">
                        {p.motivos_no_apto.map((motivo) => (
                          <li key={motivo}>{motivo}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {datos.pendientes.length > 0 && (
              <section className="cv-apilado" aria-labelledby="cv-pendientes-titulo">
                <h3 id="cv-pendientes-titulo" className="cv-subtitulo">
                  Pendientes de validar
                </h3>
                <ul className="cv-lista-postulaciones" aria-label="Postulaciones pendientes de validar">
                  {datos.pendientes.map((p) => (
                    <li key={p.id_postulacion} className="cv-pendiente">
                      <div className="cv-celda">
                        <Postulante postulacion={p} />
                        {p.error_validacion && <span className="cv-sutil cv-error">{p.error_validacion}</span>}
                      </div>
                      {puedeRevalidar && (
                        <Boton tamano="sm" cargando={revalidando === p.id_postulacion} onClick={() => revalidar(p)}>
                          Volver a validar
                        </Boton>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
