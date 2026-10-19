import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { UserSearch } from 'lucide-react';
import {
  Alerta,
  Avatar,
  Boton,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  Pestanas,
  Selector,
  Tarjeta,
  TextoTruncado,
} from '../../components/ui';
import { useRol } from '../../context/sesion';
import { useEmpleados } from '../Asignaciones/hooks/useEmpleados';
import DatosPersonales from './components/DatosPersonales';
import KardexResumen from './components/KardexResumen';
import LineaTiempoContratos from './components/LineaTiempoContratos';
import LineaTiempoTrayectoria from './components/LineaTiempoTrayectoria';
import TablaCapacitaciones from './components/TablaCapacitaciones';
import TablaMemorandums from './components/TablaMemorandums';
import { useKardex } from './hooks/useKardex';
import { RUTA_KARDEX } from './ruta';
import { documentoIdentidad } from './utils/formato';
import './Kardex.css';

function Cargando() {
  return (
    <div className="kardex-cuerpo" aria-hidden="true">
      <div className="kardex-identidad">
        <Esqueleto forma="circulo" ancho="var(--size-avatar-lg)" alto="var(--size-avatar-lg)" />
        <Esqueleto ancho="30%" />
      </div>
      <div className="kardex-resumen">
        {[0, 1, 2, 3].map((i) => (
          <Esqueleto key={i} forma="bloque" alto="calc(var(--size-row) * 3)" />
        ))}
      </div>
      <Tarjeta>
        <div className="kardex-cargando">
          <Esqueleto ancho="60%" />
          {[0, 1, 2, 3].map((i) => (
            <Esqueleto key={i} forma="bloque" />
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}

function Expediente({ kardex }) {
  const [pestana, setPestana] = useState('datos');
  const { datos_personales: datos, contratos, memorandums, capacitaciones, trayectoria } = kardex;
  const nombre = datos.nombre_completo;

  const pestanas = [
    { id: 'datos', etiqueta: 'Datos personales', contenido: <DatosPersonales datos={datos} /> },
    {
      id: 'contratos',
      etiqueta: 'Contratos',
      contador: contratos.length,
      contenido: <LineaTiempoContratos idEmpleado={kardex.id_empleado} nombre={nombre} />,
    },
    {
      id: 'memorandums',
      etiqueta: 'Memorándums',
      contador: memorandums.length,
      contenido: <TablaMemorandums memorandums={memorandums} nombre={nombre} />,
    },
    {
      id: 'capacitaciones',
      etiqueta: 'Capacitaciones',
      contador: capacitaciones.length,
      contenido: (
        <TablaCapacitaciones capacitaciones={capacitaciones} nombre={nombre} idEmpleado={kardex.id_empleado} />
      ),
    },
    {
      id: 'trayectoria',
      etiqueta: 'Trayectoria',
      contador: trayectoria.length,
      contenido: <LineaTiempoTrayectoria trayectoria={trayectoria} nombre={nombre} />,
    },
  ];

  return (
    <div className="kardex-cuerpo">
      <div className="kardex-identidad">
        <Avatar nombre={nombre} tamano="lg" decorativo />
        <div className="kardex-identidad__texto">
          <TextoTruncado as="h2" className="kardex-identidad__nombre">
            {nombre}
          </TextoTruncado>
          <p className="kardex-nota">
            CI <span className="kardex-codigo">{documentoIdentidad(datos)}</span>
          </p>
        </div>
        <Etiqueta tono={datos.estado.codigo === 'ACTIVO' ? 'exito' : 'neutral'}>{datos.estado.nombre}</Etiqueta>
      </div>

      <KardexResumen resumen={kardex.resumen} fechaIngreso={datos.fecha_ingreso} />

      <Tarjeta>
        <Pestanas etiqueta="Secciones del Kardex" pestanas={pestanas} activa={pestana} onCambiar={setPestana} />
      </Tarjeta>
    </div>
  );
}

export default function KardexView() {
  const { idEmpleado = '' } = useParams();
  const navegar = useNavigate();
  const rol = useRol();
  const empleados = useEmpleados();
  const { kardex, cargando, error, recargar } = useKardex(idEmpleado, rol);

  const selector = (
    <Selector
      className="kardex-selector"
      aria-label="Empleado"
      value={idEmpleado}
      onChange={(e) => navegar(e.target.value ? `${RUTA_KARDEX}/${e.target.value}` : RUTA_KARDEX)}
      disabled={empleados.cargando || Boolean(empleados.error)}
      title={empleados.error ? 'No se pudieron cargar los empleados' : undefined}
      textoVacio={empleados.cargando ? 'Cargando…' : 'Selecciona un empleado'}
      opciones={empleados.empleados.map((e) => ({
        valor: e.id_empleado,
        etiqueta: `${e.nombre_completo} · CI ${e.numero_documento}`,
      }))}
    />
  );

  let contenido;
  if (!idEmpleado) {
    contenido = (
      <Tarjeta>
        <EstadoVacio
          icono={UserSearch}
          titulo="Ningún empleado seleccionado"
          mensaje="Elige un empleado en el selector para consultar su expediente laboral."
        />
      </Tarjeta>
    );
  } else if (cargando) {
    contenido = <Cargando />;
  } else if (error) {
    contenido = (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudo cargar el Kardex"
        acciones={
          <Boton tamano="sm" onClick={recargar}>
            Reintentar
          </Boton>
        }
      >
        {error.message}
      </Alerta>
    );
  } else {
    contenido = <Expediente key={kardex.id_empleado} kardex={kardex} />;
  }

  return (
    <section className="kardex" aria-labelledby="kardex-titulo" aria-busy={cargando}>
      <EncabezadoPagina
        migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Expediente' }]}
        enlace={Link}
        titulo="Kardex laboral"
        idTitulo="kardex-titulo"
        descripcion="Ficha consolidada del colaborador: datos personales, contratos, memorándums, capacitaciones y trayectoria."
        acciones={selector}
      />
      {contenido}
    </section>
  );
}
