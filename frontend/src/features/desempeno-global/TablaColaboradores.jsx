import { useMemo, useState } from "react";
import { FilterX, Users } from "lucide-react";
import { Boton, EstadoVacio, Etiqueta, Paginacion, Selector, Tabla, TextoTruncado } from "../../components/ui";
import { anchoBarra, formatearMinutos, opcionesDe, puntajeOGuion } from "./desempenoGlobal";

const TAMANO_PAGINA = 10;

const columnas = [
  {
    clave: "colaborador",
    titulo: "Colaborador",
    ancho: "20%",
    celda: (c) => <TextoTruncado>{c.nombre_completo}</TextoTruncado>,
  },
  {
    clave: "ubicacion",
    titulo: "Área y sucursal",
    ancho: "17%",
    celda: (c) => (
      <div className="dg-celda">
        <span>{c.departamento}</span>
        <span className="dg-sutil">{c.sucursal}</span>
      </div>
    ),
  },
  {
    clave: "puntaje",
    titulo: "Puntaje",
    ancho: "18%",
    celda: (c) =>
      c.puntaje === null ? (
        <div className="dg-celda">
          <span className="dg-sutil">Sin evaluación enviada</span>
          {c.evaluaciones_vencidas > 0 && <span className="dg-sutil">{c.evaluaciones_vencidas} vencida(s)</span>}
        </div>
      ) : (
        <div className="dg-celda">
          <span className="dg-puntaje">
            <span className="dg-mini-barra" aria-hidden="true">
              <span
                className={`dg-mini-barra__relleno${c.bajo_umbral ? " dg-mini-barra__relleno--brecha" : ""}`}
                style={{ width: anchoBarra(c.puntaje) }}
              />
            </span>
            <span className="dg-numero">{puntajeOGuion(c.puntaje)}</span>
          </span>
          {c.bajo_umbral && (
            <Etiqueta tono="peligro" className="dg-etiqueta-corta">
              Bajo el umbral
            </Etiqueta>
          )}
        </div>
      ),
  },
  {
    clave: "quejas",
    titulo: "Quejas",
    ancho: "17%",
    alinear: "fin",
    celda: (c) => (c.crm ? <span className="dg-numero">{c.crm.cantidad_quejas}</span> : <span className="dg-sutil">Sin métricas del CRM</span>),
  },
  {
    clave: "felicitaciones",
    titulo: "Felicitaciones",
    ancho: "12%",
    alinear: "fin",
    celda: (c) => (c.crm ? <span className="dg-numero">{c.crm.cantidad_felicitaciones}</span> : "—"),
  },
  {
    clave: "resolucion",
    titulo: "Resolución promedio",
    ancho: "14%",
    alinear: "fin",
    celda: (c) => (c.crm ? <span className="dg-numero">{formatearMinutos(c.crm.minutos_resolucion_promedio)}</span> : "—"),
  },
];

// Puntaje de cada colaborador del ciclo, con las métricas objetivas que llegaron del CRM (quejas, felicitaciones y
// tiempo de resolución). Quien no es de atención al cliente o cajas no tiene métricas y se indica.
export default function TablaColaboradores({ colaboradores }) {
  const [departamento, setDepartamento] = useState("");
  const [sucursal, setSucursal] = useState("");
  const [pagina, setPagina] = useState(1);

  const areas = useMemo(() => opcionesDe(colaboradores, "id_departamento", "departamento"), [colaboradores]);
  const sucursales = useMemo(() => opcionesDe(colaboradores, "id_sucursal", "sucursal"), [colaboradores]);
  const filas = useMemo(
    () =>
      colaboradores.filter(
        (c) => (!departamento || c.id_departamento === departamento) && (!sucursal || c.id_sucursal === sucursal),
      ),
    [colaboradores, departamento, sucursal],
  );
  const filtrado = Boolean(departamento || sucursal);
  const visibles = filas.slice((pagina - 1) * TAMANO_PAGINA, pagina * TAMANO_PAGINA);

  const cambiar = (poner) => (evento) => {
    poner(evento.target.value);
    setPagina(1);
  };

  if (colaboradores.length === 0) {
    return <EstadoVacio icono={Users} titulo="Este ciclo no tiene colaboradores evaluados" />;
  }

  return (
    <div className="dg-apilado">
      <div className="dg-filtros">
        <Selector etiqueta="Área" value={departamento} onChange={cambiar(setDepartamento)} opciones={areas} textoVacio="Todas las áreas" />
        <Selector etiqueta="Sucursal" value={sucursal} onChange={cambiar(setSucursal)} opciones={sucursales} textoVacio="Todas las sucursales" />
      </div>
      <Tabla
        className="dg-tabla dg-tabla--ancha"
        descripcion="Puntaje y métricas del CRM por colaborador"
        columnas={columnas}
        filas={visibles}
        claveFila="id_empleado"
        vacio={
          <EstadoVacio
            icono={FilterX}
            titulo="Ningún colaborador coincide con los filtros"
            accion={
              <Boton
                onClick={() => {
                  setDepartamento("");
                  setSucursal("");
                }}
              >
                Quitar filtros
              </Boton>
            }
          />
        }
      />
      <Paginacion
        pagina={pagina}
        limite={TAMANO_PAGINA}
        total={filas.length}
        onCambiar={setPagina}
        etiqueta="Paginación de colaboradores"
      />
      {filtrado && <p className="dg-sutil">Se muestran {filas.length} de {colaboradores.length} colaboradores.</p>}
    </div>
  );
}
