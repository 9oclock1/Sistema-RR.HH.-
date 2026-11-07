import { useState } from "react";
import { BellRing } from "lucide-react";
import { reintentarAvisoQueja } from "../../../api/casosQueja";
import { Alerta, Avatar, Boton, Etiqueta, Tarjeta, useAvisos } from "../../../components/ui";
import { formatearFechaHora } from "../formato";
import { AVISOS, nombreDe } from "./casos";

export default function DerivacionesQueja({ caso, sesion, deshabilitado, onActualizado }) {
  const avisar = useAvisos();
  const [reintentando, setReintentando] = useState(false);
  const [error, setError] = useState(null);

  const reintentar = async () => {
    setError(null);
    setReintentando(true);
    try {
      const resultado = await reintentarAvisoQueja(sesion, caso.id_queja);
      if (resultado.estado === "ENTREGADO") {
        avisar({ tono: "exito", titulo: "Aviso entregado", mensaje: `${nombreDe(caso.responsable)} ya recibió el caso.` });
      } else {
        setError("El servicio de notificaciones no respondió. Intente de nuevo en unos minutos.");
      }
      onActualizado();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setReintentando(false);
    }
  };

  return (
    <Tarjeta nivelTitulo={2} titulo="Derivaciones" className="qc-tarjeta">
      {caso.derivaciones.length === 0 ? (
        <p className="qc-sutil">La queja todavía no se derivó a un responsable.</p>
      ) : (
        <ul className="qc-lista">
          {caso.derivaciones.map((derivacion, indice) => {
            const aviso = AVISOS[derivacion.notificacion.estado.codigo] ?? AVISOS.PENDIENTE;
            const vigente = indice === 0;
            return (
              <li key={derivacion.id_asignacion} className="qc-lista__item qc-lista__item--columna">
                <div className="qc-persona">
                  <Avatar nombre={nombreDe(derivacion.responsable)} decorativo />
                  <div className="qc-celda">
                    <span className="qc-celda__principal">{nombreDe(derivacion.responsable)}</span>
                    <span className="qc-sutil">
                      {formatearFechaHora(derivacion.asignada_en)} · por {nombreDe(derivacion.asignador)}
                    </span>
                  </div>
                </div>
                <div className="qc-etiquetas">
                  {vigente && <Etiqueta tono="info">Vigente</Etiqueta>}
                  <Etiqueta tono={aviso.tono}>{aviso.texto}</Etiqueta>
                </div>
                {derivacion.comentario && <p className="qc-texto qc-texto--secundario">{derivacion.comentario}</p>}
                {vigente && derivacion.notificacion.estado.codigo !== "ENTREGADO" && !deshabilitado && (
                  <Boton tamano="sm" icono={BellRing} cargando={reintentando} onClick={reintentar}>
                    Reintentar aviso
                  </Boton>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo avisar al responsable" onCerrar={() => setError(null)}>
          {error}
        </Alerta>
      )}
    </Tarjeta>
  );
}
