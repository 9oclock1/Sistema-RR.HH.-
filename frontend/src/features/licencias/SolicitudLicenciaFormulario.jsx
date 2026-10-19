import { useEffect, useRef, useState } from "react";
import { FileText, Send, Trash2 } from "lucide-react";
import FileInput from "../../components/common/FileInput";
import { Alerta, Boton, CampoAreaTexto, CampoTexto, Etiqueta, Selector, Tarjeta } from "../../components/ui";
import { radicarSolicitud } from "../../api/licencias";
import { ACEPTAR, MAX_ARCHIVOS, MAX_MB, contarDias, errorDeArchivo, excedeLimite, validarFormulario } from "./reglas";

const ETIQUETAS = {
  id_tipo_licencia: "Tipo de licencia",
  fecha_inicio: "Desde",
  fecha_fin: "Hasta",
  motivo: "Motivo",
  archivos: "Respaldo digital",
};

const VACIO = { id_tipo_licencia: "", fecha_inicio: "", fecha_fin: "", motivo: "" };
const idCampo = (campo) => `licencia-${campo}`;

const formatearTamano = (bytes) => (bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`);

export default function SolicitudLicenciaFormulario({ idEmpleado, tipos, onRadicada }) {
  const [valores, setValores] = useState(VACIO);
  const [archivos, setArchivos] = useState([]);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviosFallidos, setEnviosFallidos] = useState(0);
  const refResumen = useRef(null);

  // Solo tras un envío fallido: corregir un campo no debe mover el foco.
  useEffect(() => {
    if (enviosFallidos) refResumen.current?.focus();
  }, [enviosFallidos]);

  const tipo = tipos.find((t) => String(t.id_tipo_licencia) === valores.id_tipo_licencia);
  const dias = contarDias(valores.fecha_inicio, valores.fecha_fin);
  const excede = excedeLimite(tipo, dias);

  const limpiarError = (campo) =>
    setErrores((actuales) => {
      if (!actuales[campo]) return actuales;
      const resto = { ...actuales };
      delete resto[campo];
      return resto;
    });

  const cambiar = (evento) => {
    const { name, value } = evento.target;
    setValores((actuales) => ({ ...actuales, [name]: value }));
    limpiarError(name);
    if (name === "id_tipo_licencia") limpiarError("archivos");
  };

  const agregarArchivo = (archivo) => {
    const problema = errorDeArchivo(archivo, archivos.length);
    if (problema) {
      setErrores((actuales) => ({ ...actuales, archivos: problema }));
      return;
    }
    setArchivos((actuales) => [...actuales, archivo]);
    limpiarError("archivos");
  };

  const quitarArchivo = (indice) => setArchivos((actuales) => actuales.filter((_, i) => i !== indice));

  const fallar = (nuevos, general = null) => {
    setErrores(nuevos);
    setErrorGeneral(general);
    setEnviosFallidos((total) => total + 1);
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    const encontrados = validarFormulario(valores, tipo, archivos);
    if (Object.keys(encontrados).length > 0) {
      fallar(encontrados);
      return;
    }

    const formulario = new FormData();
    Object.entries(valores).forEach(([campo, valor]) => formulario.append(campo, valor));
    archivos.forEach((archivo) => formulario.append("archivos", archivo));

    setEnviando(true);
    setErrores({});
    setErrorGeneral(null);
    try {
      const solicitud = await radicarSolicitud(idEmpleado, formulario);
      setValores(VACIO);
      setArchivos([]);
      onRadicada(solicitud);
    } catch (error) {
      const delServidor = Object.fromEntries((error.detalles ?? []).map((d) => [d.campo, d.mensaje]));
      fallar(delServidor, Object.keys(delServidor).length ? null : error.message);
    } finally {
      setEnviando(false);
    }
  };

  const propsCampo = (campo) => ({
    id: idCampo(campo),
    name: campo,
    etiqueta: ETIQUETAS[campo],
    value: valores[campo],
    onChange: cambiar,
    error: errores[campo],
  });

  const enfocar = (evento, campo) => {
    evento.preventDefault();
    document.getElementById(idCampo(campo))?.focus();
  };

  const listaErrores = Object.entries(errores);
  const mostrarResumen = Boolean(errorGeneral) || listaErrores.length > 0;
  const opciones = tipos.map((t) => ({ valor: String(t.id_tipo_licencia), etiqueta: t.nombre }));

  return (
    <Tarjeta titulo="Nueva solicitud" nivelTitulo={2} className="licencias-tarjeta">
      <form className="licencias-formulario" onSubmit={enviar} noValidate>
        {mostrarResumen && (
          <Alerta
            ref={refResumen}
            tabIndex={-1}
            tono="peligro"
            role="alert"
            titulo={errorGeneral ?? "Revise los campos marcados."}
          >
            {listaErrores.length > 0 && (
              <ul>
                {listaErrores.map(([campo, mensaje]) => (
                  <li key={campo}>
                    <a href={`#${idCampo(campo)}`} onClick={(evento) => enfocar(evento, campo)}>
                      {ETIQUETAS[campo] ?? campo}: {mensaje}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Alerta>
        )}

        <Selector {...propsCampo("id_tipo_licencia")} requerido textoVacio="Seleccione una causal…" opciones={opciones} />

        {tipo && (
          <div className="licencias-reglas" aria-live="polite">
            <Etiqueta tono={tipo.es_con_goce_haberes ? "exito" : "aviso"}>
              {tipo.es_con_goce_haberes ? "Con goce de haberes" : "Sin goce de haberes"}
            </Etiqueta>
            <Etiqueta tono="neutral">
              {tipo.dias_maximos_continuos === null
                ? "Sin límite de días continuos"
                : `Hasta ${tipo.dias_maximos_continuos} día(s) continuos`}
            </Etiqueta>
            {tipo.requiere_adjunto && <Etiqueta tono="info">Respaldo obligatorio</Etiqueta>}
          </div>
        )}

        <div className="licencias-fechas">
          <CampoTexto {...propsCampo("fecha_inicio")} type="date" requerido />
          <CampoTexto {...propsCampo("fecha_fin")} type="date" requerido min={valores.fecha_inicio || undefined} />
        </div>

        {dias > 0 && (
          <p className="licencias-dias" aria-live="polite">
            Duración: <strong>{dias} día(s)</strong> corridos.
          </p>
        )}

        {excede && (
          <Alerta tono="aviso" role="status" titulo="Excede el límite de días continuos">
            Esta licencia permite hasta {tipo.dias_maximos_continuos} día(s) y solicita {dias}. Puede enviarla, pero
            requerirá autorización especial de RRHH.
          </Alerta>
        )}

        <CampoAreaTexto
          {...propsCampo("motivo")}
          filas={3}
          maxLength={500}
          ayuda="Opcional. Describa brevemente la causa de la ausencia."
        />

        <div id={idCampo("archivos")} tabIndex={-1} className="licencias-respaldo">
          <FileInput
            etiqueta={ETIQUETAS.archivos}
            requerido={Boolean(tipo?.requiere_adjunto)}
            aceptar={ACEPTAR}
            ayuda={`PDF, JPG o PNG (máx. ${MAX_MB} MB, hasta ${MAX_ARCHIVOS} archivos)`}
            error={errores.archivos}
            archivo={null}
            deshabilitado={enviando || archivos.length >= MAX_ARCHIVOS}
            onSeleccionar={agregarArchivo}
          />
          {archivos.length > 0 && (
            <ul className="licencias-archivos" aria-label="Archivos adjuntos">
              {archivos.map((archivo, indice) => (
                <li key={`${archivo.name}-${indice}`} className="licencias-archivo">
                  <FileText className="ds-icono" aria-hidden="true" />
                  <span className="licencias-archivo__nombre">{archivo.name}</span>
                  <span className="licencias-archivo__tamano">{formatearTamano(archivo.size)}</span>
                  <Boton
                    variante="sutil"
                    tamano="sm"
                    soloIcono
                    icono={Trash2}
                    aria-label={`Quitar ${archivo.name}`}
                    onClick={() => quitarArchivo(indice)}
                    disabled={enviando}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <Boton variante="primario" type="submit" icono={Send} cargando={enviando}>
          {enviando ? "Enviando…" : "Enviar solicitud"}
        </Boton>
      </form>
    </Tarjeta>
  );
}
