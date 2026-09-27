import { CalendarClock, Pencil, Trash2 } from "lucide-react";
import { Boton, EstadoVacio, Etiqueta, Tabla, TextoTruncado } from "../../components/ui";
import { cruzaMedianoche, formatearMinutos, horaCorta } from "./jornada";

const COLUMNAS = (onEditar, onEliminar) => [
  { clave: "nombre", titulo: "Nombre" },
  { clave: "tipo_nombre", titulo: "Tipo", ancho: "13%" },
  {
    clave: "horario",
    titulo: "Horario",
    ancho: "19%",
    celda: (turno) => (
      <span className="turnos-horario">
        {horaCorta(turno.hora_inicio)} – {horaCorta(turno.hora_fin)}
        {cruzaMedianoche(turno.hora_inicio, turno.hora_fin) && <span className="turnos-nota">+1 día</span>}
      </span>
    ),
  },
  {
    clave: "minutos_refrigerio",
    titulo: "Refrigerio",
    ancho: "10%",
    alinear: "fin",
    celda: (turno) => `${turno.minutos_refrigerio} min`,
  },
  {
    clave: "minutos_tolerancia",
    titulo: "Tolerancia",
    ancho: "10%",
    alinear: "fin",
    celda: (turno) => `${turno.minutos_tolerancia} min`,
  },
  {
    clave: "minutos_efectivos",
    titulo: "Horas efectivas",
    ancho: "12%",
    alinear: "fin",
    celda: (turno) => <TextoTruncado>{formatearMinutos(turno.minutos_efectivos)}</TextoTruncado>,
  },
  {
    clave: "esta_activo",
    titulo: "Estado",
    ancho: "11%",
    celda: (turno) =>
      turno.esta_activo ? <Etiqueta tono="exito">Activo</Etiqueta> : <Etiqueta>Inactivo</Etiqueta>,
  },
  {
    clave: "acciones",
    titulo: <span className="ds-solo-lector">Acciones</span>,
    celda: (turno) => (
      <div className="turnos-acciones">
        <Boton
          variante="sutil"
          soloIcono
          icono={Pencil}
          aria-label={`Editar ${turno.nombre}`}
          title="Editar"
          onClick={() => onEditar(turno)}
        />
        <Boton
          variante="sutil"
          soloIcono
          icono={Trash2}
          aria-label={`Eliminar ${turno.nombre}`}
          title="Eliminar"
          onClick={() => onEliminar(turno)}
        />
      </div>
    ),
  },
];

export default function TablaTurnos({ turnos, cargando, accionVacia, onEditar, onEliminar }) {
  return (
    <Tabla
      className="turnos-tabla"
      descripcion="Turnos registrados"
      columnas={COLUMNAS(onEditar, onEliminar)}
      filas={turnos}
      claveFila="id_turno"
      cargando={cargando}
      filasCargando={3}
      vacio={
        <EstadoVacio
          icono={CalendarClock}
          titulo="Aún no hay turnos"
          mensaje="Cree el primer turno para poder asignarlo a los empleados."
          accion={accionVacia}
        />
      }
    />
  );
}
