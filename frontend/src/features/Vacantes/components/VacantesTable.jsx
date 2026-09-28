import { Lock, Megaphone, Pencil, Send } from 'lucide-react';
import { Boton, Contador, EstadoVacio, Etiqueta, Selector, Tabla, Tarjeta, TextoTruncado } from '../../../components/ui';
import { formatearAnios, formatearFecha } from '../utils/formato';
import { ETIQUETAS_CAMPO } from '../utils/vacanteFormulario';

const ESTADOS = {
  borrador: { etiqueta: 'Borrador', tono: 'neutral' },
  publicada: { etiqueta: 'Publicada', tono: 'exito' },
  cerrada: { etiqueta: 'Cerrada', tono: 'morado' },
};

const FILTROS = [
  { valor: '', etiqueta: 'Todos los estados' },
  { valor: 'borrador', etiqueta: 'Borradores' },
  { valor: 'publicada', etiqueta: 'Publicadas' },
  { valor: 'cerrada', etiqueta: 'Cerradas' },
];

const MENSAJES_VACIO = {
  '': 'Todavía no hay vacantes registradas.',
  borrador: 'No hay borradores.',
  publicada: 'No hay vacantes publicadas.',
  cerrada: 'No hay vacantes cerradas.',
};

const nombresPendientes = (campos) => campos.map((c) => ETIQUETAS_CAMPO[c] ?? c).join(', ');

function Estado({ vacante }) {
  const { etiqueta, tono } = ESTADOS[vacante.estado];
  const pendientes = vacante.campos_pendientes;

  let detalle = null;
  if (vacante.estado === 'borrador') {
    detalle =
      pendientes.length > 0 ? (
        <TextoTruncado className="vacantes-meta vacantes-meta--aviso">Falta: {nombresPendientes(pendientes)}</TextoTruncado>
      ) : (
        <TextoTruncado className="vacantes-meta vacantes-meta--exito">Listo para publicar</TextoTruncado>
      );
  } else if (vacante.estado === 'cerrada' && vacante.esta_activa) {
    detalle = <TextoTruncado className="vacantes-meta">Venció el plazo</TextoTruncado>;
  }

  return (
    <div className="vacantes-celda">
      <Etiqueta tono={tono}>{etiqueta}</Etiqueta>
      {detalle}
    </div>
  );
}

function Plazo({ vacante }) {
  const limite = formatearFecha(vacante.fecha_limite_postulacion);

  if (vacante.estado === 'borrador') {
    return limite ? (
      <TextoTruncado className="vacantes-fecha">Hasta {limite}</TextoTruncado>
    ) : (
      <TextoTruncado className="vacantes-meta">Sin fecha límite</TextoTruncado>
    );
  }
  return (
    <div className="vacantes-celda">
      <TextoTruncado className="vacantes-fecha">Hasta {limite}</TextoTruncado>
      <TextoTruncado className="vacantes-meta">Publicada {formatearFecha(vacante.fecha_publicacion)}</TextoTruncado>
    </div>
  );
}

function AccionesFila({ vacante, enProceso, onEditar, onPublicar, onCerrar }) {
  if (vacante.estado === 'borrador') {
    const pendientes = vacante.campos_pendientes;
    return (
      <div className="vacantes-acciones">
        <Boton
          variante="sutil"
          soloIcono
          icono={Pencil}
          aria-label={`Editar ${vacante.titulo_puesto}`}
          title="Editar"
          disabled={enProceso}
          onClick={() => onEditar(vacante)}
        />
        <Boton
          variante="primario"
          tamano="sm"
          icono={Send}
          cargando={enProceso}
          disabled={pendientes.length > 0}
          title={pendientes.length > 0 ? `Completa: ${nombresPendientes(pendientes)}` : 'Publicar y abrir postulaciones'}
          onClick={() => onPublicar(vacante)}
        >
          Publicar
        </Boton>
      </div>
    );
  }

  if (vacante.estado === 'publicada') {
    return (
      <div className="vacantes-acciones">
        <Boton
          tamano="sm"
          icono={Lock}
          cargando={enProceso}
          title="Dejar de aceptar postulaciones"
          onClick={() => onCerrar(vacante)}
        >
          Cerrar
        </Boton>
      </div>
    );
  }

  return (
    <div className="vacantes-acciones">
      <span className="vacantes-meta" aria-hidden="true">
        —
      </span>
    </div>
  );
}

// Vacante ocupa un porcentaje chico para que Estado quede cerca en cualquier monitor; Estado, Plazo y Acciones
// tienen ancho fijo, y Requisitos es la única columna que absorbe el espacio libre.
const columnas = ({ nombreNivel, idEnProceso, onEditar, onPublicar, onCerrar }) => [
  {
    clave: 'vacante',
    titulo: 'Vacante',
    ancho: '20%',
    celda: (vacante) => {
      const cantidad = vacante.cantidad_vacantes;
      return (
        <div className="vacantes-celda">
          <TextoTruncado>{vacante.titulo_puesto}</TextoTruncado>
          <TextoTruncado className="vacantes-meta">
            <span className="vacantes-codigo">{vacante.codigo_convocatoria}</span> · {cantidad}{' '}
            {cantidad === 1 ? 'vacante' : 'vacantes'}
          </TextoTruncado>
        </div>
      );
    },
  },
  {
    clave: 'estado',
    titulo: 'Estado',
    ancho: '240px',
    celda: (vacante) => <Estado vacante={vacante} />,
  },
  {
    clave: 'requisitos',
    titulo: 'Requisitos',
    celda: (vacante) => {
      const habilidades = vacante.habilidades_clave_requeridas;
      return (
        <div className="vacantes-celda">
          <TextoTruncado>
            {vacante.nivel_educacion_min ? nombreNivel(vacante.nivel_educacion_min) : 'Sin formación'}
            {' · '}
            {formatearAnios(vacante.year_experiencia_min)}
          </TextoTruncado>
          <TextoTruncado className="vacantes-meta">
            {habilidades.length > 0 ? habilidades.join(', ') : 'Sin habilidades'}
          </TextoTruncado>
        </div>
      );
    },
  },
  {
    clave: 'plazo',
    titulo: 'Plazo',
    ancho: '170px',
    celda: (vacante) => <Plazo vacante={vacante} />,
  },
  {
    clave: 'acciones',
    titulo: <span className="ds-solo-lector">Acciones</span>,
    ancho: '140px',
    alinear: 'fin',
    celda: (vacante) => (
      <AccionesFila
        vacante={vacante}
        enProceso={vacante.id_convocatoria === idEnProceso}
        onEditar={onEditar}
        onPublicar={onPublicar}
        onCerrar={onCerrar}
      />
    ),
  },
];

export default function VacantesTable({
  vacantes,
  cargando,
  estado,
  onCambiarEstado,
  niveles,
  idEnProceso,
  accionVacia,
  onEditar,
  onPublicar,
  onCerrar,
}) {
  const nombreNivel = (codigo) => niveles.find((n) => n.codigo === codigo)?.nombre ?? codigo;

  return (
    <Tarjeta
      className="vacantes-tarjeta"
      titulo={
        <>
          Convocatorias{' '}
          {!cargando && <Contador aria-label={`${vacantes.length} en la lista`}>{vacantes.length}</Contador>}
        </>
      }
      acciones={
        <Selector
          className="vacantes-filtro"
          aria-label="Filtrar por estado"
          value={estado}
          opciones={FILTROS}
          onChange={(e) => onCambiarEstado(e.target.value)}
        />
      }
    >
      <Tabla
        className="vacantes-tabla"
        descripcion="Vacantes registradas"
        columnas={columnas({ nombreNivel, idEnProceso, onEditar, onPublicar, onCerrar })}
        filas={vacantes}
        claveFila="id_convocatoria"
        cargando={cargando}
        filasCargando={3}
        vacio={
          <EstadoVacio
            icono={Megaphone}
            titulo={MENSAJES_VACIO[estado]}
            mensaje={estado ? 'Prueba con otro estado.' : 'Crea la primera convocatoria a partir de un cargo del catálogo.'}
            accion={!estado && accionVacia}
          />
        }
      />
    </Tarjeta>
  );
}
