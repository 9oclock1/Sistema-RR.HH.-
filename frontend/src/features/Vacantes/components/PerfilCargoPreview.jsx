import { IconoAlerta } from '../../../components/Iconos';

// Resumen del cargo elegido, tal como lo devuelve GET /convocatorias/perfil-cargo/:idCargo.
export default function PerfilCargoPreview({ cargando, datos, error, onAplicar }) {
  if (cargando) {
    return (
      <div className="vacantes-perfil" aria-busy="true">
        <span className="ui-skeleton" />
        <span className="ui-skeleton vacantes-perfil__skeleton-corto" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="ui-field__error vacantes-perfil__error">
        <IconoAlerta size={14} /> {error.message}
      </p>
    );
  }

  if (!datos) return null;
  const { cargo } = datos;

  return (
    <div className="vacantes-perfil">
      <div className="vacantes-perfil__header">
        <span className="vacantes-perfil__titulo">Perfil del cargo</span>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={onAplicar}>
          Aplicar perfil
        </button>
      </div>
      <p className="vacantes-perfil__meta">
        {cargo.departamento} · {cargo.funciones.length} {cargo.funciones.length === 1 ? 'función' : 'funciones'}
      </p>
      <p className="vacantes-perfil__texto">{cargo.requisitos_minimos}</p>
    </div>
  );
}
