import { Calculator, History, Pencil, Trash2 } from "lucide-react";
import { Boton, EstadoVacio, Etiqueta, Tabla } from "../../components/ui";
import { BASES, CODIGOS_CON_PORCENTAJE_EXTERNO, TIPOS, formatearFecha, formatearValor } from "./formato";

const COLUMNAS = ({ onHistorial, onEditar, onEliminar }) => [
  {
    clave: "concepto",
    titulo: "Concepto",
    celda: (c) => (
      <div className="conceptos-nombre">
        <span className="conceptos-codigo">{c.codigo}</span>
        <span>{c.nombre}</span>
        {c.es_de_ley && <span className="conceptos-nota">De ley</span>}
      </div>
    ),
  },
  {
    clave: "tipo",
    titulo: "Tipo",
    ancho: "15%",
    celda: (c) => <Etiqueta tono={TIPOS[c.tipo].tono}>{TIPOS[c.tipo].etiqueta}</Etiqueta>,
  },
  {
    clave: "valor",
    titulo: "Valor vigente",
    ancho: "17%",
    alinear: "fin",
    celda: (c) =>
      CODIGOS_CON_PORCENTAJE_EXTERNO.has(c.codigo) ? (
        <div className="conceptos-valor">
          <span>Según escala de antigüedad</span>
          <span className="conceptos-nota">se administra desde Antigüedad</span>
        </div>
      ) : (
        <div className="conceptos-valor">
          <span>{c.vigencia ? formatearValor(c.vigencia.valor, c.forma_calculo) : "Sin vigencia"}</span>
          {c.vigencia && c.base_calculo && (
            <span className="conceptos-nota">sobre {BASES[c.base_calculo].toLowerCase()}</span>
          )}
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
    ancho: "20%",
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
    ancho: "10%",
    celda: (c) => (c.esta_activo ? <Etiqueta tono="exito">Activo</Etiqueta> : <Etiqueta>Inactivo</Etiqueta>),
  },
  {
    clave: "acciones",
    titulo: <span className="ds-solo-lector">Acciones</span>,
    celda: (c) => (
      <div className="conceptos-acciones">
        <Boton
          variante="sutil"
          soloIcono
          icono={History}
          aria-label={`Historial de vigencias de ${c.codigo}`}
          title={
            CODIGOS_CON_PORCENTAJE_EXTERNO.has(c.codigo)
              ? "El porcentaje se administra desde la pantalla de Antigüedad"
              : "Historial de vigencias"
          }
          disabled={CODIGOS_CON_PORCENTAJE_EXTERNO.has(c.codigo)}
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

export default function TablaConceptos({ conceptos, cargando, vacio, ...acciones }) {
  return (
    <Tabla
      className="conceptos-tabla"
      descripcion="Conceptos de pago y deducción"
      columnas={COLUMNAS(acciones)}
      filas={conceptos}
      claveFila="id_concepto"
      cargando={cargando}
      filasCargando={4}
      vacio={vacio ?? <EstadoVacio icono={Calculator} titulo="Aún no hay conceptos" />}
    />
  );
}
