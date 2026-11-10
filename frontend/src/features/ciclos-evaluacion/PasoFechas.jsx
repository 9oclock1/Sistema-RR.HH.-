import { CampoTexto } from "../../components/ui";
import { NOMBRE_MAX } from "./validacionCiclo";

// Paso 2: nombre del ciclo, fecha de inicio y fecha límite.
export default function PasoFechas({ datos, errores, onCambiar }) {
  return (
    <div className="cev-campos">
      <CampoTexto
        etiqueta="Nombre del ciclo"
        requerido
        value={datos.nombre}
        maxLength={NOMBRE_MAX}
        onChange={(evento) => onCambiar("nombre", evento.target.value)}
        ayuda="Debe ser único dentro del periodo. Por ejemplo: «Evaluación de desempeño 2026-S2»."
        error={errores.nombre}
      />
      <div className="cev-fila">
        <CampoTexto
          etiqueta="Fecha de inicio"
          type="date"
          requerido
          value={datos.fechaInicio}
          onChange={(evento) => onCambiar("fechaInicio", evento.target.value)}
          ayuda="Desde ese día los evaluadores ven sus evaluaciones."
          error={errores.fecha_inicio}
        />
        <CampoTexto
          etiqueta="Fecha límite"
          type="date"
          requerido
          value={datos.fechaLimite}
          onChange={(evento) => onCambiar("fechaLimite", evento.target.value)}
          ayuda="Pasada esa fecha las evaluaciones sin enviar quedan vencidas y ya no se pueden editar."
          error={errores.fecha_limite}
        />
      </div>
    </div>
  );
}
