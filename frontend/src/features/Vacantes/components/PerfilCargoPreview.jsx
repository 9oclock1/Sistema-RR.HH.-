import { CircleAlert, RefreshCw } from 'lucide-react';
import { Boton, Esqueleto } from '../../../components/ui';

// Resumen del cargo elegido, tal como lo devuelve GET /convocatorias/perfil-cargo/:idCargo.
export default function PerfilCargoPreview({ cargando, datos, error, onAplicar }) {
  if (cargando) {
    return (
      <div className="vacante-perfil" aria-busy="true">
        <Esqueleto />
        <Esqueleto ancho="45%" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="vacante-perfil__error">
        <CircleAlert className="ds-icono" aria-hidden="true" />
        {error.message}
      </p>
    );
  }

  if (!datos) return null;
  const { cargo } = datos;

  return (
    <div className="vacante-perfil">
      <div className="vacante-perfil__encabezado">
        <span className="vacante-perfil__titulo">Perfil del cargo</span>
        <Boton variante="sutil" tamano="sm" icono={RefreshCw} onClick={onAplicar}>
          Aplicar perfil
        </Boton>
      </div>
      <p className="vacante-perfil__meta">
        {cargo.departamento} · {cargo.funciones.length} {cargo.funciones.length === 1 ? 'función' : 'funciones'}
      </p>
      <p className="vacante-perfil__texto">{cargo.requisitos_minimos}</p>
    </div>
  );
}
