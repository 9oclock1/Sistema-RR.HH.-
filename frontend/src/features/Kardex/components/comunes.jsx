import { TextoTruncado } from '../../../components/ui';

export function SinDato() {
  return <span className="kardex-sin-dato">—</span>;
}

export function Celda({ principal, secundario, mono = false }) {
  return (
    <div className="kardex-celda">
      <TextoTruncado className={mono ? 'kardex-codigo' : undefined}>{principal}</TextoTruncado>
      {secundario && <TextoTruncado className="kardex-celda__sub">{secundario}</TextoTruncado>}
    </div>
  );
}

export function Archivo({ etiqueta, ruta }) {
  return (
    <span className="kardex-archivo">
      {etiqueta && <span className="kardex-archivo__etiqueta">{etiqueta}</span>}
      <code>{ruta}</code>
    </span>
  );
}
