import { useId, useRef, useState } from 'react';
import { IconoAlerta, IconoCheck, IconoCerrar } from '../../../components/Iconos';
import { mapearErroresApi } from '../../../utils/erroresApi';

const MAX_DESCRIPCION = 255;

const CAMPOS_DEL_FORMULARIO = ['nombre', 'codigo', 'id_departamento_padre', 'descripcion'];

const areaAFormulario = (area) => ({
  nombre: area?.nombre ?? '',
  codigo: area?.codigo ?? '',
  id_departamento_padre: area?.id_departamento_padre ?? '',
  descripcion: area?.descripcion ?? '',
});

const formularioAPayload = (valores) => ({
  nombre: valores.nombre.trim(),
  codigo: valores.codigo.trim(),
  id_departamento_padre: valores.id_departamento_padre || null,
  descripcion: valores.descripcion.trim() || null,
});

const validarFormulario = (valores) => {
  const errores = {};
  if (!valores.nombre.trim()) errores.nombre = 'El nombre del área es obligatorio.';
  if (!valores.codigo.trim()) errores.codigo = 'El código es obligatorio.';
  return errores;
};

const idsExcluidos = (area, areas) => {
  if (!area) return new Set();
  const excluidos = new Set([area.id_departamento]);
  let agregados = true;
  while (agregados) {
    agregados = false;
    for (const a of areas) {
      if (!excluidos.has(a.id_departamento) && excluidos.has(a.id_departamento_padre)) {
        excluidos.add(a.id_departamento);
        agregados = true;
      }
    }
  }
  return excluidos;
};

export default function DepartamentoForm({ area, areas, errorAreas, cargandoAreas, aviso, onGuardar, onCancelar }) {
  const esEdicion = Boolean(area);
  const uid = useId();
  const idCampo = (campo) => `${uid}-${campo}`;
  const idError = (campo) => `${uid}-${campo}-error`;

  const [valores, setValores] = useState(() => areaAFormulario(area));
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [guardando, setGuardando] = useState(false);

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

  const excluidos = idsExcluidos(area, areas);
  const opcionesPadre = areas.filter((a) => !excluidos.has(a.id_departamento));
  const padreFaltante =
    valores.id_departamento_padre && !areas.some((a) => a.id_departamento === valores.id_departamento_padre);

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
            {esEdicion ? 'Editar área' : 'Nueva área'}
          </h3>
          <p className="ui-card__subtitle">
            {esEdicion ? `Modificando «${area.nombre}»` : 'Registra un departamento o una sección operativa.'}
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
            Nombre del área <span className="ui-field__required" aria-hidden="true">*</span>
          </label>
          <input
            type="text"
            className="ui-input"
            value={valores.nombre}
            maxLength={100}
            placeholder="Ej. Panadería"
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
              placeholder="Ej. PAN"
              required
              onChange={(e) => actualizarCampo('codigo', e.target.value)}
              {...propsCampo('codigo')}
            />
            {mensajeError('codigo')}
          </div>

          <div className="ui-field">
            <label htmlFor={idCampo('id_departamento_padre')} className="ui-field__label">
              Depende de
            </label>
            <select
              className="ui-input ui-select"
              value={valores.id_departamento_padre}
              disabled={cargandoAreas}
              onChange={(e) => actualizarCampo('id_departamento_padre', e.target.value)}
              {...propsCampo('id_departamento_padre')}
            >
              <option value="">{cargandoAreas ? 'Cargando…' : 'Ninguna'}</option>
              {opcionesPadre.map((a) => (
                <option key={a.id_departamento} value={a.id_departamento}>
                  {a.nombre}
                </option>
              ))}
              {padreFaltante && (
                <option value={valores.id_departamento_padre}>{area?.departamento_padre ?? 'Área inactiva'}</option>
              )}
            </select>
            {errores.id_departamento_padre
              ? mensajeError('id_departamento_padre')
              : errorAreas && <p className="ui-field__hint is-warning">No se pudieron cargar las áreas.</p>}
          </div>
        </div>

        <div className="ui-field">
          <label htmlFor={idCampo('descripcion')} className="ui-field__label">
            Descripción <span className="ui-field__optional">opcional</span>
          </label>
          <textarea
            className="ui-input ui-textarea"
            rows={3}
            value={valores.descripcion}
            maxLength={MAX_DESCRIPCION}
            placeholder="Qué hace esta área y qué la distingue"
            onChange={(e) => actualizarCampo('descripcion', e.target.value)}
            {...propsCampo('descripcion')}
          />
          {errores.descripcion ? (
            mensajeError('descripcion')
          ) : (
            <p className="ui-field__hint">
              {valores.descripcion.length}/{MAX_DESCRIPCION}
            </p>
          )}
        </div>
      </div>

      <footer className="ui-form__footer">
        {esEdicion && (
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </button>
        )}
        <button type="submit" className="ui-btn ui-btn--primary" disabled={guardando}>
          {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear área'}
        </button>
      </footer>
    </form>
  );
}
