import { useCallback, useEffect, useState } from 'react';
import { Download, Gift } from 'lucide-react';
import { exportarHistorialBonos, listarHistorialBonos } from '../../../api/bonificaciones';
import { Alerta, Boton, CampoTexto, Etiqueta, EstadoVacio, Selector, Tabla, useAvisos } from '../../../components/ui';
import { useRol, useUsuario } from '../../../context/sesion';
import { TIPOS_CONDICION, describirValor } from '../../condiciones/formato';
import { guardarComo } from '../utils/descarga';
import { Celda } from './comunes';

const fechaCorta = (fecha) => fecha.slice(5).split('-').reverse().join('/');

const detalle = (bono) => {
  if (bono.origen === 'DETECCION') {
    const jornadas = bono.cantidad === 1 ? '1 jornada' : `${bono.cantidad} jornadas`;
    return `${jornadas}: ${(bono.fechas ?? []).map(fechaCorta).join(', ')}`;
  }
  return bono.cantidad === 1 ? '1 día asignado' : `${bono.cantidad} días asignados`;
};

const COLUMNAS = [
  { clave: 'periodo', titulo: 'Periodo', ancho: '12%', celda: (b) => b.periodo },
  {
    clave: 'condicion',
    titulo: 'Bono (regla)',
    ancho: '26%',
    celda: (b) => (
      <Celda
        principal={
          <Etiqueta tono={TIPOS_CONDICION[b.condicion.tipo_condicion]?.tono}>
            {TIPOS_CONDICION[b.condicion.tipo_condicion]?.etiqueta ?? b.condicion.tipo_condicion}
          </Etiqueta>
        }
        secundario={`${b.condicion.codigo} · ${b.condicion.nombre}`}
      />
    ),
  },
  { clave: 'detalle', titulo: 'Detalle', ancho: '28%', celda: (b) => detalle(b) },
  {
    clave: 'valor',
    titulo: 'Valor',
    ancho: '16%',
    celda: (b) => describirValor(b.valor, b.monto === null ? 'PORCENTAJE' : 'MONTO_FIJO', b.condicion.tipo_condicion),
  },
  {
    clave: 'monto',
    titulo: 'Monto',
    ancho: '14%',
    alinear: 'fin',
    celda: (b) => (b.monto === null ? <span className="kardex-nota">En la planilla</span> : `Bs ${Number(b.monto).toFixed(2)}`),
  },
];

export default function TablaBonificaciones({ idEmpleado, nombre }) {
  const rol = useRol();
  const idUsuario = useUsuario();
  const avisar = useAvisos();
  const [periodo, setPeriodo] = useState('');
  const [tipo, setTipo] = useState('');
  const [bonos, setBonos] = useState(null);
  const [error, setError] = useState(null);
  const [intento, setIntento] = useState(0);
  const [exportando, setExportando] = useState(false);
  const identidad = { idEmpleado: idUsuario, rol };

  useEffect(() => {
    let vigente = true;
    setBonos(null);
    setError(null);
    const filtros = { ...(periodo && { periodo }), ...(tipo && { tipo }) };
    listarHistorialBonos(idEmpleado, filtros, identidad)
      .then((lista) => vigente && setBonos(lista))
      .catch((e) => vigente && setError(e));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idEmpleado, periodo, tipo, intento]);

  const exportar = async () => {
    setExportando(true);
    try {
      const filtros = { ...(periodo && { periodo }), ...(tipo && { tipo }) };
      const archivo = await exportarHistorialBonos(idEmpleado, filtros, identidad);
      guardarComo(archivo, `bonificaciones-${nombre.replace(/\s+/g, '-').toLowerCase()}.csv`);
    } catch (e) {
      avisar({ tono: 'peligro', titulo: 'No se pudo exportar el historial', mensaje: e.message });
    } finally {
      setExportando(false);
    }
  };

  const cargando = bonos === null && !error;

  return (
    <div className="kardex-seccion">
      <div className="kardex-seccion__acciones kardex-bonos-filtros">
        <CampoTexto id="bonos-periodo" etiqueta="Periodo" type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
        <Selector
          id="bonos-tipo"
          etiqueta="Tipo de condición"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          textoVacio="Todos"
          opciones={Object.entries(TIPOS_CONDICION).map(([valor, t]) => ({ valor, etiqueta: t.etiqueta }))}
        />
        <Boton variante="sutil" icono={Download} cargando={exportando} disabled={!bonos || bonos.length === 0} onClick={exportar}>
          Exportar CSV
        </Boton>
      </div>

      {error ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudo cargar el historial de bonificaciones"
          acciones={
            <Boton tamano="sm" onClick={() => setIntento((n) => n + 1)}>
              Reintentar
            </Boton>
          }
        >
          {error.message}
        </Alerta>
      ) : (
        <Tabla
          className="kardex-tabla"
          descripcion={`Historial de bonificaciones de ${nombre}`}
          columnas={COLUMNAS}
          filas={bonos ?? []}
          claveFila="id_bono"
          cargando={cargando}
          filasCargando={3}
          vacio={
            <EstadoVacio
              icono={Gift}
              titulo="Sin bonificaciones registradas"
              mensaje="Este colaborador no tiene bonos por condiciones especiales en el periodo consultado."
            />
          }
        />
      )}
    </div>
  );
}
