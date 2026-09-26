import { useId, useRef, useState } from 'react';
import { IconoAlerta, IconoCheck } from '../../../components/Iconos';
import { mapearErroresApi } from '../../../utils/erroresApi';
import { formatearFecha } from '../../Vacantes/utils/formato';

const CAMPOS = ['id_cargo', 'id_sucursal', 'fecha_inicio'];

const hoyLocal = () => new Intl.DateTimeFormat('en-CA').format(new Date());

const validar = (valores) => {
  const errores = {};
  if (!valores.id_cargo) errores.id_cargo = 'Selecciona un cargo.';
  if (!valores.id_sucursal) errores.id_sucursal = 'Selecciona una sucursal.';
  if (!valores.fecha_inicio) errores.fecha_inicio = 'Indica desde cuándo rige.';
  else if (valores.fecha_inicio > hoyLocal()) errores.fecha_inicio = 'No puede ser una fecha futura.';
  return errores;
};

export default function AsignacionForm({
  empleado,
  cargos,
  cargandoCargos,
  errorCargos,
  sucursales,
  cargandoSucursales,
  errorSucursales,
  aviso,
  onAsignar,
}) {
  const uid = useId();
  const idCampo = (campo) => `${uid}-${campo}`;
  const idError = (campo) => `${uid}-${campo}-error`;

  const [valores, setValores] = useState({ id_cargo: '', id_sucursal: '', fecha_inicio: hoyLocal() });
  const [errores, setErrores] = useState({});
  const [camposRechazados, setCamposRechazados] = useState([]);
  const [rechazo, setRechazo] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const controles = useRef({});
  const registrar = (campo) => (elemento) => {
    controles.current[campo] = elemento;
  };

  const actualizarCampo = (campo, valor) => {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    if (errores[campo]) {
      setErrores((previos) => {
        const siguientes = { ...previos };
        delete siguientes[campo];
        return siguientes;
      });
    }
    if (camposRechazados.includes(campo)) setCamposRechazados((previos) => previos.filter((c) => c !== campo));
  };

  const manejarSubmit = async (evento) => {
    evento.preventDefault();
    setRechazo(null);
    setCamposRechazados([]);

    const erroresCliente = validar(valores);
    setErrores(erroresCliente);
    const primero = CAMPOS.find((c) => erroresCliente[c]);
    if (primero) return controles.current[primero]?.focus();

    setGuardando(true);
    try {
      await onAsignar({ id_empleado: empleado.id_empleado, ...valores });
    } catch (error) {
      const { porCampo } = mapearErroresApi(error.errores ?? [], CAMPOS);
      const rechazados = Object.keys(porCampo);
      setRechazo(error.message);
      setCamposRechazados(rechazados);
      if (rechazados.length > 0) controles.current[CAMPOS.find((c) => porCampo[c])]?.focus();
      setGuardando(false);
    }
  };

  const cargoElegido = cargos.find((c) => c.id_cargo === valores.id_cargo);
  const cargoFaltante = valores.id_cargo && !cargoElegido;
  const actual = empleado?.asignacion_actual;
  const fechaMinima = [empleado?.fecha_ingreso, actual?.vigente_desde].filter(Boolean).sort().at(-1);

  const propsCampo = (campo) => {
    const invalido = Boolean(errores[campo]) || camposRechazados.includes(campo);
    return {
      id: idCampo(campo),
      ref: registrar(campo),
      'aria-invalid': invalido ? true : undefined,
      'aria-describedby': errores[campo] ? idError(campo) : rechazo && invalido ? `${uid}-rechazo` : undefined,
    };
  };

  const mensajeError = (campo) =>
    errores[campo] && (
      <p id={idError(campo)} className="ui-field__error">
        {errores[campo]}
      </p>
    );

  const requerido = (
    <span className="ui-field__required" aria-hidden="true">
      *
    </span>
  );

  return (
    <form className="ui-card ui-form" onSubmit={manejarSubmit} noValidate aria-labelledby={idCampo('titulo')}>
      <header className="ui-card__header">
        <div>
          <h3 id={idCampo('titulo')} className="ui-card__title">
            Nueva asignación
          </h3>
          <p className="ui-card__subtitle">
            {empleado ? `Para ${empleado.nombre_completo}` : 'Selecciona un empleado para asignarle cargo y sucursal.'}
          </p>
        </div>
      </header>

      {aviso && (
        <div className="ui-alert ui-alert--success" role="status">
          <IconoCheck /> <span>{aviso}</span>
        </div>
      )}
      {rechazo && (
        <div id={`${uid}-rechazo`} className="ui-alert ui-alert--error" role="alert">
          <IconoAlerta /> <span>{rechazo}</span>
        </div>
      )}

      {actual && (
        <div className="asig-actual">
          <span className="asig-bloque__titulo">Asignación actual</span>
          <span>
            {actual.cargo.nombre} · {actual.sucursal.nombre}
          </span>
        </div>
      )}

      {/* Sin empleado elegido, el fieldset deshabilita todos los controles de una vez. */}
      <fieldset className="asig-fieldset" disabled={!empleado || guardando}>
        <div className="ui-form__body">
          <div className="ui-field">
            <label htmlFor={idCampo('id_cargo')} className="ui-field__label">
              Cargo {requerido}
            </label>
            <select
              className="ui-input ui-select"
              value={valores.id_cargo}
              required
              disabled={cargandoCargos}
              onChange={(e) => actualizarCampo('id_cargo', e.target.value)}
              {...propsCampo('id_cargo')}
            >
              <option value="">{cargandoCargos ? 'Cargando…' : 'Selecciona un cargo'}</option>
              {cargos.map((c) => (
                <option key={c.id_cargo} value={c.id_cargo}>
                  {c.nombre}
                </option>
              ))}
              {cargoFaltante && <option value={valores.id_cargo}>Cargo seleccionado (no disponible)</option>}
            </select>
            {errores.id_cargo
              ? mensajeError('id_cargo')
              : errorCargos && <p className="ui-field__hint is-warning">No se pudieron cargar los cargos.</p>}
          </div>

          {/* El área no se elige aparte: es la del cargo, así nunca se contradicen. */}
          <div className="ui-field">
            <label htmlFor={idCampo('area')} className="ui-field__label">
              Área
            </label>
            <input
              id={idCampo('area')}
              type="text"
              className="ui-input"
              value={cargoElegido?.departamento ?? ''}
              placeholder="Se completa con el cargo"
              readOnly
              tabIndex={-1}
            />
          </div>

          <div className="ui-field">
            <label htmlFor={idCampo('id_sucursal')} className="ui-field__label">
              Sucursal {requerido}
            </label>
            <select
              className="ui-input ui-select"
              value={valores.id_sucursal}
              required
              disabled={cargandoSucursales}
              onChange={(e) => actualizarCampo('id_sucursal', e.target.value)}
              {...propsCampo('id_sucursal')}
            >
              <option value="">{cargandoSucursales ? 'Cargando…' : 'Selecciona una sucursal'}</option>
              {sucursales.map((s) => (
                <option key={s.id_sucursal} value={s.id_sucursal}>
                  {s.nombre} · {s.ciudad}
                </option>
              ))}
            </select>
            {errores.id_sucursal
              ? mensajeError('id_sucursal')
              : errorSucursales && <p className="ui-field__hint is-warning">No se pudieron cargar las sucursales.</p>}
          </div>

          <div className="ui-field">
            <label htmlFor={idCampo('fecha_inicio')} className="ui-field__label">
              Vigente desde {requerido}
            </label>
            <input
              type="date"
              className="ui-input"
              value={valores.fecha_inicio}
              min={fechaMinima}
              max={hoyLocal()}
              required
              onChange={(e) => actualizarCampo('fecha_inicio', e.target.value)}
              {...propsCampo('fecha_inicio')}
            />
            {errores.fecha_inicio ? (
              mensajeError('fecha_inicio')
            ) : (
              <p className="ui-field__hint">
                {actual?.vigente_desde
                  ? `La asignación actual se cerrará en esta fecha (rige desde ${formatearFecha(actual.vigente_desde)}).`
                  : 'Si ya tiene una asignación, se cerrará en esta fecha.'}
              </p>
            )}
          </div>
        </div>
      </fieldset>

      <footer className="ui-form__footer">
        <button type="submit" className="ui-btn ui-btn--primary" disabled={!empleado || guardando}>
          {guardando ? 'Asignando…' : 'Asignar'}
        </button>
      </footer>
    </form>
  );
}
