import { Pencil, Target, Trash2 } from "lucide-react";
import { Boton, EstadoVacio, Etiqueta, Tabla } from "../../components/ui";
import { formatearFecha } from "../conceptos/formato";
import { TIPOS_META, describirValor } from "./formato";

const COLUMNAS = ({ onEditar, onEliminar }) => [
  {
    clave: "periodo",
    titulo: "Periodo",
    ancho: "14%",
    celda: (r) => formatearFecha(r.periodo).slice(3),
  },
  {
    clave: "tipo_meta",
    titulo: "Tipo de meta",
    ancho: "20%",
    celda: (r) => <Etiqueta tono={TIPOS_META[r.tipo_meta].tono}>{TIPOS_META[r.tipo_meta].etiqueta}</Etiqueta>,
  },
  {
    clave: "umbral",
    titulo: "Umbral de cumplimiento",
    ancho: "20%",
    celda: (r) => `${r.umbral_cumplimiento} %`,
  },
  {
    clave: "valor",
    titulo: "Bono",
    ancho: "18%",
    celda: (r) => describirValor(r.valor, r.forma_calculo),
  },
  {
    clave: "esta_activa",
    titulo: "Estado",
    ancho: "10%",
    celda: (r) => (r.esta_activa ? <Etiqueta tono="exito">Activa</Etiqueta> : <Etiqueta>Inactiva</Etiqueta>),
  },
  {
    clave: "acciones",
    titulo: <span className="ds-solo-lector">Acciones</span>,
    celda: (r) => (
      <div className="conceptos-acciones">
        <Boton variante="sutil" soloIcono icono={Pencil} aria-label={`Editar regla de ${r.periodo}`} title="Editar" onClick={() => onEditar(r)} />
        <Boton
          variante="sutil"
          soloIcono
          icono={Trash2}
          aria-label={`Eliminar regla de ${r.periodo}`}
          title="Eliminar"
          onClick={() => onEliminar(r)}
        />
      </div>
    ),
  },
];

export default function TablaReglas({ reglas, cargando, vacio, ...acciones }) {
  return (
    <Tabla
      className="conceptos-tabla"
      descripcion="Reglas de bono por productividad"
      columnas={COLUMNAS(acciones)}
      filas={reglas}
      claveFila="id_regla"
      cargando={cargando}
      filasCargando={3}
      vacio={vacio ?? <EstadoVacio icono={Target} titulo="Aún no hay reglas de bono" />}
    />
  );
}
