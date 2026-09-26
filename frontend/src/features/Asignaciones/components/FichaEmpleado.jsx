import { useId } from 'react';
import { IconoAlerta } from '../../../components/Iconos';
import { formatearFecha } from '../../Vacantes/utils/formato';

const iniciales = (ficha) => `${ficha.nombres[0] ?? ''}${ficha.primer_apellido[0] ?? ''}`.toUpperCase();

const documento = (ficha) =>
  ficha.complemento_documento ? `${ficha.numero_documento}-${ficha.complemento_documento}` : ficha.numero_documento;

function Dato({ etiqueta, children }) {
  return (
    <div className="asig-dato">
      <dt>{etiqueta}</dt>
      <dd>{children || <span className="ui-muted">—</span>}</dd>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="asig-esqueleto" aria-hidden="true">
      <span className="ui-skeleton" />
      <div className="asig-tiles">
        {[0, 1, 2].map((i) => (
          <div key={i} className="asig-tile">
            <span className="ui-skeleton" />
          </div>
        ))}
      </div>
      <span className="ui-skeleton" />
    </div>
  );
}

function Historial({ historial }) {
  if (historial.length === 0) {
    return <p className="asig-vacio">Aún no hay asignaciones registradas en el historial.</p>;
  }

  return (
    <div className="ui-table__scroll">
      <table className="ui-table asig-historial">
        <thead>
          <tr>
            <th scope="col">Cargo</th>
            <th scope="col">Sucursal</th>
            <th scope="col">Desde</th>
            <th scope="col">Hasta</th>
          </tr>
        </thead>
        <tbody>
          {historial.map((a) => (
            <tr key={a.id_asignacion}>
              <td>
                <div className="ui-table__name">{a.cargo}</div>
                <div className="ui-table__sub">{a.area}</div>
              </td>
              <td>{a.sucursal}</td>
              <td className="ui-table__num">{formatearFecha(a.fecha_inicio)}</td>
              <td className="ui-table__num">
                {a.es_vigente ? <span className="ui-badge ui-badge--tone-2">Vigente</span> : formatearFecha(a.fecha_fin)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FichaEmpleado({ ficha, cargando, error, onReintentar, selector }) {
  const uid = useId();
  const actual = ficha?.asignacion_actual;

  let contenido;
  if (cargando) {
    contenido = <Esqueleto />;
  } else if (error) {
    contenido = (
      <div className="ui-alert ui-alert--error" role="alert">
        <IconoAlerta />
        <span>{error.message}</span>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={onReintentar}>
          Reintentar
        </button>
      </div>
    );
  } else if (!ficha) {
    contenido = <p className="asig-vacio">Selecciona un empleado para ver su ficha.</p>;
  } else {
    contenido = (
      <>
        <div className="asig-identidad">
          <span className="asig-avatar" aria-hidden="true">
            {iniciales(ficha)}
          </span>
          <div className="asig-identidad__texto">
            <p className="asig-identidad__nombre">{ficha.nombre_completo}</p>
            <p className="ui-card__subtitle">
              CI <span className="ui-code">{documento(ficha)}</span>
            </p>
          </div>
          <span className={`ui-badge ${ficha.estado.codigo === 'ACTIVO' ? 'ui-badge--tone-2' : 'asig-badge--inactivo'}`}>
            {ficha.estado.nombre}
          </span>
        </div>

        <section className="asig-bloque" aria-labelledby={`${uid}-vigente`}>
          <h4 id={`${uid}-vigente`} className="asig-bloque__titulo">
            Asignación vigente
            {actual.vigente_desde && <span className="asig-bloque__nota">desde {formatearFecha(actual.vigente_desde)}</span>}
          </h4>
          <div className="asig-tiles">
            <div className="asig-tile">
              <span className="asig-tile__label">Cargo</span>
              <span className="asig-tile__valor">{actual.cargo.nombre}</span>
              {actual.cargo.esta_activo ? (
                <span className="ui-code">{actual.cargo.codigo}</span>
              ) : (
                <span className="asig-tile__alerta">Cargo dado de baja</span>
              )}
            </div>
            <div className="asig-tile">
              <span className="asig-tile__label">Área</span>
              <span className="asig-tile__valor">{actual.area.nombre}</span>
            </div>
            <div className="asig-tile">
              <span className="asig-tile__label">Sucursal</span>
              <span className="asig-tile__valor">{actual.sucursal.nombre}</span>
              <span className="asig-tile__nota">{actual.sucursal.ciudad}</span>
            </div>
          </div>
        </section>

        <section className="asig-bloque" aria-labelledby={`${uid}-personales`}>
          <h4 id={`${uid}-personales`} className="asig-bloque__titulo">
            Datos personales
          </h4>
          <dl className="asig-datos">
            <Dato etiqueta="Ingreso">{formatearFecha(ficha.fecha_ingreso)}</Dato>
            <Dato etiqueta="Nacimiento">{formatearFecha(ficha.fecha_nacimiento)}</Dato>
            <Dato etiqueta="Género">{ficha.genero}</Dato>
            <Dato etiqueta="Celular">{ficha.telefono_celular}</Dato>
            <Dato etiqueta="Correo">{ficha.correo_personal}</Dato>
            <Dato etiqueta="Dirección">{ficha.direccion_domicilio}</Dato>
          </dl>
        </section>

        <section className="asig-bloque asig-bloque--ultimo" aria-labelledby={`${uid}-historial`}>
          <h4 id={`${uid}-historial`} className="asig-bloque__titulo">
            Historial de asignaciones
          </h4>
          <Historial historial={ficha.historial} />
        </section>
      </>
    );
  }

  return (
    <section className="ui-card ui-table-card asig-ficha" aria-labelledby={`${uid}-titulo`} aria-busy={cargando}>
      <header className="ui-card__header">
        <div>
          <h3 id={`${uid}-titulo`} className="ui-card__title">
            Ficha del empleado
          </h3>
          <p className="ui-card__subtitle">Cargo, área y sucursal vigentes.</p>
        </div>
        {selector}
      </header>
      {contenido}
    </section>
  );
}
