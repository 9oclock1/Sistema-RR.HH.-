import { useEffect, useId, useRef, useState } from 'react';
import { IconoAlerta, IconoCheck, IconoCerrar } from '../../../components/Iconos';
import { mapearErroresApi } from '../../../utils/erroresApi';
import { useNivelesEducacion } from '../hooks/useNivelesEducacion';
import { usePerfilCargo } from '../hooks/usePerfilCargo';
import {
  CAMPOS_DEL_FORMULARIO,
  CAMPOS_PERFIL,
  ETIQUETAS_CAMPO,
  convocatoriaAFormulario,
  formularioAPayload,
  formularioVacio,
  hoyLocal,
  perfilAFormulario,
  validarFormulario,
} from '../utils/vacanteFormulario';
import HabilidadesInput from './HabilidadesInput';

// Valores de los campos del perfil en un formulario nuevo (experiencia arranca en '0').
const PERFIL_VACIO = perfilAFormulario({});
import PerfilCargoPreview from './PerfilCargoPreview';

export default function VacanteForm({ convocatoria, cargos, errorCargos, cargandoCargos, aviso, onGuardar, onCancelar }) {
  const esEdicion = Boolean(convocatoria);
  const uid = useId();
  const idCampo = (campo) => `${uid}-${campo}`;
  const idError = (campo) => `${uid}-${campo}-error`;

  const [valores, setValores] = useState(() =>
    convocatoria ? convocatoriaAFormulario(convocatoria) : formularioVacio()
  );
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const niveles = useNivelesEducacion();
  const perfil = usePerfilCargo();
  const { cargar: cargarPerfil } = perfil;

  // Valores que puso el último perfil aplicado: permite saber qué campos no tocó el reclutador.
  const perfilAplicado = useRef(null);

  // Al editar un borrador se muestra el perfil de su cargo, pero sin pisar lo ya guardado.
  const idCargoInicial = convocatoria?.id_cargo_referencial;
  useEffect(() => {
    if (idCargoInicial) cargarPerfil(idCargoInicial);
  }, [idCargoInicial, cargarPerfil]);

  const controles = useRef({});
  const registrar = (campo) => (elemento) => {
    controles.current[campo] = elemento;
  };
  const enfocarPrimerError = (erroresActuales) => {
    const campo = CAMPOS_DEL_FORMULARIO.find((c) => erroresActuales[c]);
    controles.current[campo]?.focus();
  };

  const limpiarErrores = (campos) => {
    if (!campos.some((campo) => errores[campo])) return;
    setErrores((previos) => {
      const siguientes = { ...previos };
      campos.forEach((campo) => delete siguientes[campo]);
      return siguientes;
    });
  };

  const actualizarCampo = (campo, valor) => {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    limpiarErrores([campo]);
  };

  // Precarga (RF-08.2). Sin `forzar`, solo reemplaza campos vacíos o que aún tienen lo del perfil anterior,
  // así cambiar de cargo no borra lo que el reclutador escribió a mano.
  const aplicarPerfil = (perfilCargo, { forzar = false } = {}) => {
    const nuevos = perfilAFormulario(perfilCargo);
    const anteriores = perfilAplicado.current;
    perfilAplicado.current = nuevos;

    setValores((previos) => {
      const siguientes = { ...previos };
      CAMPOS_PERFIL.forEach((campo) => {
        const intacto = previos[campo] === '' || previos[campo] === anteriores?.[campo] || previos[campo] === PERFIL_VACIO[campo];
        if (forzar || intacto) siguientes[campo] = nuevos[campo];
      });
      return siguientes;
    });
    limpiarErrores(CAMPOS_PERFIL);
  };

  const seleccionarCargo = async (idCargo) => {
    actualizarCampo('id_cargo_referencial', idCargo);
    const datos = await cargarPerfil(idCargo);
    if (datos) aplicarPerfil(datos.perfil);
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

  // El cargo de un borrador pudo darse de baja: se conserva como opción para no perder el dato.
  const cargoFaltante =
    valores.id_cargo_referencial && !cargos.some((c) => c.id_cargo === valores.id_cargo_referencial);
  const pendientes = convocatoria?.campos_pendientes ?? [];

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

  const requerido = (
    <span className="ui-field__required" aria-hidden="true">
      *
    </span>
  );
  const paraPublicar = <span className="ui-field__optional">· para publicar</span>;

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
            {esEdicion ? 'Editar borrador' : 'Nueva vacante'}
          </h3>
          <p className="ui-card__subtitle">
            {esEdicion
              ? `${convocatoria.codigo_convocatoria} · ${convocatoria.titulo_puesto}`
              : 'Elige un cargo para precargar su perfil y completa los requisitos.'}
          </p>
        </div>
        {esEdicion && (
          <button type="button" className="ui-icon-btn" onClick={onCancelar} aria-label="Cerrar borrador" title="Nueva vacante">
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
      {esEdicion && (
        <div className={`vacantes-pendientes${pendientes.length === 0 ? ' is-listo' : ''}`} role="note">
          {pendientes.length === 0 ? <IconoCheck size={14} /> : <IconoAlerta size={14} />}
          <span>
            {pendientes.length === 0
              ? 'Listo para publicar.'
              : `Para publicar falta: ${pendientes.map((c) => ETIQUETAS_CAMPO[c] ?? c).join(', ')}.`}
          </span>
        </div>
      )}

      <div className="ui-form__body">
        <div className="ui-field">
          <label htmlFor={idCampo('id_cargo_referencial')} className="ui-field__label">
            Cargo {requerido}
          </label>
          <select
            className="ui-input ui-select"
            value={valores.id_cargo_referencial}
            required
            disabled={cargandoCargos}
            onChange={(e) => seleccionarCargo(e.target.value)}
            {...propsCampo('id_cargo_referencial')}
          >
            <option value="">{cargandoCargos ? 'Cargando…' : 'Selecciona un cargo'}</option>
            {cargos.map((c) => (
              <option key={c.id_cargo} value={c.id_cargo}>
                {c.nombre} · {c.departamento}
              </option>
            ))}
            {cargoFaltante && (
              <option value={valores.id_cargo_referencial}>{perfil.datos?.cargo.nombre ?? 'Cargo inactivo'}</option>
            )}
          </select>
          {errores.id_cargo_referencial
            ? mensajeError('id_cargo_referencial')
            : errorCargos && <p className="ui-field__hint is-warning">No se pudieron cargar los cargos.</p>}
          <PerfilCargoPreview
            cargando={perfil.cargando}
            datos={perfil.datos}
            error={perfil.error}
            onAplicar={() => aplicarPerfil(perfil.datos.perfil, { forzar: true })}
          />
        </div>

        <div className="ui-field">
          <label htmlFor={idCampo('titulo_puesto')} className="ui-field__label">
            Título del puesto {requerido}
          </label>
          <input
            type="text"
            className="ui-input"
            value={valores.titulo_puesto}
            maxLength={120}
            placeholder="Se precarga con el nombre del cargo"
            required
            onChange={(e) => actualizarCampo('titulo_puesto', e.target.value)}
            {...propsCampo('titulo_puesto')}
          />
          {mensajeError('titulo_puesto')}
        </div>

        <div className="ui-field">
          <label htmlFor={idCampo('descripcion_puesto')} className="ui-field__label">
            Descripción {paraPublicar}
          </label>
          <textarea
            className="ui-input ui-textarea"
            rows={5}
            value={valores.descripcion_puesto}
            placeholder="Funciones y requisitos del puesto"
            onChange={(e) => actualizarCampo('descripcion_puesto', e.target.value)}
            {...propsCampo('descripcion_puesto')}
          />
          {mensajeError('descripcion_puesto')}
        </div>

        <div className="ui-form__row">
          <div className="ui-field">
            <label htmlFor={idCampo('nivel_educacion_min')} className="ui-field__label">
              Formación mínima
            </label>
            <select
              className="ui-input ui-select"
              value={valores.nivel_educacion_min}
              disabled={niveles.cargando}
              onChange={(e) => actualizarCampo('nivel_educacion_min', e.target.value)}
              {...propsCampo('nivel_educacion_min')}
            >
              <option value="">{niveles.cargando ? 'Cargando…' : 'Sin definir'}</option>
              {niveles.niveles.map((n) => (
                <option key={n.codigo} value={n.codigo}>
                  {n.nombre}
                </option>
              ))}
            </select>
            {errores.nivel_educacion_min ? (
              mensajeError('nivel_educacion_min')
            ) : niveles.error ? (
              <p className="ui-field__hint is-warning">No se pudieron cargar los niveles.</p>
            ) : (
              <p className="ui-field__hint">Necesaria para publicar.</p>
            )}
          </div>

          <div className="ui-field">
            <label htmlFor={idCampo('year_experiencia_min')} className="ui-field__label">
              Experiencia {requerido}
            </label>
            <input
              type="number"
              className="ui-input"
              value={valores.year_experiencia_min}
              min={0}
              max={999.9}
              step={0.5}
              required
              onChange={(e) => actualizarCampo('year_experiencia_min', e.target.value)}
              {...propsCampo('year_experiencia_min')}
            />
            {errores.year_experiencia_min ? mensajeError('year_experiencia_min') : <p className="ui-field__hint">Años mínimos.</p>}
          </div>
        </div>

        <div className="ui-form__row">
          <div className="ui-field">
            <label htmlFor={idCampo('cantidad_vacantes')} className="ui-field__label">
              Vacantes {requerido}
            </label>
            <input
              type="number"
              className="ui-input"
              value={valores.cantidad_vacantes}
              min={1}
              step={1}
              required
              onChange={(e) => actualizarCampo('cantidad_vacantes', e.target.value)}
              {...propsCampo('cantidad_vacantes')}
            />
            {mensajeError('cantidad_vacantes')}
          </div>

          <div className="ui-field">
            <label htmlFor={idCampo('fecha_limite_postulacion')} className="ui-field__label">
              Fecha límite
            </label>
            <input
              type="date"
              className="ui-input"
              value={valores.fecha_limite_postulacion}
              min={hoyLocal()}
              onChange={(e) => actualizarCampo('fecha_limite_postulacion', e.target.value)}
              {...propsCampo('fecha_limite_postulacion')}
            />
            {errores.fecha_limite_postulacion ? (
              mensajeError('fecha_limite_postulacion')
            ) : (
              <p className="ui-field__hint">Necesaria para publicar.</p>
            )}
          </div>
        </div>

        <div className="ui-field">
          <label htmlFor={idCampo('id_sucursal_destino')} className="ui-field__label">
            Sucursal de destino {requerido}
          </label>
          {/* EmployeeService aún no expone el catálogo de sucursales: cuando exista, esto pasa a ser un <select>. */}
          <input
            type="text"
            className="ui-input vacantes-uuid"
            value={valores.id_sucursal_destino}
            placeholder="ID de la sucursal (UUID)"
            spellCheck={false}
            autoComplete="off"
            required
            onChange={(e) => actualizarCampo('id_sucursal_destino', e.target.value)}
            {...propsCampo('id_sucursal_destino')}
          />
          {mensajeError('id_sucursal_destino')}
        </div>

        <HabilidadesInput
          habilidades={valores.habilidades_clave_requeridas}
          onChange={(habilidades) => actualizarCampo('habilidades_clave_requeridas', habilidades)}
          error={errores.habilidades_clave_requeridas}
          errorId={idError('habilidades_clave_requeridas')}
          etiquetaExtra={paraPublicar}
        />
      </div>

      <footer className="ui-form__footer">
        {esEdicion && (
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </button>
        )}
        <button type="submit" className="ui-btn ui-btn--primary" disabled={guardando}>
          {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Guardar borrador'}
        </button>
      </footer>
    </form>
  );
}
