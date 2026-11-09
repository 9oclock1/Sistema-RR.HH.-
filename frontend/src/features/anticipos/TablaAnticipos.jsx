import { HandCoins, ListOrdered } from "lucide-react";
import { Boton, EstadoVacio, Etiqueta, Tabla } from "../../components/ui";
import { ESTADOS, TIPOS, formatearFecha, formatearMonto } from "./formato";

const COLUMNAS = (empleadosPorId, { onVerCuotas }) => [
  {
    clave: "colaborador",
    titulo: "Colaborador",
    celda: (p) => {
      const empleado = empleadosPorId.get(p.id_empleado);
      return (
        <div className="anticipos-nombre">
          <span>{empleado?.nombre_completo ?? "Colaborador no encontrado"}</span>
          {empleado?.numero_documento && <span className="anticipos-nota">{empleado.numero_documento}</span>}
        </div>
      );
    },
  },
  {
    clave: "tipo",
    titulo: "Tipo",
    ancho: "15%",
    celda: (p) => <Etiqueta tono={TIPOS[p.tipo].tono}>{TIPOS[p.tipo].etiqueta}</Etiqueta>,
  },
  {
    clave: "monto",
    titulo: "Monto",
    ancho: "13%",
    alinear: "fin",
    celda: (p) => formatearMonto(p.monto),
  },
  {
    clave: "cuotas",
    titulo: "Cuotas",
    ancho: "10%",
    alinear: "fin",
    celda: (p) => p.numero_cuotas,
  },
  {
    clave: "mes_inicio",
    titulo: "Inicio",
    ancho: "12%",
    celda: (p) => formatearFecha(p.mes_inicio),
  },
  {
    clave: "saldo_pendiente",
    titulo: "Saldo pendiente",
    ancho: "15%",
    alinear: "fin",
    celda: (p) => formatearMonto(p.saldo_pendiente),
  },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "12%",
    celda: (p) => <Etiqueta tono={ESTADOS[p.estado].tono}>{ESTADOS[p.estado].etiqueta}</Etiqueta>,
  },
  {
    clave: "acciones",
    titulo: <span className="ds-solo-lector">Acciones</span>,
    celda: (p) => (
      <Boton
        variante="sutil"
        soloIcono
        icono={ListOrdered}
        aria-label="Ver tabla de amortización"
        title="Tabla de amortización"
        onClick={() => onVerCuotas(p)}
      />
    ),
  },
];

export default function TablaAnticipos({ anticipos, empleadosPorId, cargando, vacio, onVerCuotas }) {
  return (
    <Tabla
      className="anticipos-tabla"
      descripcion="Anticipos y préstamos registrados"
      columnas={COLUMNAS(empleadosPorId, { onVerCuotas })}
      filas={anticipos}
      claveFila="id_prestamo"
      cargando={cargando}
      filasCargando={4}
      vacio={vacio ?? <EstadoVacio icono={HandCoins} titulo="Aún no hay anticipos ni préstamos" />}
    />
  );
}
