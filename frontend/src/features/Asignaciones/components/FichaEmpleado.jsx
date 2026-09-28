import { useId } from 'react';
import { History, UserSearch } from 'lucide-react';
import { Alerta, Avatar, Boton, Esqueleto, EstadoVacio, Etiqueta, Tabla, Tarjeta, TextoTruncado } from '../../../components/ui';
import { formatearFecha } from '../../Vacantes/utils/formato';

const documento = (ficha) =>
  ficha.complemento_documento ? `${ficha.numero_documento}-${ficha.complemento_documento}` : ficha.numero_documento;

const SIN_DATO = <span className="asig-sin-dato">—</span>;

function Dato({ etiqueta, children }) {
  return (
    <div className="asig-dato">
      <dt>{etiqueta}</dt>
      <dd>{children || SIN_DATO}</dd>
    </div>
  );
}

function Mosaico({ etiqueta, valor, children }) {
  return (
    <div className="asig-mosaico">
      <span className="asig-mosaico__etiqueta">{etiqueta}</span>
      <TextoTruncado className="asig-mosaico__valor">{valor || SIN_DATO}</TextoTruncado>
      {children}
    </div>
  );
}

function Cargando() {
  return (
    <div className="asig-cargando" aria-hidden="true">
      <div className="asig-identidad">
        <Esqueleto forma="circulo" ancho="var(--size-avatar-lg)" alto="var(--size-avatar-lg)" />
        <Esqueleto ancho="40%" />
      </div>
      <div className="asig-mosaicos">
        {[0, 1, 2].map((i) => (
          <Esqueleto key={i} forma="bloque" alto="calc(var(--size-row) * 2)" />
        ))}
      </div>
      <Esqueleto />
    </div>
  );
}

const COLUMNAS_HISTORIAL = [
  {
    clave: 'cargo',
    titulo: 'Cargo',
    celda: (a) => (
      <div className="asig-celda">
        <TextoTruncado>{a.cargo}</TextoTruncado>
        <TextoTruncado className="asig-celda__sub">{a.area}</TextoTruncado>
      </div>
    ),
  },
  { clave: 'sucursal', titulo: 'Sucursal' },
  { clave: 'fecha_inicio', titulo: 'Desde', ancho: '25%', celda: (a) => formatearFecha(a.fecha_inicio) },
  {
    clave: 'fecha_fin',
    titulo: 'Hasta',
    ancho: '25%',
    celda: (a) => (a.es_vigente ? <Etiqueta tono="exito">Vigente</Etiqueta> : formatearFecha(a.fecha_fin)),
  },
];

export default function FichaEmpleado({ ficha, cargando, error, onReintentar, selector }) {
  const uid = useId();
  const actual = ficha?.asignacion_actual;

  let contenido;
  if (cargando) {
    contenido = <Cargando />;
  } else if (error) {
    contenido = (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudo cargar la ficha"
        acciones={
          <Boton tamano="sm" onClick={onReintentar}>
            Reintentar
          </Boton>
        }
      >
        {error.message}
      </Alerta>
    );
  } else if (!ficha) {
    contenido = (
      <EstadoVacio
        icono={UserSearch}
        titulo="Ningún empleado seleccionado"
        mensaje="Elige un empleado para ver su cargo, área y sucursal vigentes."
      />
    );
  } else {
    contenido = (
      <>
        <div className="asig-identidad">
          <Avatar nombre={ficha.nombre_completo} tamano="lg" decorativo />
          <div className="asig-identidad__texto">
            <TextoTruncado as="p" className="asig-identidad__nombre">
              {ficha.nombre_completo}
            </TextoTruncado>
            <p className="asig-nota">
              CI <span className="asig-codigo">{documento(ficha)}</span>
            </p>
          </div>
          <Etiqueta tono={ficha.estado.codigo === 'ACTIVO' ? 'exito' : 'neutral'}>{ficha.estado.nombre}</Etiqueta>
        </div>

        <section className="asig-bloque" aria-labelledby={`${uid}-vigente`}>
          <h4 id={`${uid}-vigente`} className="asig-bloque__titulo">
            Asignación vigente
            {actual.vigente_desde && <span className="asig-nota">desde {formatearFecha(actual.vigente_desde)}</span>}
          </h4>
          <div className="asig-mosaicos">
            <Mosaico etiqueta="Cargo" valor={actual.cargo.nombre}>
              {actual.cargo.nombre &&
                (actual.cargo.esta_activo ? (
                  <span className="asig-codigo">{actual.cargo.codigo}</span>
                ) : (
                  <Etiqueta tono="peligro">Cargo dado de baja</Etiqueta>
                ))}
            </Mosaico>
            <Mosaico etiqueta="Área" valor={actual.area.nombre} />
            <Mosaico etiqueta="Sucursal" valor={actual.sucursal.nombre}>
              {actual.sucursal.ciudad && <span className="asig-nota">{actual.sucursal.ciudad}</span>}
            </Mosaico>
          </div>
        </section>

        <section className="asig-bloque" aria-labelledby={`${uid}-personales`}>
          <h4 id={`${uid}-personales`} className="asig-bloque__titulo">
            Datos personales
          </h4>
          <dl className="asig-datos">
            <Dato etiqueta="Ingreso">{formatearFecha(ficha.fecha_ingreso)}</Dato>
            <Dato etiqueta="Nacimiento">{formatearFecha(ficha.fecha_nacimiento)}</Dato>
            <Dato etiqueta="Género">{ficha.genero}</Dato>
            <Dato etiqueta="Celular">{ficha.telefono_celular}</Dato>
            <Dato etiqueta="Correo">{ficha.correo_personal}</Dato>
            <Dato etiqueta="Dirección">{ficha.direccion_domicilio}</Dato>
          </dl>
        </section>

        <section className="asig-bloque" aria-labelledby={`${uid}-historial`}>
          <h4 id={`${uid}-historial`} className="asig-bloque__titulo">
            Historial de asignaciones
          </h4>
          <Tabla
            className="asig-historial"
            descripcion={`Historial de asignaciones de ${ficha.nombre_completo}`}
            columnas={COLUMNAS_HISTORIAL}
            filas={ficha.historial}
            claveFila="id_asignacion"
            vacio={<EstadoVacio icono={History} titulo="Sin historial" mensaje="Aún no hay asignaciones registradas." />}
          />
        </section>
      </>
    );
  }

  return (
    <Tarjeta titulo="Ficha del empleado" acciones={selector} className="asig-tarjeta" aria-busy={cargando}>
      <div className="asig-ficha">{contenido}</div>
    </Tarjeta>
  );
}
