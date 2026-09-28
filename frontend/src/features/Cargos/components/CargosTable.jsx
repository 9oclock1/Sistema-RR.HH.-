import { Briefcase, Pencil } from 'lucide-react';
import { Boton, Contador, EstadoVacio, Etiqueta, Tabla, TextoTruncado } from '../../../components/ui';
import { formatearFechaHora, formatearMonto } from '../utils/formato';
import { TONO_NIVEL } from '../utils/nivelesSalariales';

const FUNCIONES_VISIBLES = 2;

const SinDato = ({ children = '—' }) => <span className="cargos-sin-dato">{children}</span>;

function ResumenFunciones({ funciones }) {
  if (funciones.length === 0) return <SinDato />;

  const visibles = funciones.slice(0, FUNCIONES_VISIBLES);
  const ocultas = funciones.slice(FUNCIONES_VISIBLES);

  return (
    <ul className="cargos-funciones-resumen">
      {visibles.map((funcion, i) => (
        <li key={i}>
          <Etiqueta>{funcion}</Etiqueta>
        </li>
      ))}
      {ocultas.length > 0 && (
        <li>
          <Contador title={ocultas.join('\n')} aria-label={`${ocultas.length} funciones más`}>
            +{ocultas.length}
          </Contador>
        </li>
      )}
    </ul>
  );
}

const columnas = (onEditar) => [
  {
    clave: 'nombre',
    titulo: 'Cargo',
    celda: (cargo) => (
      <div className="cargos-nombre">
        <TextoTruncado>{cargo.nombre}</TextoTruncado>
        <TextoTruncado className="cargos-codigo">{cargo.codigo}</TextoTruncado>
      </div>
    ),
  },
  { clave: 'departamento', titulo: 'Área', ancho: '140px' },
  {
    clave: 'nivel_salarial',
    titulo: 'Nivel salarial',
    ancho: '170px',
    celda: (cargo) => <Etiqueta tono={TONO_NIVEL[cargo.nivel_salarial] ?? 'neutral'}>{cargo.nivel_salarial}</Etiqueta>,
  },
  {
    clave: 'salario_base_referencial',
    titulo: 'Salario base',
    ancho: '120px',
    alinear: 'fin',
    celda: (cargo) => formatearMonto(cargo.salario_base_referencial) ?? <SinDato />,
  },
  {
    clave: 'funciones',
    titulo: 'Funciones',
    ancho: '180px',
    celda: (cargo) => <ResumenFunciones funciones={cargo.funciones} />,
  },
  {
    clave: 'requisitos_minimos',
    titulo: 'Requisitos mínimos',
    celda: (cargo) => {
      const requisitos = cargo.requisitos_minimos?.trim();
      return requisitos ? (
        <p className="cargos-requisitos" title={requisitos}>
          {requisitos}
        </p>
      ) : (
        <SinDato>No especificado</SinDato>
      );
    },
  },
  {
    clave: 'fecha_modificacion',
    titulo: <span title="Último cambio de nivel salarial o de salario">Modificado</span>,
    // La fecha más larga es «28 sept de 2026, 14:30»: 200px la muestra en una línea sin cortar.
    ancho: '200px',
    celda: (cargo) => <TextoTruncado>{formatearFechaHora(cargo.fecha_modificacion) ?? '—'}</TextoTruncado>,
  },
  {
    clave: 'acciones',
    titulo: <span className="ds-solo-lector">Acciones</span>,
    // Ancho en Cargos.css: 48px (botón de 32 + relleno de 8 por lado) y 60px en pantallas táctiles.
    alinear: 'fin',
    celda: (cargo) => (
      <div className="cargos-acciones">
        <Boton
          variante="sutil"
          soloIcono
          icono={Pencil}
          aria-label={`Editar ${cargo.nombre}`}
          title="Editar"
          onClick={() => onEditar(cargo)}
        />
      </div>
    ),
  },
];

export default function CargosTable({ cargos, cargando, hayFiltro, accionVacia, onQuitarFiltro, onEditar }) {
  return (
    <Tabla
      className="cargos-tabla"
      descripcion="Cargos activos"
      columnas={columnas(onEditar)}
      filas={cargos}
      claveFila="id_cargo"
      cargando={cargando}
      filasCargando={4}
      vacio={
        hayFiltro ? (
          <EstadoVacio
            icono={Briefcase}
            titulo="No hay cargos en esta área"
            mensaje="Elija otra área o quite el filtro para ver todo el catálogo."
            accion={<Boton onClick={onQuitarFiltro}>Ver todas las áreas</Boton>}
          />
        ) : (
          <EstadoVacio
            icono={Briefcase}
            titulo="Aún no hay cargos"
            mensaje="Registre el primer cargo para definir su perfil y su nivel salarial."
            accion={accionVacia}
          />
        )
      }
    />
  );
}
