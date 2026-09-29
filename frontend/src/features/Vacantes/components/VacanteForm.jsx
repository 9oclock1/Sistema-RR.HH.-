import { useEffect, useId, useRef, useState } from 'react';
import { Alerta, Boton, Campo, CampoTexto, Modal, Selector } from '../../../components/ui';
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
import PerfilCargoPreview from './PerfilCargoPreview';

// Valores de los campos del perfil en un formulario nuevo (experiencia arranca en '0').
const PERFIL_VACIO = perfilAFormulario({});
const PARA_PUBLICAR = 'Necesaria para publicar.';

export default function VacanteForm({ convocatoria, cargos, errorCargos, cargandoCargos, onGuardar, onCancelar }) {
  const esEdicion = Boolean(convocatoria);
  const uid = useId();
  const idFormulario = `${uid}-formulario`;
  const idCampo = (campo) => `${uid}-${campo}`;

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
    error: errores[campo],
    value: valores[campo],
    onChange: (e) => actualizarCampo(campo, e.target.value),
  });

  return (
    <Modal
      abierto
      titulo={esEdicion ? `Editar borrador ${convocatoria.codigo_convocatoria}` : 'Nueva vacante'}
      onCerrar={onCancelar}
      bloqueado={guardando}
      pie={
        <>
          <Boton variante="sutil" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form={idFormulario} cargando={guardando}>
            {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Guardar borrador'}
          </Boton>
        </>
      }
    >
      <form id={idFormulario} className="vacante-form" onSubmit={manejarSubmit} noValidate>
        {!esEdicion && <p>Elige un cargo para precargar su perfil y completa los requisitos.</p>}

        {errorGeneral && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo guardar el borrador">
            {errorGeneral}
          </Alerta>
        )}
        {esEdicion && (
          <Alerta tono={pendientes.length > 0 ? 'aviso' : 'exito'} role="status">
            {pendientes.length > 0
              ? `Para publicar falta: ${pendientes.map((c) => ETIQUETAS_CAMPO[c] ?? c).join(', ')}.`
              : 'Listo para publicar.'}
          </Alerta>
        )}

        <div className="vacante-form__cargo">
          <Selector
            {...propsCampo('id_cargo_referencial')}
            onChange={(e) => seleccionarCargo(e.target.value)}
            etiqueta="Cargo"
            requerido
            disabled={cargandoCargos}
            textoVacio={cargandoCargos ? 'Cargando…' : 'Selecciona un cargo'}
            opciones={cargos.map((c) => ({ valor: c.id_cargo, etiqueta: `${c.nombre} · ${c.departamento}` }))}
            ayuda={errorCargos && !errores.id_cargo_referencial ? 'No se pudieron cargar los cargos.' : undefined}
            data-autofocus
          >
            {cargoFaltante && (
              <option value={valores.id_cargo_referencial}>{perfil.datos?.cargo.nombre ?? 'Cargo inactivo'}</option>
            )}
          </Selector>
          <PerfilCargoPreview
            cargando={perfil.cargando}
            datos={perfil.datos}
            error={perfil.error}
            onAplicar={() => aplicarPerfil(perfil.datos.perfil, { forzar: true })}
          />
        </div>

        <CampoTexto
          {...propsCampo('titulo_puesto')}
          etiqueta="Título del puesto"
          requerido
          maxLength={120}
          placeholder="Se precarga con el nombre del cargo"
        />

        <Campo id={idCampo('descripcion_puesto')} etiqueta="Descripción" ayuda={PARA_PUBLICAR} error={errores.descripcion_puesto}>
          {(atributos) => (
            <textarea
              className="ds-control vacante-form__textarea"
              rows={5}
              ref={registrar('descripcion_puesto')}
              value={valores.descripcion_puesto}
              placeholder="Funciones y requisitos del puesto"
              onChange={(e) => actualizarCampo('descripcion_puesto', e.target.value)}
              {...atributos}
            />
          )}
        </Campo>

        <div className="vacante-form__fila">
          <Selector
            {...propsCampo('nivel_educacion_min')}
            etiqueta="Formación mínima"
            disabled={niveles.cargando}
            textoVacio={niveles.cargando ? 'Cargando…' : 'Sin definir'}
            opciones={niveles.niveles.map((n) => ({ valor: n.codigo, etiqueta: n.nombre }))}
            ayuda={niveles.error ? 'No se pudieron cargar los niveles.' : PARA_PUBLICAR}
          />
          <CampoTexto
            {...propsCampo('year_experiencia_min')}
            type="number"
            inputMode="decimal"
            etiqueta="Experiencia mínima"
            requerido
            min={0}
            max={999.9}
            step={0.5}
            ayuda="En años, hasta un decimal."
          />
        </div>

        <div className="vacante-form__fila">
          <CampoTexto
            {...propsCampo('cantidad_vacantes')}
            type="number"
            inputMode="numeric"
            etiqueta="Vacantes"
            requerido
            min={1}
            step={1}
          />
          <CampoTexto
            {...propsCampo('fecha_limite_postulacion')}
            type="date"
            etiqueta="Fecha límite"
            min={hoyLocal()}
            ayuda={PARA_PUBLICAR}
          />
        </div>

        {/* EmployeeService aún no expone el catálogo de sucursales: cuando exista, esto pasa a ser un Selector. */}
        <CampoTexto
          {...propsCampo('id_sucursal_destino')}
          className="vacante-form__uuid"
          etiqueta="Sucursal de destino"
          requerido
          placeholder="ID de la sucursal (UUID)"
          spellCheck={false}
          autoComplete="off"
        />

        <HabilidadesInput
          id={idCampo('habilidades_clave_requeridas')}
          habilidades={valores.habilidades_clave_requeridas}
          onChange={(habilidades) => actualizarCampo('habilidades_clave_requeridas', habilidades)}
          error={errores.habilidades_clave_requeridas}
          ayuda={PARA_PUBLICAR}
        />
      </form>
    </Modal>
  );
}
