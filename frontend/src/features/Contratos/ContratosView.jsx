import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { FileText, IdCard, UserSearch } from 'lucide-react';
import { createModificacionContrato } from '../../api/contratosApi';
import { Alerta, Boton, EncabezadoPagina, Esqueleto, EstadoVacio, Selector, Tarjeta } from '../../components/ui';
import { useRol, useUsuario } from '../../context/sesion';
import { useEmpleados } from '../Asignaciones/hooks/useEmpleados';
import { RUTA_KARDEX } from '../Kardex/ruta';
import { formatearFecha } from '../Vacantes/utils/formato';
import ModificacionContratoForm from './components/ModificacionContratoForm';
import ResumenVersionActual from './components/ResumenVersionActual';
import { useCatalogosContrato, useHistorialContratos } from './hooks/useContratos';
import { TIPOS_MODIFICACION } from './utils/opciones';
import { versionActual } from './utils/versiones';
import './Contratos.css';

function Cargando() {
  return (
    <div className="contratos-cargando" aria-hidden="true">
      <Esqueleto ancho="40%" />
      {[0, 1, 2].map((i) => (
        <Esqueleto key={i} forma="bloque" />
      ))}
    </div>
  );
}

export default function ContratosView() {
  const rol = useRol();
  const usuario = useUsuario();
  const [parametros, setParametros] = useSearchParams();
  const idEmpleado = parametros.get('empleado') ?? '';
  const empleados = useEmpleados();
  const catalogos = useCatalogosContrato(rol);
  const { historial, cargando, error, recargar } = useHistorialContratos(idEmpleado, rol);
  const [registrada, setRegistrada] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const refResultado = useRef(null);

  const actual = versionActual(historial);
  const empleado = empleados.empleados.find((e) => e.id_empleado === idEmpleado);
  const autor = empleados.empleados.find((e) => e.id_empleado === usuario)?.nombre_completo ?? null;

  useEffect(() => {
    if (registrada) refResultado.current?.focus();
  }, [registrada]);

  const cambiarEmpleado = (id) => {
    setRegistrada(null);
    setParametros(id ? { empleado: id } : {}, { replace: true });
  };

  const registrar = async (datos) => {
    const version = await createModificacionContrato(datos, { rol, usuario });
    setRegistrada({ ...version, empleado: empleado?.nombre_completo ?? 'el colaborador' });
    setFormKey((k) => k + 1);
    recargar();
  };

  let formulario;
  if (!idEmpleado) {
    formulario = (
      <EstadoVacio
        icono={UserSearch}
        titulo="Ningún colaborador seleccionado"
        mensaje="Elige al colaborador cuyo contrato se renueva o modifica."
      />
    );
  } else if (cargando || catalogos.cargando) {
    formulario = <Cargando />;
  } else if (error || catalogos.error) {
    formulario = (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudo cargar el contrato del colaborador"
        acciones={
          <Boton
            tamano="sm"
            onClick={() => {
              recargar();
              catalogos.recargar();
            }}
          >
            Reintentar
          </Boton>
        }
      >
        {(error ?? catalogos.error).message}
      </Alerta>
    );
  } else if (!actual) {
    formulario = (
      <EstadoVacio
        icono={FileText}
        titulo="Sin contrato registrado"
        mensaje="Para registrar renovaciones o adendas, el colaborador debe tener primero su contrato inicial."
      />
    );
  } else {
    formulario = (
      <ModificacionContratoForm
        key={`${idEmpleado}#${formKey}`}
        idEmpleado={idEmpleado}
        actual={actual}
        autor={autor}
        catalogos={catalogos}
        onRegistrar={registrar}
      />
    );
  }

  return (
    <section className="contratos" aria-labelledby="contratos-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Expediente' }]}
        enlace={Link}
        titulo="Modificaciones contractuales"
        idTitulo="contratos-titulo"
        descripcion="Formaliza renovaciones, cambios de jornada y ajustes de condiciones con su documento firmado. Cada registro crea una nueva versión sin alterar las anteriores."
      />

      <div className="contratos-contenido">
        {registrada && (
          <div className="contratos-resultado" ref={refResultado} tabIndex={-1}>
            <Alerta
              tono="exito"
              role="status"
              titulo={`Modificación contractual registrada para ${registrada.empleado}`}
              acciones={
                <Boton as={Link} to={`${RUTA_KARDEX}/${registrada.id_empleado}`} tamano="sm" icono={IdCard}>
                  Ver en el Kardex
                </Boton>
              }
            >
              {`${TIPOS_MODIFICACION[registrada.tipo_modificacion]} ${registrada.numero_contrato}: rige desde el ${formatearFecha(registrada.fecha_vigencia)} y es la versión ${registrada.numero_version} del historial contractual.`}
            </Alerta>
          </div>
        )}

        <Tarjeta titulo="Colaborador">
          <div className="contratos-seccion">
            <Selector
              etiqueta="Colaborador"
              requerido
              value={idEmpleado}
              onChange={(e) => cambiarEmpleado(e.target.value)}
              disabled={empleados.cargando || Boolean(empleados.error)}
              textoVacio={empleados.cargando ? 'Cargando…' : 'Selecciona un colaborador'}
              opciones={empleados.empleados.map((e) => ({
                valor: e.id_empleado,
                etiqueta: `${e.nombre_completo} · CI ${e.numero_documento}`,
              }))}
              error={empleados.error ? 'No se pudieron cargar los colaboradores.' : undefined}
            />
            {actual && !cargando && <ResumenVersionActual version={actual} />}
          </div>
        </Tarjeta>

        {!autor && !empleados.cargando && (
          <Alerta tono="aviso" titulo="Elige tu usuario de prueba para registrar">
            Selecciona quién eres en «Usuario de prueba», al pie de la barra lateral. Quedará como autor de cada versión
            del contrato.
          </Alerta>
        )}

        <Tarjeta titulo="Nueva modificación contractual">{formulario}</Tarjeta>
      </div>
    </section>
  );
}
