import { useId, useRef, useState } from 'react';
import { IconoAlerta, IconoCheck, IconoCerrar } from '../../../components/Iconos';
import { mapearErroresApi } from '../../../utils/erroresApi';
import {
  CAMPOS_DEL_FORMULARIO,
  cargoAFormulario,
  formularioAPayload,
  formularioVacio,
  validarFormulario,
} from '../utils/cargoFormulario';
import { formatearFechaHora, formatearMonto } from '../utils/formato';
import { NIVELES_SALARIALES } from '../utils/nivelesSalariales';
import FuncionesInput from './FuncionesInput';

export default function CargoForm({
  cargo,
  departamentos,
  errorDepartamentos,
  cargandoCatalogos,
  aviso,
  onGuardar,
  onCancelar,
}) {
  const esEdicion = Boolean(cargo);
  const uid = useId();
  const idCampo = (campo) => `${uid}-${campo}`;
  const idError = (campo) => `${uid}-${campo}-error`;

  const [valores, setValores] = useState(() => (cargo ? cargoAFormulario(cargo) : formularioVacio()));
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Controles enfocables por nombre de campo, para llevar el foco al primer error.
  const controles = useRef({});
  const registrar = (campo) => (elemento) => {
    controles.current[campo] = elemento;
  };
  const enfocarPrimerError = (erroresActuales) => {
    const campo = CAMPOS_DEL_FORMULARIO.find((c) => erroresActuales[c]);
    controles.current[campo]?.focus();
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
  };

  const manejarSubmit = async (evento) => {
    evento.preventDefault();
    setErrorGeneral(null);

    const erroresCliente = validarFormulario(valores);
    setErrores(erroresCliente);
    if (Object.keys(erroresCliente).length > 0) return enfocarPrimerError(erroresCliente);

    setGuardando(true);
    try {
      await onGuardar(formularioAPayload(valores));
    } catch (error) {
      const { porCampo, generales } = mapearErroresApi(error.errores ?? [], CAMPOS_DEL_FORMULARIO);
      setErrores(porCampo);
      if (generales.length > 0) setErrorGeneral(generales.join(' '));
      else if (Object.keys(porCampo).length === 0) setErrorGeneral(error.message);
      else enfocarPrimerError(porCampo);
      setGuardando(false);
    }
  };

  // Si el cargo en edición pertenece a un área dada de baja, se conserva como opción para no perder el dato.
  const departamentoFaltante =
    valores.id_departamento && !departamentos.some((d) => d.id_departamento === valores.id_departamento);
  const salarioValido = /^\d{1,10}(\.\d{1,2})?$/.test(valores.salario_base_referencial.trim());
  // Un nivel fuera del catálogo (cargado a mano en la BD) se conserva como opción para no perderlo al editar.
  const nivelFueraDeCatalogo = valores.nivel_salarial && !NIVELES_SALARIALES.includes(valores.nivel_salarial);

  const propsCampo = (campo) => ({
    id: idCampo(campo),
    ref: registrar(campo),
    'aria-invalid': errores[campo] ? true : undefined,
    'aria-describedby': errores[campo] ? idError(campo) : undefined,
  });

  const mensajeError = (campo) =>
    errores[campo] && (
      <p id={idError(campo)} className="ui-field__error">
        {errores[campo]}
      </p>
    );

  return (
    <form
      className={`ui-card ui-form${esEdicion ? ' is-editing' : ''}`}
      onSubmit={manejarSubmit}
      noValidate
      aria-labelledby={idCampo('titulo')}
    >
      <header className="ui-card__header">
        <div>
          <h3 id={idCampo('titulo')} className="ui-card__title">
            {esEdicion ? 'Editar cargo' : 'Nuevo cargo'}
          </h3>
          <p className="ui-card__subtitle">
            {esEdicion ? `Modificando «${cargo.nombre}»` : 'Define el puesto, su nivel salarial, su salario y sus funciones.'}
          </p>
        </div>
        {esEdicion && (
          <button type="button" className="ui-icon-btn" onClick={onCancelar} aria-label="Cancelar edición" title="Cancelar edición">
            <IconoCerrar />
          </button>
        )}
      </header>

      {aviso && (
        <div className="ui-alert ui-alert--success" role="status">
          <IconoCheck /> <span>{aviso}</span>
        </div>
      )}
      {errorGeneral && (
        <div className="ui-alert ui-alert--error" role="alert">
          <IconoAlerta /> <span>{errorGeneral}</span>
        </div>
      )}

      <div className="ui-form__body">
        <div className="ui-field">
          <label htmlFor={idCampo('nombre')} className="ui-field__label">
            Nombre del cargo <span className="ui-field__required" aria-hidden="true">*</span>
          </label>
          <input
            type="text"
            className="ui-input"
            value={valores.nombre}
            maxLength={100}
            placeholder="Ej. Cajero"
            required
            onChange={(e) => actualizarCampo('nombre', e.target.value)}
            {...propsCampo('nombre')}
          />
          {mensajeError('nombre')}
        </div>

        <div className="ui-form__row">
          <div className="ui-field">
            <label htmlFor={idCampo('codigo')} className="ui-field__label">
              Código <span className="ui-field__required" aria-hidden="true">*</span>
            </label>
            <input
              type="text"
              className="ui-input"
              value={valores.codigo}
              maxLength={20}
              placeholder="Ej. CAJ-01"
              required
              onChange={(e) => actualizarCampo('codigo', e.target.value)}
              {...propsCampo('codigo')}
            />
            {mensajeError('codigo')}
          </div>

          <div className="ui-field">
            <label htmlFor={idCampo('id_departamento')} className="ui-field__label">
              Área <span className="ui-field__required" aria-hidden="true">*</span>
            </label>
            <select
              className="ui-input ui-select"
              value={valores.id_departamento}
              required
              disabled={cargandoCatalogos}
              onChange={(e) => actualizarCampo('id_departamento', e.target.value)}
              {...propsCampo('id_departamento')}
            >
              <option value="">{cargandoCatalogos ? 'Cargando…' : 'Selecciona un área'}</option>
              {departamentos.map((d) => (
                <option key={d.id_departamento} value={d.id_departamento}>
                  {d.nombre}
                </option>
              ))}
              {departamentoFaltante && <option value={valores.id_departamento}>{cargo?.departamento ?? 'Área inactiva'}</option>}
            </select>
            {errores.id_departamento
              ? mensajeError('id_departamento')
              : errorDepartamentos && <p className="ui-field__hint is-warning">No se pudieron cargar las áreas.</p>}
          </div>
        </div>

        <div className="ui-field">
          <label htmlFor={idCampo('nivel_salarial')} className="ui-field__label">
            Nivel salarial <span className="ui-field__required" aria-hidden="true">*</span>
          </label>
          <select
            className="ui-input ui-select"
            value={valores.nivel_salarial}
            required
            onChange={(e) => actualizarCampo('nivel_salarial', e.target.value)}
            {...propsCampo('nivel_salarial')}
          >
            <option value="">Selecciona un nivel</option>
            {NIVELES_SALARIALES.map((nivel) => (
              <option key={nivel} value={nivel}>
                {nivel}
              </option>
            ))}
            {nivelFueraDeCatalogo && <option value={valores.nivel_salarial}>{valores.nivel_salarial}</option>}
          </select>
          {mensajeError('nivel_salarial')}
        </div>

        <div className="ui-field">
          <label htmlFor={idCampo('salario_base_referencial')} className="ui-field__label">
            Salario base <span className="ui-field__required" aria-hidden="true">*</span>
          </label>
          <input
            type="text"
            inputMode="decimal"
            className="ui-input"
            value={valores.salario_base_referencial}
            placeholder="Ej. 3500.00"
            required
            onChange={(e) => actualizarCampo('salario_base_referencial', e.target.value)}
            {...propsCampo('salario_base_referencial')}
          />
          {errores.salario_base_referencial ? (
            mensajeError('salario_base_referencial')
          ) : (
            <p className="ui-field__hint">
              {salarioValido ? formatearMonto(valores.salario_base_referencial) : 'Referencial, en bolivianos.'}
            </p>
          )}
          {esEdicion && cargo.fecha_modificacion && (
            <p className="ui-field__hint">
              Última actualización de salario: {formatearFechaHora(cargo.fecha_modificacion)}
            </p>
          )}
        </div>

        <div className="ui-field">
          <label htmlFor={idCampo('requisitos_minimos')} className="ui-field__label">
            Requisitos mínimos <span className="ui-field__required" aria-hidden="true">*</span>
          </label>
          <textarea
            className="ui-input ui-textarea"
            rows={3}
            value={valores.requisitos_minimos}
            placeholder="Formación, experiencia y habilidades esperadas"
            required
            onChange={(e) => actualizarCampo('requisitos_minimos', e.target.value)}
            {...propsCampo('requisitos_minimos')}
          />
          {mensajeError('requisitos_minimos')}
        </div>

        <FuncionesInput
          funciones={valores.funciones}
          onChange={(funciones) => actualizarCampo('funciones', funciones)}
          error={errores.funciones}
          errorId={idError('funciones')}
        />
      </div>

      <footer className="ui-form__footer">
        {esEdicion && (
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </button>
        )}
        <button type="submit" className="ui-btn ui-btn--primary" disabled={guardando}>
          {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear cargo'}
        </button>
      </footer>
    </form>
  );
}
