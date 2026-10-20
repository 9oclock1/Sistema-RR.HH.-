import { useEffect, useState } from "react";
import { 
  AlertCircle, 
  AlertTriangle, 
  Award, 
  Briefcase, 
  CheckCircle2, 
  GraduationCap, 
  RefreshCw, 
  Sliders, 
  XCircle 
} from "lucide-react";
import { Alerta, Boton, CampoTexto, Esqueleto, Etiqueta, Modal } from "../../../components/ui";
import { postulacionApi } from "../../../api/postulacion";
import "./AffinityBreakdownModal.css";

export default function AffinityBreakdownModal({
  abierto,
  onCerrar,
  idPostulacion,
  nombrePostulante = "Postulante",
  alRecalcular,
}) {
  const [cargando, setCargando] = useState(true);
  const [recalculando, setRecalculando] = useState(false);
  const [error, setError] = useState(null);
  const [datos, setDatos] = useState(null);

  // Modo edición de pesos
  const [mostrarPesos, setMostrarPesos] = useState(false);
  const [pesos, setPesos] = useState({
    pesoEducacion: 25,
    pesoExperiencia: 35,
    pesoHabilidades: 40,
  });
  const [errorPesos, setErrorPesos] = useState(null);

  useEffect(() => {
    let montado = true;
    if (!abierto || !idPostulacion) return;

    async function cargarDetalle() {
      setCargando(true);
      setError(null);
      try {
        const respuesta = await postulacionApi.obtenerAfinidadPostulacion(idPostulacion);
        if (!montado) return;
        setDatos(respuesta);
        if (respuesta?.desglose) {
          setPesos({
            pesoEducacion: respuesta.desglose.educacion.pesoAsignado,
            pesoExperiencia: respuesta.desglose.experiencia.pesoAsignado,
            pesoHabilidades: respuesta.desglose.habilidades.pesoAsignado,
          });
        }
      } catch (err) {
        if (montado) setError(err.message || "No se pudo recuperar el desglose de afinidad.");
      } finally {
        if (montado) setCargando(false);
      }
    }

    cargarDetalle();
    return () => {
      montado = false;
    };
  }, [abierto, idPostulacion]);

  const manejarCambioPeso = (campo, valor) => {
    setPesos((prev) => ({ ...prev, [campo]: Number(valor) || 0 }));
    setErrorPesos(null);
  };

  const aplicarNuevosPesos = async (e) => {
    e.preventDefault();
    const suma = Number(pesos.pesoEducacion) + Number(pesos.pesoExperiencia) + Number(pesos.pesoHabilidades);
    if (suma !== 100) {
      setErrorPesos(`La suma de los pesos debe ser 100% (actualmente suma ${suma}%).`);
      return;
    }

    setRecalculando(true);
    setError(null);
    try {
      // Los pesos pertenecen a la convocatoria: se guardan y se recalcula todo su ranking.
      await postulacionApi.recalcularAfinidadConvocatoria(datos.idConvocatoria, pesos);
      setDatos(await postulacionApi.obtenerAfinidadPostulacion(idPostulacion));
      setMostrarPesos(false);
      if (alRecalcular) alRecalcular();
    } catch (err) {
      setError(err.message || "Error al recalcular con los nuevos pesos.");
    } finally {
      setRecalculando(false);
    }
  };

  if (!abierto) return null;

  const desglose = datos?.desglose;
  const esApto = datos?.esApto ?? true;
  const motivos = datos?.motivosNoApto || [];

  const pie = (
    <div className="affinity-modal__pie">
      <Boton
        variante="sutil"
        icono={Sliders}
        onClick={() => setMostrarPesos(!mostrarPesos)}
        disabled={cargando || recalculando}
      >
        {mostrarPesos ? "Ocultar ponderaciones" : "Configurar pesos"}
      </Boton>
      <Boton variante="predeterminado" onClick={onCerrar}>
        Cerrar
      </Boton>
    </div>
  );

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={`Desglose de Afinidad Curricular — ${nombrePostulante}`}
      tamano="lg"
      pie={pie}
    >
      <div className="affinity-modal__cuerpo">
        {cargando ? (
          <div className="affinity-modal__esqueleto">
            <Esqueleto ancho="100%" alto="80px" />
            <Esqueleto ancho="100%" alto="120px" />
            <Esqueleto ancho="100%" alto="140px" />
          </div>
        ) : error ? (
          <Alerta tono="peligro" titulo="Error de cálculo" role="alert">
            {error}
          </Alerta>
        ) : (
          <>
            {/* Cabecera de Resultado Principal */}
            <div className={`affinity-resumen-card ${esApto ? "affinity-resumen-card--apto" : "affinity-resumen-card--no-apto"}`}>
              <div className="affinity-resumen-card__info">
                <span className="affinity-resumen-card__subtitulo">Afinidad Calculada</span>
                <div className="affinity-resumen-card__score-box">
                  <span className="affinity-resumen-card__score">{Math.round(datos.porcentajeAfinidad)}%</span>
                  <Etiqueta tono={esApto ? (datos.porcentajeAfinidad >= 75 ? "exito" : "aviso") : "peligro"}>
                    {esApto ? "Candidato Apto" : "Condición No Apta"}
                  </Etiqueta>
                </div>
              </div>

              {!esApto && (
                <div className="affinity-resumen-card__alertas">
                  <div className="affinity-alerta-item">
                    <AlertTriangle className="ds-icono" aria-hidden="true" />
                    <span>Está lejos de requisito(s) obligatorio(s) de la vacante:</span>
                  </div>
                  <ul className="affinity-alerta-lista">
                    {motivos.map((motivo, idx) => (
                      <li key={idx}>{motivo}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Panel colapsable de Configuración de Pesos (Criterio 2) */}
            {mostrarPesos && (
              <form onSubmit={aplicarNuevosPesos} className="affinity-pesos-form">
                <div className="affinity-pesos-form__cabecera">
                  <span className="affinity-pesos-form__titulo">Ponderación de Requisitos (%)</span>
                  <span className="affinity-pesos-form__meta">
                    Deben sumar exactamente 100%. Se aplican a todos los postulantes de la vacante.
                  </span>
                </div>

                {errorPesos && (
                  <p className="affinity-pesos-form__error" role="alert">
                    <AlertCircle className="ds-icono" aria-hidden="true" />
                    {errorPesos}
                  </p>
                )}

                <div className="affinity-pesos-form__grid">
                  <CampoTexto
                    etiqueta="Educación (%)"
                    type="number"
                    min="0"
                    max="100"
                    value={pesos.pesoEducacion}
                    onChange={(e) => manejarCambioPeso("pesoEducacion", e.target.value)}
                    disabled={recalculando}
                  />
                  <CampoTexto
                    etiqueta="Experiencia (%)"
                    type="number"
                    min="0"
                    max="100"
                    value={pesos.pesoExperiencia}
                    onChange={(e) => manejarCambioPeso("pesoExperiencia", e.target.value)}
                    disabled={recalculando}
                  />
                  <CampoTexto
                    etiqueta="Habilidades (%)"
                    type="number"
                    min="0"
                    max="100"
                    value={pesos.pesoHabilidades}
                    onChange={(e) => manejarCambioPeso("pesoHabilidades", e.target.value)}
                    disabled={recalculando}
                  />
                </div>

                <div className="affinity-pesos-form__acciones">
                  <Boton
                    type="submit"
                    tamano="sm"
                    variante="primario"
                    icono={RefreshCw}
                    cargando={recalculando}
                  >
                    Guardar y recalcular ranking
                  </Boton>
                </div>
              </form>
            )}

            {/* Desglose por Dimensión */}
            {desglose && (
              <div className="affinity-dimensiones">
                {/* 1. Educación */}
                <div className="affinity-seccion">
                  <div className="affinity-seccion__cabecera">
                    <div className="affinity-seccion__titulo">
                      <GraduationCap className="ds-icono" aria-hidden="true" />
                      <span>Formación y Educación</span>
                    </div>
                    <span className="affinity-seccion__puntos">
                      {desglose.educacion.puntosAportados} / {desglose.educacion.pesoAsignado} pts
                    </span>
                  </div>

                  <div className="affinity-seccion__detalle">
                    <div className="affinity-comparativa-fila">
                      <span className="affinity-comparativa-fila__label">Requerido:</span>
                      <span className="affinity-comparativa-fila__val">{desglose.educacion.nivelRequerido}</span>
                    </div>
                    <div className="affinity-comparativa-fila">
                      <span className="affinity-comparativa-fila__label">Detectado en CV:</span>
                      <span className="affinity-comparativa-fila__val">
                        {desglose.educacion.nivelDetectado}
                        {desglose.educacion.enCurso && " (en curso)"}
                      </span>
                    </div>
                    <div className="affinity-comparativa-fila">
                      <span className="affinity-comparativa-fila__label">Condición:</span>
                      {desglose.educacion.cumple ? (
                        <Etiqueta tono="exito" icono={CheckCircle2}>Cumple requisito</Etiqueta>
                      ) : (
                        <Etiqueta
                          tono={desglose.educacion.porcentajeObtenido >= 50 ? "aviso" : "peligro"}
                          icono={desglose.educacion.porcentajeObtenido >= 50 ? AlertTriangle : XCircle}
                        >
                          {desglose.educacion.porcentajeObtenido}% alcanzado
                        </Etiqueta>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Experiencia */}
                <div className="affinity-seccion">
                  <div className="affinity-seccion__cabecera">
                    <div className="affinity-seccion__titulo">
                      <Briefcase className="ds-icono" aria-hidden="true" />
                      <span>Experiencia Laboral</span>
                    </div>
                    <span className="affinity-seccion__puntos">
                      {desglose.experiencia.puntosAportados} / {desglose.experiencia.pesoAsignado} pts
                    </span>
                  </div>

                  <div className="affinity-seccion__detalle">
                    <div className="affinity-comparativa-fila">
                      <span className="affinity-comparativa-fila__label">Mínimo requerido:</span>
                      <span className="affinity-comparativa-fila__val">{desglose.experiencia.aniosRequeridos} años</span>
                    </div>
                    <div className="affinity-comparativa-fila">
                      <span className="affinity-comparativa-fila__label">Años acumulados en CV:</span>
                      <span className="affinity-comparativa-fila__val">{desglose.experiencia.aniosDetectados} años</span>
                    </div>
                    <div className="affinity-comparativa-fila">
                      <span className="affinity-comparativa-fila__label">Condición:</span>
                      {desglose.experiencia.cumple ? (
                        <Etiqueta tono="exito" icono={CheckCircle2}>Cumple experiencia</Etiqueta>
                      ) : (
                        <Etiqueta
                          tono={desglose.experiencia.porcentajeObtenido >= 50 ? "aviso" : "peligro"}
                          icono={desglose.experiencia.porcentajeObtenido >= 50 ? AlertTriangle : XCircle}
                        >
                          {desglose.experiencia.porcentajeObtenido}% alcanzado
                        </Etiqueta>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Habilidades Clave */}
                <div className="affinity-seccion">
                  <div className="affinity-seccion__cabecera">
                    <div className="affinity-seccion__titulo">
                      <Award className="ds-icono" aria-hidden="true" />
                      <span>
                        Habilidades Técnicas ({desglose.habilidades.totalCumplidas} cumplidas
                        {desglose.habilidades.totalParciales > 0 && `, ${desglose.habilidades.totalParciales} parciales`} de{" "}
                        {desglose.habilidades.totalRequeridas})
                      </span>
                    </div>
                    <span className="affinity-seccion__puntos">
                      {desglose.habilidades.puntosAportados} / {desglose.habilidades.pesoAsignado} pts
                    </span>
                  </div>

                  <div className="affinity-habilidades-bloque">
                    {/* Habilidades Cumplidas */}
                    {desglose.habilidades.cumplidas.length > 0 && (
                      <div className="affinity-grupo-habilidades">
                        <span className="affinity-grupo-habilidades__titulo">Cumplidas o equivalentes</span>
                        <div className="affinity-tags-wrap">
                          {desglose.habilidades.cumplidas.map((item, idx) => (
                            <span key={idx} className="affinity-tag affinity-tag--cumplida" title={`Coincidencia semántica con "${item.habilidadCoincidente}" (${Math.round(item.similitud * 100)}%)`}>
                              <CheckCircle2 className="ds-icono" aria-hidden="true" />
                              <strong>{item.habilidadRequerida}</strong>
                              <span className="affinity-tag__match">≈ {item.habilidadCoincidente}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Habilidades Incumplidas */}
                    {desglose.habilidades.incumplidas.length > 0 && (
                      <div className="affinity-grupo-habilidades">
                        <span className="affinity-grupo-habilidades__titulo">No identificadas en el perfil</span>
                        <div className="affinity-tags-wrap">
                          {desglose.habilidades.incumplidas.map((hab, idx) => (
                            <span key={idx} className="affinity-tag affinity-tag--incumplida">
                              <XCircle className="ds-icono" aria-hidden="true" />
                              {hab}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Habilidades Adicionales (Plus del candidato) */}
                    {desglose.habilidades.habilidadesExtraCandidato?.length > 0 && (
                      <div className="affinity-grupo-habilidades">
                        <span className="affinity-grupo-habilidades__titulo">Otras destrezas del candidato (Plus)</span>
                        <div className="affinity-tags-wrap">
                          {desglose.habilidades.habilidadesExtraCandidato.map((extra, idx) => (
                            <span key={idx} className="affinity-tag affinity-tag--extra">
                              {extra}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}