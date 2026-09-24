import { useId, useRef, useState } from 'react';
import {
  cargoAFormulario,
  formularioAPayload,
  formularioVacio,
  mapearErroresApi,
  validarFormulario,
} from '../utils/cargoFormulario';
import { formatearRangoSalarial } from '../utils/formato';
import FuncionesInput from './FuncionesInput';
import { IconoAlerta, IconoCheck, IconoCerrar } from './Iconos';

export default function CargoForm({
  cargo,
  departamentos,
  niveles,
  errorDepartamentos,
  errorNiveles,
  cargandoCatalogos,
  aviso,
  onGuardar,
  onCancelar,
}) {
  const esEdicion = Boolean(cargo);
  const uid = useId();
  const ids = {
    titulo: `${uid}-titulo`,
    nombre: `${uid}-nombre`,
    nivel: `${uid}-nivel`,
    departamento: `${uid}-departamento`,
    perfil: `${uid}-perfil`,
  };
  const idError = (campo) => `${uid}-${campo}-error`;

  const [valores, setValores] = useState(() => (cargo ? cargoAFormulario(cargo) : formularioVacio()));
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const nombreRef = useRef(null);
  const nivelRef = useRef(null);

  const actualizarCampo = (campo, valor) => {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    if (errores[campo]) {
      setErrores((previos) => {
        const siguientes = { ...previos };
        delete siguientes[campo];
        return siguientes;
      });
    }
  };

  const manejarSubmit = async (evento) => {
    evento.preventDefault();
    setErrorGeneral(null);

    const erroresCliente = validarFormulario(valores);
    setErrores(erroresCliente);
    if (erroresCliente.nombre) return nombreRef.current?.focus();
    if (erroresCliente.id_nivel_salarial) return nivelRef.current?.focus();

    setGuardando(true);
    try {
      await onGuardar(formularioAPayload(valores));
    } catch (error) {
      const { porCampo, generales } = mapearErroresApi(error.errores ?? []);
      setErrores(porCampo);
      if (generales.length > 0) setErrorGeneral(generales.join(' '));
      else if (Object.keys(porCampo).length === 0) setErrorGeneral(error.message);
      setGuardando(false);
    }
  };

  const departamentoFaltante =
    valores.id_departamento && !departamentos.some((d) => String(d.id_departamento) === valores.id_departamento);
  const nivelSeleccionado = niveles.find((n) => String(n.id_nivel) === valores.id_nivel_salarial);
  const nivelFaltante = valores.id_nivel_salarial && !nivelSeleccionado;

  const propsAria = (campo) => ({
    'aria-invalid': errores[campo] ? true : undefined,
    'aria-describedby': errores[campo] ? idError(campo) : undefined,
  });

  return (
    <form
      className={`cargos-card cargos-form${esEdicion ? ' is-editing' : ''}`}
      onSubmit={manejarSubmit}
      noValidate
      aria-labelledby={ids.titulo}
    >
      <header className="cargos-card__header">
        <div>
          <h3 id={ids.titulo} className="cargos-card__title">
            {esEdicion ? 'Editar cargo' : 'Nuevo cargo'}
          </h3>
          <p className="cargos-card__subtitle">
            {esEdicion ? `Modificando «${cargo.nombre}»` : 'Define el puesto, su nivel salarial y sus funciones.'}
          </p>
        </div>
        {esEdicion && (
          <button type="button" className="cargos-icon-btn" onClick={onCancelar} aria-label="Cancelar edición" title="Cancelar edición">
            <IconoCerrar />
          </button>
        )}
      </header>

      {aviso && (
        <div className="cargos-alert cargos-alert--success" role="status">
          <IconoCheck /> <span>{aviso}</span>
        </div>
      )}
      {errorGeneral && (
        <div className="cargos-alert cargos-alert--error" role="alert">
          <IconoAlerta /> <span>{errorGeneral}</span>
        </div>
      )}

      <div className="cargos-form__body">
        <div className="cargos-field">
          <label htmlFor={ids.nombre} className="cargos-field__label">
            Nombre del cargo <span className="cargos-field__required" aria-hidden="true">*</span>
          </label>
          <input
            ref={nombreRef}
            id={ids.nombre}
            type="text"
            className="cargos-input"
            value={valores.nombre}
            maxLength={100}
            placeholder="Ej. Cajero"
            required
            onChange={(e) => actualizarCampo('nombre', e.target.value)}
            {...propsAria('nombre')}
          />
          {errores.nombre && (
            <p id={idError('nombre')} className="cargos-field__error">
              {errores.nombre}
            </p>
          )}
        </div>

        <div className="cargos-form__row">
          <div className="cargos-field">
            <label htmlFor={ids.nivel} className="cargos-field__label">
              Nivel salarial <span className="cargos-field__required" aria-hidden="true">*</span>
            </label>
            <select
              ref={nivelRef}
              id={ids.nivel}
              className="cargos-input cargos-select"
              value={valores.id_nivel_salarial}
              required
              disabled={cargandoCatalogos}
              onChange={(e) => actualizarCampo('id_nivel_salarial', e.target.value)}
              {...propsAria('id_nivel_salarial')}
            >
              <option value="">{cargandoCatalogos ? 'Cargando…' : 'Selecciona un nivel'}</option>
              {niveles.map((nivel) => (
                <option key={nivel.id_nivel} value={String(nivel.id_nivel)}>
                  {nivel.nombre}
                </option>
              ))}
              {nivelFaltante && <option value={valores.id_nivel_salarial}>{cargo?.nivel_salarial ?? `Nivel ${valores.id_nivel_salarial}`}</option>}
            </select>
            {errores.id_nivel_salarial ? (
              <p id={idError('id_nivel_salarial')} className="cargos-field__error">
                {errores.id_nivel_salarial}
              </p>
            ) : errorNiveles ? (
              <p className="cargos-field__hint is-warning">No se pudieron cargar los niveles salariales.</p>
            ) : (
              nivelSeleccionado && <p className="cargos-field__hint">{formatearRangoSalarial(nivelSeleccionado)}</p>
            )}
          </div>

          <div className="cargos-field">
            <label htmlFor={ids.departamento} className="cargos-field__label">
              Área
            </label>
            <select
              id={ids.departamento}
              className="cargos-input cargos-select"
              value={valores.id_departamento}
              disabled={cargandoCatalogos}
              onChange={(e) => actualizarCampo('id_departamento', e.target.value)}
              {...propsAria('id_departamento')}
            >
              <option value="">Sin área asignada</option>
              {departamentos.map((d) => (
                <option key={d.id_departamento} value={String(d.id_departamento)}>
                  {d.nombre}
                </option>
              ))}
              {departamentoFaltante && (
                <option value={valores.id_departamento}>{cargo?.departamento ?? `Área ${valores.id_departamento}`}</option>
              )}
            </select>
            {errores.id_departamento ? (
              <p id={idError('id_departamento')} className="cargos-field__error">
                {errores.id_departamento}
              </p>
            ) : (
              errorDepartamentos && <p className="cargos-field__hint is-warning">No se pudieron cargar las áreas.</p>
            )}
          </div>
        </div>

        <div className="cargos-field">
          <label htmlFor={ids.perfil} className="cargos-field__label">
            Perfil requerido <span className="cargos-field__optional">opcional</span>
          </label>
          <textarea
            id={ids.perfil}
            className="cargos-input cargos-textarea"
            rows={3}
            value={valores.perfil_requerido}
            placeholder="Formación, experiencia y habilidades esperadas"
            onChange={(e) => actualizarCampo('perfil_requerido', e.target.value)}
            {...propsAria('perfil_requerido')}
          />
          {errores.perfil_requerido && (
            <p id={idError('perfil_requerido')} className="cargos-field__error">
              {errores.perfil_requerido}
            </p>
          )}
        </div>

        <FuncionesInput
          funciones={valores.funciones}
          onChange={(funciones) => actualizarCampo('funciones', funciones)}
          error={errores.funciones}
          errorId={idError('funciones')}
        />
      </div>

      <footer className="cargos-form__footer">
        {esEdicion && (
          <button type="button" className="cargos-btn cargos-btn--ghost" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </button>
        )}
        <button type="submit" className="cargos-btn cargos-btn--primary" disabled={guardando}>
          {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear cargo'}
        </button>
      </footer>
    </form>
  );
}
