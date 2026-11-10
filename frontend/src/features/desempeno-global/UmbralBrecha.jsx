import { useState } from "react";
import { Pencil } from "lucide-react";
import { actualizarUmbralBrecha } from "../../api/desempenoGlobal";
import { Boton, CampoTexto, useAvisos } from "../../components/ui";
import { formatearPuntaje, validarUmbral } from "./desempenoGlobal";

// Umbral por debajo del cual un área o sucursal se marca como brecha de productividad en este ciclo. Todos los de
// RRHH lo ven; solo el administrador lo cambia.
export default function UmbralBrecha({ rol, esAdmin, idCiclo, umbral, alCambiar }) {
  const avisar = useAvisos();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const abrir = () => {
    setTexto(String(umbral).replace(".", ","));
    setError("");
    setEditando(true);
  };

  async function guardar(evento) {
    evento.preventDefault();
    const { valor, error: invalido } = validarUmbral(texto);
    if (invalido) return setError(invalido);

    setGuardando(true);
    try {
      await actualizarUmbralBrecha(rol, idCiclo, valor);
      avisar({ tono: "exito", titulo: "Umbral actualizado", mensaje: `Una brecha ahora es un promedio menor que ${formatearPuntaje(valor)}.` });
      setEditando(false);
      alCambiar();
    } catch (falla) {
      setError(falla.detalles?.[0]?.mensaje ?? falla.message);
    } finally {
      setGuardando(false);
    }
  }

  if (editando) {
    return (
      <form className="dg-umbral dg-umbral--edicion" onSubmit={guardar} noValidate>
        <CampoTexto
          etiqueta="Umbral de brecha (0 a 100)"
          inputMode="decimal"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          error={error}
          autoFocus
        />
        <div className="dg-acciones">
          <Boton onClick={() => setEditando(false)} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="primario" cargando={guardando}>
            Guardar
          </Boton>
        </div>
      </form>
    );
  }

  return (
    <div className="dg-umbral">
      <p className="dg-umbral__texto">
        Umbral de brecha: <strong>{formatearPuntaje(umbral)}</strong>
        <span className="dg-sutil"> · un área o sucursal con promedio menor se marca como brecha de productividad.</span>
      </p>
      {esAdmin && (
        <Boton tamano="sm" icono={Pencil} onClick={abrir}>
          Cambiar umbral
        </Boton>
      )}
    </div>
  );
}
