import { useState } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { Boton, CampoTexto } from "../../../components/ui";
import "./AffinityRangeFilter.css";

const PRESETS = [
  { id: "todos", etiqueta: "Todos", min: "", max: "" },
  { id: "top", etiqueta: "Top matches (≥ 75%)", min: "75", max: "" },
  { id: "medios", etiqueta: "Afinidad media (50% - 74.99%)", min: "50", max: "74.99" },
  { id: "bajos", etiqueta: "Menor afinidad (< 50%)", min: "", max: "49.99" },
];

export default function AffinityRangeFilter({
  minAfinidad = "",
  maxAfinidad = "",
  onCambiarRango,
  disabled = false,
}) {
  const [minLocal, setMinLocal] = useState(minAfinidad);
  const [maxLocal, setMaxLocal] = useState(maxAfinidad);
  const [presetActivo, setPresetActivo] = useState("todos");
  const [errorRango, setErrorRango] = useState(null);

  const aplicarPreset = (preset) => {
    setErrorRango(null);
    setPresetActivo(preset.id);
    setMinLocal(preset.min);
    setMaxLocal(preset.max);
    onCambiarRango({ minAfinidad: preset.min, maxAfinidad: preset.max });
  };

  const manejarSubmitManual = (e) => {
    e.preventDefault();
    if (minLocal !== "" && maxLocal !== "" && Number(minLocal) > Number(maxLocal)) {
      setErrorRango("El mínimo no puede ser mayor que el máximo.");
      return;
    }
    setErrorRango(null);
    setPresetActivo("custom");
    onCambiarRango({ minAfinidad: minLocal, maxAfinidad: maxLocal });
  };

  const limpiarFiltro = () => {
    setErrorRango(null);
    setPresetActivo("todos");
    setMinLocal("");
    setMaxLocal("");
    onCambiarRango({ minAfinidad: "", maxAfinidad: "" });
  };

  const tieneFiltro = minAfinidad !== "" || maxAfinidad !== "";

  return (
    <div className="affinity-filtro">
      <div className="affinity-filtro__presets">
        <span className="affinity-filtro__etiqueta">
          <Filter className="ds-icono" aria-hidden="true" />
          Filtrar por afinidad:
        </span>
        <div className="affinity-filtro__botones">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`affinity-filtro__chip ${presetActivo === p.id ? "affinity-filtro__chip--activo" : ""}`}
              onClick={() => aplicarPreset(p)}
              disabled={disabled}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={manejarSubmitManual} className="affinity-filtro__manual">
        <div className="affinity-filtro__inputs">
          <CampoTexto
            placeholder="Min %"
            type="number"
            min="0"
            max="100"
            value={minLocal}
            onChange={(e) => setMinLocal(e.target.value)}
            disabled={disabled}
            aria-label="Porcentaje mínimo de afinidad"
          />
          <span className="affinity-filtro__separador">—</span>
          <CampoTexto
            placeholder="Max %"
            type="number"
            min="0"
            max="100"
            value={maxLocal}
            onChange={(e) => setMaxLocal(e.target.value)}
            disabled={disabled}
            aria-label="Porcentaje máximo de afinidad"
          />
          <Boton
            type="submit"
            tamano="sm"
            variante="predeterminado"
            disabled={disabled}
          >
            Aplicar
          </Boton>
          {tieneFiltro && (
            <Boton
              type="button"
              tamano="sm"
              variante="sutil"
              soloIcono
              icono={RotateCcw}
              aria-label="Limpiar filtro de afinidad"
              onClick={limpiarFiltro}
              title="Restablecer filtros"
            />
          )}
        </div>
        {errorRango && (
          <p className="affinity-filtro__error" role="alert">
            {errorRango}
          </p>
        )}
      </form>
    </div>
  );
}