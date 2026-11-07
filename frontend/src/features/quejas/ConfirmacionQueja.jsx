import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Check, Copy, FileSearch, Plus } from "lucide-react";
import { Alerta, Boton, Tarjeta, useAvisos } from "../../components/ui";
import { copiarTexto, formatearFechaHora } from "./formato";
import { RUTA_CONSULTAR_QUEJA } from "./reglas";

export default function ConfirmacionQueja({ queja, onNueva }) {
  const avisar = useAvisos();
  const [copiado, setCopiado] = useState(false);
  const refTitulo = useRef(null);

  useEffect(() => {
    refTitulo.current?.focus();
  }, []);

  const copiar = async () => {
    const ok = await copiarTexto(queja.codigo_seguimiento);
    setCopiado(ok);
    avisar(
      ok
        ? { tono: "exito", titulo: "Código copiado", mensaje: queja.codigo_seguimiento }
        : { tono: "aviso", titulo: "No se pudo copiar", mensaje: "Seleccione el código y cópielo manualmente." },
    );
  };

  return (
    <Tarjeta className="qj-confirmacion">
      <h2 ref={refTitulo} tabIndex={-1} className="qj-confirmacion__titulo">
        Su queja fue registrada
      </h2>
      <p className="qj-confirmacion__texto">
        Estado: <strong>{queja.estado.nombre}</strong>, el {formatearFechaHora(queja.registrada_en)}.
        {queja.adjuntos > 0 && ` Se adjuntaron ${queja.adjuntos} ${queja.adjuntos === 1 ? "archivo" : "archivos"}.`}
      </p>

      <div className="qj-codigo">
        <span className="qj-codigo__etiqueta" id="qj-codigo-etiqueta">
          Código de seguimiento
        </span>
        <output className="qj-codigo__valor" aria-labelledby="qj-codigo-etiqueta">
          {queja.codigo_seguimiento}
        </output>
        <Boton icono={copiado ? Check : Copy} onClick={copiar}>
          {copiado ? "Copiado" : "Copiar código"}
        </Boton>
      </div>

      <Alerta tono="aviso" titulo="Guarde este código">
        <p>
          {queja.anonima
            ? "Su queja es anónima: no guardamos ningún dato que lo identifique, así que no podremos recuperar el código si lo pierde."
            : "Con este código puede consultar el avance sin iniciar sesión."}{" "}
          Anótelo o cópielo en un lugar seguro antes de salir de esta pantalla.
        </p>
      </Alerta>

      <div className="qj-acciones">
        <Boton
          as={Link}
          to={RUTA_CONSULTAR_QUEJA}
          state={{ codigo: queja.codigo_seguimiento }}
          variante="primario"
          icono={FileSearch}
        >
          Consultar estado
        </Boton>
        <Boton variante="sutil" icono={Plus} onClick={onNueva}>
          Registrar otra queja
        </Boton>
      </div>
    </Tarjeta>
  );
}
