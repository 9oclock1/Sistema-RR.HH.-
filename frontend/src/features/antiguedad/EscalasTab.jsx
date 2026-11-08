import { useCallback, useEffect, useState } from "react";
import { Plus, Scale } from "lucide-react";
import { listarEscalas, registrarVigenciaEscala } from "../../api/antiguedad";
import { Alerta, Boton, Esqueleto, Etiqueta, EstadoVacio, Tarjeta, useAvisos } from "../../components/ui";
import EscalaFormulario from "./EscalaFormulario";
import { formatearFecha, formatearPorcentaje, formatearRangoAnios } from "./formato";

export default function EscalasTab() {
  const avisar = useAvisos();
  const [escalas, setEscalas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);

  const cargar = useCallback(
    () =>
      listarEscalas()
        .then((lista) => {
          setEscalas(lista);
          setErrorCarga(null);
        })
        .catch((error) => setErrorCarga(error.message))
        .finally(() => setCargando(false)),
    []
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = async (datos) => {
    await registrarVigenciaEscala(datos);
    setFormularioAbierto(false);
    await cargar();
    avisar({ tono: "exito", titulo: "Vigencia registrada", mensaje: `Vigente desde ${formatearFecha(datos.vigente_desde)}` });
  };

  if (cargando) {
    return (
      <div className="antiguedad-escalas__cargando">
        <Esqueleto forma="bloque" alto="6rem" />
        <Esqueleto forma="bloque" alto="6rem" />
      </div>
    );
  }

  if (errorCarga) {
    return (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudo cargar el historial de la escala"
        acciones={
          <Boton tamano="sm" onClick={cargar}>
            Reintentar
          </Boton>
        }
      >
        {errorCarga}
      </Alerta>
    );
  }

  return (
    <div className="antiguedad-escalas">
      <div className="antiguedad-escalas__cabecera">
        <p className="antiguedad-nota">
          La vigencia vigente se aplica a los bonos calculados desde su fecha de inicio; una nueva vigencia no
          modifica los cálculos ya hechos con las anteriores.
        </p>
        <Boton variante="primario" icono={Plus} onClick={() => setFormularioAbierto(true)}>
          Nueva vigencia
        </Boton>
      </div>

      {escalas.length === 0 ? (
        <EstadoVacio icono={Scale} titulo="Aún no hay una escala de antigüedad registrada" />
      ) : (
        escalas.map((escala) => {
          const vigente = escala.vigente_hasta === null;
          return (
            <Tarjeta key={escala.id_vigencia} className="antiguedad-escala-tarjeta">
              <div className="antiguedad-escala-tarjeta__cabecera">
                <div>
                  <span className="antiguedad-escala-tarjeta__rango">
                    {formatearFecha(escala.vigente_desde)} – {escala.vigente_hasta ? formatearFecha(escala.vigente_hasta) : "actual"}
                  </span>
                  {escala.motivo && <p className="antiguedad-nota">{escala.motivo}</p>}
                </div>
                {vigente && <Etiqueta tono="exito">Vigente</Etiqueta>}
              </div>
              <ul className="antiguedad-escala-tarjeta__tramos">
                {escala.tramos.map((tramo) => (
                  <li key={tramo.id_tramo}>
                    <span>{formatearRangoAnios(tramo)}</span>
                    <span>{formatearPorcentaje(tramo.porcentaje)}</span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          );
        })
      )}

      {formularioAbierto && <EscalaFormulario onGuardar={guardar} onCancelar={() => setFormularioAbierto(false)} />}
    </div>
  );
}
