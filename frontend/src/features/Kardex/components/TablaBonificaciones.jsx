import { useEffect, useState } from 'react';
import { Download, Gift } from 'lucide-react';
import { exportarHistorialBonos, listarHistorialBonos } from '../../../api/bonificaciones';
import { Alerta, Boton, CampoTexto, Etiqueta, EstadoVacio, Selector, Tabla, useAvisos } from '../../../components/ui';
import { useRol, useUsuario } from '../../../context/sesion';
import { TIPOS_CONDICION, describirValor } from '../../condiciones/formato';
import { guardarComo } from '../utils/descarga';
import { Celda } from './comunes';

const fechaCorta = (fecha) => fecha.slice(5).split('-').reverse().join('/');

// Las tres fuentes del historial (RF-53): condición (KAN-72), productividad (KAN-71) y antigüedad (KAN-70,
// de solo lectura, sin su propia vigencia de concepto). El "tipo" que filtra por trasnoche/feriado/asignación
// solo tiene sentido para CONDICION; para las otras dos se usa el filtro de fuente (tipo_bono).
const detalle = (bono) => {
  if (bono.tipo_bono === 'PRODUCTIVIDAD') return `${bono.porcentaje_cumplimiento}% de cumplimiento de la meta`;
  if (bono.tipo_bono === 'ANTIGUEDAD') return bono.detalle ?? 'Según la escala de antigüedad vigente';
  if (bono.origen === 'DETECCION') {
    const jornadas = bono.cantidad === 1 ? '1 jornada' : `${bono.cantidad} jornadas`;
    return `${jornadas}: ${(bono.fechas ?? []).map(fechaCorta).join(', ')}`;
  }
  return bono.cantidad === 1 ? '1 día asignado' : `${bono.cantidad} días asignados`;
};

const bonoRegla = (bono) => {
  if (bono.tipo_bono === 'PRODUCTIVIDAD') {
    return (
      <Celda
        principal={<Etiqueta tono="info">Productividad</Etiqueta>}
        secundario={`Regla de ${bono.regla.tipo_meta.toLowerCase()}`}
      />
    );
  }
  if (bono.tipo_bono === 'ANTIGUEDAD') {
    return <Celda principal={<Etiqueta tono="morado">Antigüedad</Etiqueta>} secundario="Escala legal vigente" />;
  }
  return (
    <Celda
      principal={
        <Etiqueta tono={TIPOS_CONDICION[bono.condicion.tipo_condicion]?.tono}>
          {TIPOS_CONDICION[bono.condicion.tipo_condicion]?.etiqueta ?? bono.condicion.tipo_condicion}
        </Etiqueta>
      }
      secundario={`${bono.condicion.codigo} · ${bono.condicion.nombre}`}
    />
  );
};

const valorDe = (bono) => {
  if (bono.tipo_bono !== 'CONDICION') return bono.monto === null ? `${bono.valor}%` : `Bs ${Number(bono.valor).toFixed(2)}`;
  return describirValor(bono.valor, bono.monto === null ? 'PORCENTAJE' : 'MONTO_FIJO', bono.condicion.tipo_condicion);
};

const COLUMNAS = [
  { clave: 'periodo', titulo: 'Periodo', ancho: '12%', celda: (b) => b.periodo },
  { clave: 'condicion', titulo: 'Bono (regla)', ancho: '26%', celda: bonoRegla },
  { clave: 'detalle', titulo: 'Detalle', ancho: '28%', celda: detalle },
  { clave: 'valor', titulo: 'Valor', ancho: '16%', celda: valorDe },
  {
    clave: 'monto',
    titulo: 'Monto',
    ancho: '14%',
    alinear: 'fin',
    celda: (b) => (b.monto === null ? <span className="kardex-nota">En la planilla</span> : `Bs ${Number(b.monto).toFixed(2)}`),
  },
];

const FUENTES = [
  { valor: 'CONDICION', etiqueta: 'Condición especial' },
  { valor: 'PRODUCTIVIDAD', etiqueta: 'Productividad' },
  { valor: 'ANTIGUEDAD', etiqueta: 'Antigüedad' },
];

export default function TablaBonificaciones({ idEmpleado, nombre }) {
  const rol = useRol();
  const idUsuario = useUsuario();
  const avisar = useAvisos();
  const [periodo, setPeriodo] = useState('');
  const [tipo, setTipo] = useState('');
  const [tipoBono, setTipoBono] = useState('');
  const [resultado, setResultado] = useState({ clave: null });
  const [intento, setIntento] = useState(0);
  const [exportando, setExportando] = useState(false);
  const identidad = { idEmpleado: idUsuario, rol };
  const filtros = { ...(periodo && { periodo }), ...(tipo && { tipo }), ...(tipoBono && { tipo_bono: tipoBono }) };
  const clave = JSON.stringify({ idEmpleado, filtros, intento });

  useEffect(() => {
    let vigente = true;
    listarHistorialBonos(idEmpleado, filtros, identidad)
      .then((datos) => vigente && setResultado({ clave, datos }))
      .catch((error) => vigente && setResultado({ clave, error }));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const vista = resultado.clave === clave ? resultado : {};
  const bonos = vista.datos ?? null;
  const error = vista.error ?? null;

  const exportar = async () => {
    setExportando(true);
    try {
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
          id="bonos-fuente"
          etiqueta="Tipo de bono"
          value={tipoBono}
          onChange={(e) => setTipoBono(e.target.value)}
          textoVacio="Todos"
          opciones={FUENTES}
        />
        {tipoBono === 'CONDICION' || tipoBono === '' ? (
          <Selector
            id="bonos-tipo"
            etiqueta="Tipo de condición"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            textoVacio="Todos"
            opciones={Object.entries(TIPOS_CONDICION).map(([valor, t]) => ({ valor, etiqueta: t.etiqueta }))}
          />
        ) : null}
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
              mensaje="Este colaborador no tiene bonos registrados en el periodo consultado."
            />
          }
        />
      )}
    </div>
  );
}
