import { useState } from 'react';
import { Alerta, Boton, Campo, CampoTexto, Modal, Selector } from '../../../components/ui';
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

const ID_FORMULARIO = 'cargo-formulario';
const idCampo = (campo) => `cargo-${campo}`;

const enfocarPrimerError = (errores) => {
  const campo = CAMPOS_DEL_FORMULARIO.find((c) => errores[c]);
  const nodo = campo && document.getElementById(idCampo(campo));
  (nodo?.matches('input, select, textarea') ? nodo : nodo?.querySelector('input'))?.focus();
};

export default function CargoForm({ cargo, departamentos, errorDepartamentos, cargandoCatalogos, onGuardar, onCancelar }) {
  const esEdicion = Boolean(cargo);

  const [valores, setValores] = useState(() => (cargo ? cargoAFormulario(cargo) : formularioVacio()));
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [guardando, setGuardando] = useState(false);

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

  const ayudaSalario = [
    salarioValido ? formatearMonto(valores.salario_base_referencial) : 'Referencial, en bolivianos.',
    esEdicion && cargo.fecha_modificacion && `Última actualización: ${formatearFechaHora(cargo.fecha_modificacion)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const propsCampo = (campo) => ({
    id: idCampo(campo),
    value: valores[campo],
    onChange: (e) => actualizarCampo(campo, e.target.value),
    error: errores[campo],
    requerido: true,
  });

  return (
    <Modal
      abierto
      titulo={esEdicion ? `Editar cargo «${cargo.nombre}»` : 'Nuevo cargo'}
      onCerrar={onCancelar}
      bloqueado={guardando}
      pie={
        <>
          <Boton variante="sutil" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form={ID_FORMULARIO} cargando={guardando}>
            {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear cargo'}
          </Boton>
        </>
      }
    >
      <form id={ID_FORMULARIO} className="cargo-formulario" onSubmit={manejarSubmit} noValidate>
        {errorGeneral && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo guardar el cargo">
            {errorGeneral}
          </Alerta>
        )}

        <div className="cargo-formulario__campos">
          <CampoTexto
            {...propsCampo('nombre')}
            etiqueta="Nombre del cargo"
            className="cargo-formulario__ancho"
            maxLength={100}
            placeholder="Ej. Cajero"
            autoComplete="off"
            data-autofocus
          />

          <CampoTexto
            {...propsCampo('codigo')}
            etiqueta="Código"
            maxLength={20}
            placeholder="Ej. CAJ-01"
            autoComplete="off"
          />

          <Selector
            {...propsCampo('id_departamento')}
            etiqueta="Área"
            disabled={cargandoCatalogos}
            textoVacio={cargandoCatalogos ? 'Cargando…' : 'Seleccione un área'}
            opciones={departamentos.map((d) => ({ valor: d.id_departamento, etiqueta: d.nombre }))}
            ayuda={errorDepartamentos ? 'No se pudieron cargar las áreas.' : undefined}
          >
            {departamentoFaltante && <option value={valores.id_departamento}>{cargo?.departamento ?? 'Área inactiva'}</option>}
          </Selector>

          <Selector
            {...propsCampo('nivel_salarial')}
            etiqueta="Nivel salarial"
            textoVacio="Seleccione un nivel"
            opciones={NIVELES_SALARIALES.map((nivel) => ({ valor: nivel, etiqueta: nivel }))}
          >
            {nivelFueraDeCatalogo && <option value={valores.nivel_salarial}>{valores.nivel_salarial}</option>}
          </Selector>

          <CampoTexto
            {...propsCampo('salario_base_referencial')}
            etiqueta="Salario base"
            inputMode="decimal"
            placeholder="Ej. 3500.00"
            autoComplete="off"
            ayuda={ayudaSalario}
          />

          <Campo
            id={idCampo('requisitos_minimos')}
            etiqueta="Requisitos mínimos"
            error={errores.requisitos_minimos}
            requerido
            className="cargo-formulario__ancho"
          >
            {(atributos) => (
              <textarea
                className="ds-control cargo-formulario__texto-largo"
                rows={3}
                value={valores.requisitos_minimos}
                placeholder="Formación, experiencia y habilidades esperadas"
                onChange={(e) => actualizarCampo('requisitos_minimos', e.target.value)}
                {...atributos}
              />
            )}
          </Campo>

          <FuncionesInput
            id={idCampo('funciones')}
            className="cargo-formulario__ancho"
            funciones={valores.funciones}
            onChange={(funciones) => actualizarCampo('funciones', funciones)}
            error={errores.funciones}
          />
        </div>
      </form>
    </Modal>
  );
}
