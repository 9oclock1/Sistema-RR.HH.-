import { useEffect, useRef, useState } from "react";
import { EyeOff, Send, UserRound } from "lucide-react";
import { registrarQueja } from "../../api/quejas";
import { Alerta, Boton, CampoAreaTexto, CampoTexto, Casilla, Selector } from "../../components/ui";
import ZonaAdjuntos from "./ZonaAdjuntos";
import { ASUNTO, DESCRIPCION, validarQueja } from "./reglas";

const CAMPOS = {
  anonima: "qj-anonima",
  id_categoria_queja: "qj-categoria",
  asunto: "qj-asunto",
  descripcion: "qj-descripcion",
  archivos: "qj-archivos",
};
const ETIQUETAS = {
  anonima: "Envío",
  id_categoria_queja: "Categoría",
  asunto: "Asunto",
  descripcion: "Descripción",
  archivos: "Adjuntos",
};
const CLAVE_API = { anonima: "anonima", idCategoria: "id_categoria_queja", asunto: "asunto", descripcion: "descripcion", archivos: "archivos" };
const VACIO = { anonima: false, idCategoria: "", asunto: "", descripcion: "", archivos: [] };

export default function FormularioQueja({ categorias, idEmpleado, onRegistrada }) {
  const [datos, setDatos] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [intentos, setIntentos] = useState(0);
  const refResumen = useRef(null);

  useEffect(() => {
    if (intentos) refResumen.current?.focus();
  }, [intentos]);

  const cambiar = (campo, valor) => {
    setDatos((actual) => ({ ...actual, [campo]: valor }));
    const clave = CLAVE_API[campo];
    if (errores[clave]) {
      setErrores((actuales) => {
        const resto = { ...actuales };
        delete resto[clave];
        return resto;
      });
    }
  };

  const fallar = (nuevos, general = null) => {
    setErrores(nuevos);
    setErrorGeneral(general);
    setIntentos((n) => n + 1);
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    const encontrados = validarQueja(datos, { idEmpleado });
    if (Object.keys(encontrados).length > 0) return fallar(encontrados);

    setEnviando(true);
    try {
      const queja = await registrarQueja({
        idEmpleado: datos.anonima ? undefined : idEmpleado,
        anonima: datos.anonima,
        idCategoria: datos.idCategoria,
        asunto: datos.asunto.trim(),
        descripcion: datos.descripcion.trim(),
        archivos: datos.archivos,
      });
      setDatos(VACIO);
      setErrores({});
      setErrorGeneral(null);
      onRegistrada({ ...queja, anonima: datos.anonima });
    } catch (error) {
      const porCampo = {};
      for (const { campo, mensaje } of error.detalles ?? []) {
        if (CAMPOS[campo] && !porCampo[campo]) porCampo[campo] = mensaje;
      }
      fallar(porCampo, Object.keys(porCampo).length === 0 ? error.message : null);
    } finally {
      setEnviando(false);
    }
  };

  const listaErrores = Object.entries(errores);

  return (
    <form className="qj-formulario" onSubmit={enviar} noValidate>
      {(listaErrores.length > 0 || errorGeneral) && (
        <Alerta
          ref={refResumen}
          tabIndex={-1}
          tono="peligro"
          role="alert"
          titulo={errorGeneral ? "No se pudo registrar la queja" : "Revise los datos del formulario"}
        >
          {errorGeneral ? (
            <p>{errorGeneral}</p>
          ) : (
            <ul className="qj-lista-errores">
              {listaErrores.map(([campo, mensaje]) => (
                <li key={campo}>
                  <a
                    href={`#${CAMPOS[campo]}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(CAMPOS[campo])?.focus();
                    }}
                  >
                    {ETIQUETAS[campo]}: {mensaje}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Alerta>
      )}

      <fieldset className="qj-anonimato">
        <legend className="ds-solo-lector">Forma de envío</legend>
        <Casilla
          id={CAMPOS.anonima}
          etiqueta="Enviar de forma anónima"
          checked={datos.anonima}
          onChange={(e) => cambiar("anonima", e.target.checked)}
          disabled={enviando}
          ayuda="No se guardará su nombre, su usuario ni ningún dato que lo identifique, tampoco los nombres de los archivos. RRHH no podrá contactarlo: el código de seguimiento será la única forma de consultar el avance. Evite escribir datos que lo identifiquen en el asunto, la descripción o los adjuntos."
        />
        <p className={`qj-modo ${datos.anonima ? "qj-modo--anonima" : ""}`} aria-live="polite">
          {datos.anonima ? (
            <>
              <EyeOff className="ds-icono" aria-hidden="true" />
              La queja se enviará sin datos que lo identifiquen.
            </>
          ) : (
            <>
              <UserRound className="ds-icono" aria-hidden="true" />
              La queja quedará registrada a su nombre. Solo el personal de RRHH que la atienda podrá ver quién la presentó.
            </>
          )}
        </p>
        {errores.anonima && (
          <Alerta tono="aviso" titulo="Falta identificarse">
            <p>{errores.anonima}</p>
          </Alerta>
        )}
      </fieldset>

      <Selector
        id={CAMPOS.id_categoria_queja}
        etiqueta="Categoría"
        requerido
        value={datos.idCategoria}
        onChange={(e) => cambiar("idCategoria", e.target.value)}
        opciones={categorias.map((c) => ({ valor: String(c.id_categoria_queja), etiqueta: c.nombre }))}
        textoVacio="Seleccione…"
        error={errores.id_categoria_queja}
        disabled={enviando}
      />
      <CampoTexto
        id={CAMPOS.asunto}
        etiqueta="Asunto"
        requerido
        value={datos.asunto}
        onChange={(e) => cambiar("asunto", e.target.value)}
        maxLength={ASUNTO.MAX}
        error={errores.asunto}
        ayuda={`Una frase corta que resuma el problema. ${datos.asunto.length} de ${ASUNTO.MAX} caracteres.`}
        disabled={enviando}
      />
      <CampoAreaTexto
        id={CAMPOS.descripcion}
        etiqueta="Descripción"
        requerido
        filas={6}
        value={datos.descripcion}
        onChange={(e) => cambiar("descripcion", e.target.value)}
        maxLength={DESCRIPCION.MAX}
        error={errores.descripcion}
        ayuda={`Qué ocurrió, dónde y desde cuándo. Mínimo ${DESCRIPCION.MIN} caracteres; ${datos.descripcion.length} de ${DESCRIPCION.MAX}.`}
        disabled={enviando}
      />
      <ZonaAdjuntos
        id={CAMPOS.archivos}
        archivos={datos.archivos}
        onCambiar={(lista) => cambiar("archivos", lista)}
        error={errores.archivos}
        anonima={datos.anonima}
        deshabilitado={enviando}
      />

      <div className="qj-acciones">
        <Boton variante="primario" type="submit" icono={Send} cargando={enviando}>
          {enviando ? "Enviando…" : "Enviar queja"}
        </Boton>
      </div>
    </form>
  );
}
