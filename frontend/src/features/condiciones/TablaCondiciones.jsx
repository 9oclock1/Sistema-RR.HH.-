import { History, MoonStar, Pencil, Trash2, Users } from "lucide-react";
import { Boton, EstadoVacio, Etiqueta, Tabla } from "../../components/ui";
import { formatearFecha, formatearValor } from "../conceptos/formato";
import { TIPOS_CONDICION, describirValor, formatearMinutos } from "./formato";

function detalleTipo(c) {
  if (c.tipo_condicion === "TRASNOCHE") return `Desde ${formatearMinutos(c.minutos_nocturnos_minimos)} nocturnas`;
  if (c.tipo_condicion === "FERIADO") return "Se detecta sola";
  const n = c.asignaciones_vigentes;
  return n === 1 ? "1 colaborador hoy" : `${n} colaboradores hoy`;
}

const COLUMNAS = ({ onAsignar, onHistorial, onEditar, onEliminar }) => [
  {
    clave: "condicion",
    titulo: "Condición",
    celda: (c) => (
      <div className="conceptos-nombre">
        <span className="conceptos-codigo">{c.codigo}</span>
        <span>{c.nombre}</span>
      </div>
    ),
  },
  {
    clave: "tipo",
    titulo: "Tipo",
    ancho: "18%",
    celda: (c) => (
      <div className="conceptos-nombre condiciones-tipo">
        <Etiqueta tono={TIPOS_CONDICION[c.tipo_condicion].tono}>{TIPOS_CONDICION[c.tipo_condicion].etiqueta}</Etiqueta>
        <span className="conceptos-nota">{detalleTipo(c)}</span>
      </div>
    ),
  },
  {
    clave: "valor",
    titulo: "Valor vigente",
    ancho: "20%",
    celda: (c) => (
      <div className="conceptos-nombre condiciones-valor">
        <span>{c.vigencia ? describirValor(c.vigencia.valor, c.forma_calculo, c.tipo_condicion) : "Sin vigencia"}</span>
        {c.proxima_vigencia && (
          <span className="conceptos-nota">
            {formatearValor(c.proxima_vigencia.valor, c.forma_calculo)} desde{" "}
            {formatearFecha(c.proxima_vigencia.vigente_desde)}
          </span>
        )}
      </div>
    ),
  },
  {
    clave: "cuenta",
    titulo: "Cuenta contable",
    ancho: "17%",
    celda: (c) =>
      c.cuenta_contable_codigo ? (
        <div className="conceptos-nombre">
          <span className="conceptos-codigo">{c.cuenta_contable_codigo}</span>
          <span className="conceptos-nota">{c.cuenta_contable_nombre}</span>
        </div>
      ) : (
        <span className="conceptos-nota">Sin cuenta</span>
      ),
  },
  {
    clave: "esta_activo",
    titulo: "Estado",
    ancho: "9%",
    celda: (c) => (c.esta_activo ? <Etiqueta tono="exito">Activa</Etiqueta> : <Etiqueta>Inactiva</Etiqueta>),
  },
  {
    clave: "acciones",
    titulo: <span className="ds-solo-lector">Acciones</span>,
    celda: (c) => (
      <div className="conceptos-acciones">
        {c.tipo_condicion === "ASIGNACION" && (
          <Boton
            variante="sutil"
            soloIcono
            icono={Users}
            aria-label={`Colaboradores asignados a ${c.codigo}`}
            title="Colaboradores asignados"
            onClick={() => onAsignar(c)}
          />
        )}
        <Boton
          variante="sutil"
          soloIcono
          icono={History}
          aria-label={`Historial de vigencias de ${c.codigo}`}
          title="Historial de vigencias"
          onClick={() => onHistorial(c)}
        />
        <Boton
          variante="sutil"
          soloIcono
          icono={Pencil}
          aria-label={`Editar ${c.codigo}`}
          title="Editar"
          onClick={() => onEditar(c)}
        />
        <Boton
          variante="sutil"
          soloIcono
          icono={Trash2}
          aria-label={`Eliminar ${c.codigo}`}
          title="Eliminar"
          onClick={() => onEliminar(c)}
        />
      </div>
    ),
  },
];

export default function TablaCondiciones({ condiciones, cargando, vacio, ...acciones }) {
  return (
    <Tabla
      className="conceptos-tabla condiciones-tabla"
      descripcion="Condiciones especiales de trabajo"
      columnas={COLUMNAS(acciones)}
      filas={condiciones}
      claveFila="id_condicion"
      cargando={cargando}
      filasCargando={3}
      vacio={vacio ?? <EstadoVacio icono={MoonStar} titulo="Aún no hay condiciones" />}
    />
  );
}
