import { useEffect, useState, useRef } from "react";
import { CheckCircle2, AlertCircle, Sparkles, Plus, Trash2, Save, Loader2, Cpu, Briefcase, GraduationCap } from "lucide-react";
import { Tarjeta, Boton, CampoTexto, Alerta, Etiqueta, Modal, useAvisos } from "../../../components/ui";
import { postulacionApi } from "../../../api/postulacion";
import "./CvDatosExtraidos.css";

export default function CvDatosExtraidos({ idPostulacion, tieneCv, alActualizar }) {
  const avisar = useAvisos();
  const [cargando, setCargando] = useState(true);
  const [procesandoIA, setProcesandoIA] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);

  const [estadoExtraccion, setEstadoExtraccion] = useState("PENDIENTE");
  const [esVerificado, setEsVerificado] = useState(false);
  const [aniosExperiencia, setAniosExperiencia] = useState(0);
  const [educacion, setEducacion] = useState([]);
  const [experienciaLaboral, setExperienciaLaboral] = useState([]);
  const [destrezas, setDestrezas] = useState([]);
  const [nuevaDestreza, setNuevaDestreza] = useState("");

  const postulacionProcesadaRef = useRef(null);

  useEffect(() => {
    let montado = true;
    if (!idPostulacion || !tieneCv) {
      setCargando(false);
      return;
    }

    async function verificarYAutoAnalizar() {
      setCargando(true);
      setErrorCarga(null);

      try {
        const respuesta = await postulacionApi.obtenerDatosCv(idPostulacion);
        if (!montado) return;

        const info = respuesta?.datosCv;
        const requiereAnalisis =
          !info ||
          info.estadoExtraccion === "PENDIENTE" ||
          (!info.educacion?.length && !info.destrezasTecnicas?.length && !info.experienciaLaboral?.length && info.estadoExtraccion !== "FALLIDA");

        if (requiereAnalisis && postulacionProcesadaRef.current !== idPostulacion) {
          postulacionProcesadaRef.current = idPostulacion;
          setProcesandoIA(true);
          setCargando(false);

          try {
            const datosAuto = await postulacionApi.analizarCv(idPostulacion);
            if (!montado) return;
            setEstadoExtraccion(datosAuto.estadoExtraccion || "EXITOSA");
            setEsVerificado(Boolean(datosAuto.esVerificado));
            setAniosExperiencia(datosAuto.aniosExperienciaEstimados ?? 0);
            setEducacion(datosAuto.educacion || []);
            setExperienciaLaboral(datosAuto.experienciaLaboral || []);
            setDestrezas(datosAuto.destrezasTecnicas || []);
            avisar({ tono: "exito", titulo: "CV digitalizado", mensaje: "Datos extraídos automáticamente." });
            if (alActualizar) alActualizar();
          } catch (errIa) {
            if (montado) setEstadoExtraccion("FALLIDA");
          } finally {
            if (montado) setProcesandoIA(false);
          }
          return;
        }

        setEstadoExtraccion(info?.estadoExtraccion || "EXITOSA");
        setEsVerificado(Boolean(info?.esVerificado));
        setAniosExperiencia(info?.aniosExperienciaEstimados ?? 0);
        setEducacion(info?.educacion || []);
        setExperienciaLaboral(info?.experienciaLaboral || []);
        setDestrezas(info?.destrezasTecnicas || []);
      } catch (err) {
        if (montado) setErrorCarga(err.message);
      } finally {
        if (montado) setCargando(false);
      }
    }

    verificarYAutoAnalizar();
    return () => {
      montado = false;
    };
  }, [idPostulacion, tieneCv]);

  const manejarCambioExperiencia = (indice, campo, valor) => {
    setExperienciaLaboral((prev) => {
      const nueva = [...prev];
      nueva[indice] = { ...nueva[indice], [campo]: valor };
      return nueva;
    });
  };

  const agregarExperiencia = () => {
    setExperienciaLaboral((prev) => [
      ...prev,
      { puesto: "", empresa: "", anioInicio: "", anioFin: "", esActual: false },
    ]);
  };

  const eliminarExperiencia = (indice) => {
    setExperienciaLaboral((prev) => prev.filter((_, i) => i !== indice));
  };

  const manejarCambioEducacion = (indice, campo, valor) => {
    setEducacion((prev) => {
      const nueva = [...prev];
      nueva[indice] = { ...nueva[indice], [campo]: valor };
      return nueva;
    });
  };

  const agregarEducacion = () => setEducacion((prev) => [...prev, { institucion: "", titulo: "", anioFin: "" }]);
  const eliminarEducacion = (indice) => setEducacion((prev) => prev.filter((_, i) => i !== indice));

  const agregarDestreza = (e) => {
    if (e.key === "Enter" || e.type === "click") {
      e.preventDefault();
      const limpia = nuevaDestreza.trim();
      if (limpia && !destrezas.includes(limpia)) {
        setDestrezas((prev) => [...prev, limpia]);
        setNuevaDestreza("");
      }
    }
  };

  const eliminarDestreza = (item) => setDestrezas((prev) => prev.filter((d) => d !== item));

  const manejarGuardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const payload = {
        aniosExperienciaEstimados: Number(aniosExperiencia) || 0,
        educacion: educacion.map((ed) => ({
          institucion: ed.institucion.trim(),
          titulo: ed.titulo.trim(),
          anioFin: ed.anioFin && String(ed.anioFin).trim() !== "" ? Number(ed.anioFin) : null,
        })),
        experienciaLaboral: experienciaLaboral.map((exp) => ({
          puesto: exp.puesto.trim(),
          empresa: exp.empresa ? exp.empresa.trim() : "No especificada",
          anioInicio: exp.anioInicio && String(exp.anioInicio).trim() !== "" ? Number(exp.anioInicio) : null,
          anioFin: exp.esActual ? null : (exp.anioFin && String(exp.anioFin).trim() !== "" ? Number(exp.anioFin) : null),
          esActual: Boolean(exp.esActual),
        })),
        destrezasTecnicas: destrezas,
        modificadoPor: "00000000-0000-0000-0000-000000000001",
      };

      const resultado = await postulacionApi.actualizarDatosCvManual(idPostulacion, payload);
      setEsVerificado(true);
      setEstadoExtraccion("EXITOSA");
      if (resultado?.aniosExperienciaEstimados !== undefined) {
        setAniosExperiencia(resultado.aniosExperienciaEstimados);
      }
      avisar({ tono: "exito", titulo: "Datos verificados", mensaje: "Cambios guardados con verificación." });
      if (alActualizar) alActualizar();
    } catch (err) {
      avisar({ tono: "peligro", titulo: "Error al guardar", mensaje: err.message });
    } finally {
      setGuardando(false);
    }
  };

  const reanalizarManual = async () => {
    setProcesandoIA(true);
    try {
      const datosAuto = await postulacionApi.analizarCv(idPostulacion);
      setEstadoExtraccion(datosAuto.estadoExtraccion || "EXITOSA");
      setEsVerificado(Boolean(datosAuto.esVerificado));
      setAniosExperiencia(datosAuto.aniosExperienciaEstimados ?? 0);
      setEducacion(datosAuto.educacion || []);
      setExperienciaLaboral(datosAuto.experienciaLaboral || []);
      setDestrezas(datosAuto.destrezasTecnicas || []);
      avisar({ tono: "exito", titulo: "CV reprocesado", mensaje: "Datos extraídos nuevamente." });
    } catch (err) {
      avisar({ tono: "peligro", titulo: "Error de análisis", mensaje: err.message });
    } finally {
      setProcesandoIA(false);
    }
  };

  if (!tieneCv) return null;

  if (cargando) {
    return (
      <Tarjeta titulo="Extracción y Perfil del CV" nivelTitulo={3}>
        <p style={{ color: "var(--color-text-subtle)", fontSize: "var(--font-size-small)" }}>
          Cargando datos del perfil...
        </p>
      </Tarjeta>
    );
  }

  const esFallida = estadoExtraccion === "FALLIDA";

  return (
    <>
      <Modal abierto={procesandoIA} titulo="Procesando Hoja de Vida" tamano="sm" bloqueado>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "var(--space-6)", textAlign: "center", gap: "var(--space-4)" }}>
          <Loader2 className="ds-icono" style={{ width: 42, height: 42, color: "var(--color-primary)", animation: "spin 1s linear infinite" }} />
          <div>
            <h4 style={{ margin: "0 0 var(--space-1) 0", fontSize: "var(--font-size-section)", fontWeight: "var(--font-weight-semibold)" }}>
              Analizando documento con IA
            </h4>
            <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: "var(--font-size-small)" }}>
              Extrayendo educación, experiencia laboral y destrezas técnicas...
            </p>
          </div>
        </div>
      </Modal>

      <Tarjeta
        titulo="Extracción y Perfil del CV"
        nivelTitulo={3}
        acciones={
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            <Boton
              type="button"
              variante="sutil"
              tamano="sm"
              icono={Cpu}
              disabled={procesandoIA}
              onClick={reanalizarManual}
            >
              Reanalizar
            </Boton>
            <Etiqueta tono={esVerificado ? "exito" : esFallida ? "peligro" : "info"}>
              {esVerificado ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 className="ds-icono" aria-hidden="true" /> Verificado
                </span>
              ) : esFallida ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <AlertCircle className="ds-icono" aria-hidden="true" /> Extracción fallida
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Sparkles className="ds-icono" aria-hidden="true" /> Autogenerado
                </span>
              )}
            </Etiqueta>
          </div>
        }
      >
        <form onSubmit={manejarGuardar} className="cv-datos-form">
          {esFallida && (
            <Alerta tono="aviso" titulo="Documento no digitalizable de forma automática">
              No se pudo extraer la información del CV. Complete los datos manualmente para continuar.
            </Alerta>
          )}

          {errorCarga && <Alerta tono="peligro" titulo="Error">{errorCarga}</Alerta>}

          {/* Años de Experiencia */}
          <div className="cv-datos-form__seccion">
            <CampoTexto
              etiqueta="Años de experiencia laboral acumulada"
              type="number"
              step="1"
              min="0"
              value={aniosExperiencia}
              onChange={(e) => setAniosExperiencia(e.target.value)}
              ayuda="Cálculo consolidado de periodos trabajados."
              requerido
            />
          </div>

          {/* Destrezas Técnicas */}
          <div className="cv-datos-form__seccion">
            <label className="cv-datos-form__subtitulo">Destrezas Técnicas</label>
            <div className="cv-datos-form__destrezas-box">
              {destrezas.length === 0 && (
                <span style={{ color: "var(--color-text-subtle)", fontSize: "var(--font-size-small)" }}>
                  Sin destrezas registradas.
                </span>
              )}
              {destrezas.map((tag) => (
                <span key={tag} className="cv-datos-tag">
                  {tag}
                  <button
                    type="button"
                    className="cv-datos-tag__eliminar"
                    onClick={() => eliminarDestreza(tag)}
                    aria-label={`Eliminar ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="cv-datos-form__destreza-input-fila">
              <CampoTexto
                placeholder="Nueva destreza (ej: Liderazgo, Excel)"
                value={nuevaDestreza}
                onChange={(e) => setNuevaDestreza(e.target.value)}
                onKeyDown={agregarDestreza}
              />
              <Boton type="button" variante="predeterminado" tamano="sm" icono={Plus} onClick={agregarDestreza}>
                Añadir
              </Boton>
            </div>
          </div>

          {/* Experiencia Laboral (Detallada: Puesto, Empresa, Periodo) */}
          <div className="cv-datos-form__seccion">
            <div className="cv-datos-form__header-fila">
              <label className="cv-datos-form__subtitulo" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                Experiencia Laboral
              </label>
              <Boton type="button" variante="sutil" tamano="sm" icono={Plus} onClick={agregarExperiencia}>
                Añadir cargo
              </Boton>
            </div>

            {experienciaLaboral.length === 0 && (
              <p style={{ color: "var(--color-text-subtle)", fontSize: "var(--font-size-small)" }}>
                Sin registros de experiencia identificados.
              </p>
            )}

            {experienciaLaboral.map((item, index) => (
              <div key={index} className="cv-datos-exp-card">
                <div className="cv-datos-exp-card__header">
                  <span className="cv-datos-exp-card__badge">Puesto #{index + 1}</span>
                  <Boton
                    type="button"
                    variante="sutil"
                    tamano="sm"
                    icono={Trash2}
                    soloIcono
                    aria-label="Eliminar puesto"
                    onClick={() => eliminarExperiencia(index)}
                  />
                </div>

                <CampoTexto
                  etiqueta="Empleo / Cargo"
                  placeholder="ej. Administrador contable"
                  value={item.puesto || ""}
                  onChange={(e) => manejarCambioExperiencia(index, "puesto", e.target.value)}
                  requerido
                />

                <CampoTexto
                  etiqueta="Empresa / Organización"
                  placeholder="ej. Empresa Borcelle"
                  value={item.empresa || ""}
                  onChange={(e) => manejarCambioExperiencia(index, "empresa", e.target.value)}
                />

                <div className="cv-datos-exp-card__periodo">
                  <CampoTexto
                    etiqueta="Año inicio"
                    type="number"
                    placeholder="2010"
                    value={item.anioInicio || ""}
                    onChange={(e) => manejarCambioExperiencia(index, "anioInicio", e.target.value)}
                  />
                  <CampoTexto
                    etiqueta="Año fin"
                    type="number"
                    placeholder="2030"
                    disabled={item.esActual}
                    value={item.esActual ? "" : item.anioFin || ""}
                    onChange={(e) => manejarCambioExperiencia(index, "anioFin", e.target.value)}
                  />
                </div>

                <label className="cv-datos-exp-card__checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(item.esActual)}
                    onChange={(e) => manejarCambioExperiencia(index, "esActual", e.target.checked)}
                  />
                  Actualmente desempeñando este cargo
                </label>
              </div>
            ))}
          </div>

          {/* Educación y Estudios */}
          <div className="cv-datos-form__seccion">
            <div className="cv-datos-form__header-fila">
              <label className="cv-datos-form__subtitulo" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                Educación y Estudios
              </label>
              <Boton type="button" variante="sutil" tamano="sm" icono={Plus} onClick={agregarEducacion}>
                Añadir estudio
              </Boton>
            </div>

            {educacion.length === 0 && (
              <p style={{ color: "var(--color-text-subtle)", fontSize: "var(--font-size-small)" }}>
                Sin registros educativos identificados.
              </p>
            )}

            {educacion.map((item, index) => (
              <div key={index} className="cv-datos-edu-item">
                <CampoTexto
                  etiqueta="Institución / Universidad"
                  value={item.institucion || ""}
                  onChange={(e) => manejarCambioEducacion(index, "institucion", e.target.value)}
                  requerido
                />
                <CampoTexto
                  etiqueta="Título o Carrera"
                  value={item.titulo || ""}
                  onChange={(e) => manejarCambioEducacion(index, "titulo", e.target.value)}
                  requerido
                />
                <div className="cv-datos-edu-item__pie">
                  <CampoTexto
                    etiqueta="Año fin"
                    type="number"
                    placeholder="2014"
                    value={item.anioFin || ""}
                    onChange={(e) => manejarCambioEducacion(index, "anioFin", e.target.value)}
                  />
                  <Boton
                    type="button"
                    variante="sutil"
                    tamano="sm"
                    icono={Trash2}
                    soloIcono
                    aria-label="Eliminar estudio"
                    onClick={() => eliminarEducacion(index)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="cv-datos-form__acciones">
            <Boton type="submit" variante="primario" icono={Save} cargando={guardando}>
              {esVerificado ? "Guardar cambios" : "Verificar y guardar datos"}
            </Boton>
          </div>
        </form>
      </Tarjeta>
    </>
  );
}