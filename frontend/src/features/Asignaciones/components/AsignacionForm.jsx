import { useId, useState } from 'react';
import { Alerta, Boton, CampoTexto, Selector, Tarjeta } from '../../../components/ui';
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
  onAsignar,
}) {
  const uid = useId();
  const idCampo = (campo) => `${uid}-${campo}`;

  const [valores, setValores] = useState({ id_cargo: '', id_sucursal: '', fecha_inicio: hoyLocal() });
  // Errores por campo: los de la validación local y los que devuelve el backend (400).
  const [errores, setErrores] = useState({});
  const [rechazo, setRechazo] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const enfocar = (campo) => document.getElementById(idCampo(campo))?.focus();

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
    setRechazo(null);

    const erroresCliente = validar(valores);
    setErrores(erroresCliente);
    const primero = CAMPOS.find((c) => erroresCliente[c]);
    if (primero) return enfocar(primero);

    setGuardando(true);
    try {
      await onAsignar({ id_empleado: empleado.id_empleado, ...valores });
    } catch (error) {
      const { porCampo, generales } = mapearErroresApi(error.errores ?? [], CAMPOS);
      const rechazados = CAMPOS.filter((c) => porCampo[c]);
      // Si el backend señala campos, su mensaje va debajo de cada uno; la alerta resume el resto.
      setRechazo(rechazados.length > 0 ? generales.join(' ') : error.message);
      setErrores(porCampo);
      if (rechazados.length > 0) enfocar(rechazados[0]);
      setGuardando(false);
    }
  };

  const cargoElegido = cargos.find((c) => c.id_cargo === valores.id_cargo);
  const cargoFaltante = valores.id_cargo && !cargoElegido;
  const actual = empleado?.asignacion_actual;
  const fechaMinima = [empleado?.fecha_ingreso, actual?.vigente_desde].filter(Boolean).sort().at(-1);

  const opcionesCargo = cargos.map((c) => ({ valor: c.id_cargo, etiqueta: c.nombre }));
  if (cargoFaltante) opcionesCargo.push({ valor: valores.id_cargo, etiqueta: 'Cargo seleccionado (no disponible)' });

  const opcionesSucursal = sucursales.map((s) => ({ valor: s.id_sucursal, etiqueta: `${s.nombre} · ${s.ciudad}` }));

  return (
    <Tarjeta titulo="Nueva asignación" className="asig-tarjeta">
      <form className="asig-form" onSubmit={manejarSubmit} noValidate aria-label="Nueva asignación">
        <p className="asig-nota">
          {empleado ? `Para ${empleado.nombre_completo}` : 'Selecciona un empleado para asignarle cargo y sucursal.'}
        </p>

        {rechazo !== null && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo registrar la asignación">
            {rechazo || null}
          </Alerta>
        )}

        {actual?.cargo?.nombre && (
          <div className="asig-actual">
            <span className="asig-actual__etiqueta">Asignación actual</span>
            <span>
              {actual.cargo.nombre} · {actual.sucursal.nombre}
            </span>
          </div>
        )}

        {/* Sin empleado elegido, el fieldset deshabilita todos los controles de una vez. */}
        <fieldset className="asig-fieldset" disabled={!empleado || guardando}>
          <Selector
            id={idCampo('id_cargo')}
            etiqueta="Cargo"
            requerido
            value={valores.id_cargo}
            disabled={cargandoCargos}
            onChange={(e) => actualizarCampo('id_cargo', e.target.value)}
            textoVacio={cargandoCargos ? 'Cargando…' : 'Selecciona un cargo'}
            opciones={opcionesCargo}
            error={errores.id_cargo}
            ayuda={!errores.id_cargo && errorCargos ? 'No se pudieron cargar los cargos.' : undefined}
          />

          {/* El área no se elige aparte: es la del cargo, así nunca se contradicen. */}
          <CampoTexto
            id={idCampo('area')}
            etiqueta="Área"
            value={cargoElegido?.departamento ?? ''}
            placeholder="Se completa con el cargo"
            readOnly
            tabIndex={-1}
          />

          <Selector
            id={idCampo('id_sucursal')}
            etiqueta="Sucursal"
            requerido
            value={valores.id_sucursal}
            disabled={cargandoSucursales}
            onChange={(e) => actualizarCampo('id_sucursal', e.target.value)}
            textoVacio={cargandoSucursales ? 'Cargando…' : 'Selecciona una sucursal'}
            opciones={opcionesSucursal}
            error={errores.id_sucursal}
            ayuda={!errores.id_sucursal && errorSucursales ? 'No se pudieron cargar las sucursales.' : undefined}
          />

          <CampoTexto
            id={idCampo('fecha_inicio')}
            type="date"
            etiqueta="Vigente desde"
            requerido
            value={valores.fecha_inicio}
            min={fechaMinima}
            max={hoyLocal()}
            onChange={(e) => actualizarCampo('fecha_inicio', e.target.value)}
            error={errores.fecha_inicio}
            ayuda={
              errores.fecha_inicio
                ? undefined
                : actual?.vigente_desde
                  ? `La asignación actual se cerrará en esta fecha (rige desde ${formatearFecha(actual.vigente_desde)}).`
                  : 'Si ya tiene una asignación, se cerrará en esta fecha.'
            }
          />
        </fieldset>

        <div className="asig-form__pie">
          <Boton type="submit" variante="primario" cargando={guardando} disabled={!empleado}>
            {guardando ? 'Asignando…' : 'Asignar'}
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
