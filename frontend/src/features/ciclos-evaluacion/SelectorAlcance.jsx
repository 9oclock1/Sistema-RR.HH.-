import { useMemo, useState } from "react";
import { Alerta, Boton, CampoTexto, Casilla, Contador } from "../../components/ui";
import { plural } from "../solicitud-vacaciones/formato";
import { MAX_COLABORADORES_VISIBLES, alternarId, colaboradoresDelAlcance, normalizar } from "./ciclo";

function GrupoCasillas({ leyenda, ayuda, elementos, seleccion, onAlternar, onLimpiar, vacio, ancho }) {
  return (
    <fieldset className={`cev-grupo ${ancho ? "cev-grupo--ancho" : ""}`}>
      <legend className="cev-grupo__leyenda">
        {leyenda}
        <Contador aria-label={`${seleccion.length} seleccionados`}>{seleccion.length}</Contador>
      </legend>
      {ayuda}
      <div className="cev-lista">
        {elementos.length === 0 ? (
          <p className="cev-sutil">{vacio}</p>
        ) : (
          elementos.map((elemento) => (
            <Casilla
              key={elemento.id}
              etiqueta={elemento.etiqueta}
              ayuda={elemento.ayuda}
              checked={seleccion.includes(elemento.id)}
              onChange={() => onAlternar(elemento.id)}
            />
          ))
        )}
      </div>
      {seleccion.length > 0 && (
        <Boton variante="sutil" tamano="sm" onClick={onLimpiar} className="cev-grupo__limpiar">
          Quitar selección
        </Boton>
      )}
    </fieldset>
  );
}

// Elección del alcance del ciclo: áreas, sucursales y colaboradores.
// valor: { areas, sucursales, colaboradores } con id; onCambiar(campo, lista).
export default function SelectorAlcance({ areas, sucursales, empleados, valor, onCambiar, error, areaPlantilla }) {
  const [busqueda, setBusqueda] = useState("");

  const incluidos = useMemo(() => colaboradoresDelAlcance(empleados, valor), [empleados, valor]);
  const deOtraArea = areaPlantilla
    ? incluidos.filter((empleado) => empleado.id_departamento !== areaPlantilla.id_departamento).length
    : 0;

  const activos = useMemo(() => empleados.filter((empleado) => empleado.activo !== false), [empleados]);
  const coincidencias = useMemo(() => {
    const texto = normalizar(busqueda.trim());
    if (!texto) return activos;
    return activos.filter((empleado) =>
      normalizar(`${empleado.nombre_completo} ${empleado.cargo} ${empleado.area} ${empleado.sucursal}`).includes(texto),
    );
  }, [activos, busqueda]);
  const visibles = coincidencias.slice(0, MAX_COLABORADORES_VISIBLES);

  const comoElementos = (lista, clave) => lista.map((item) => ({ id: item[clave], etiqueta: item.nombre }));
  const alternar = (campo) => (id) => onCambiar(campo, alternarId(valor[campo], id));
  const limpiar = (campo) => () => onCambiar(campo, []);

  return (
    <div className="cev-alcance">
      <p className="cev-sutil">
        Si elige áreas y sucursales, se evalúa a quienes cumplen ambas (por ejemplo, «Cajas» de la sucursal «Centro»).
        Los colaboradores que marque uno por uno se suman a ese resultado.
      </p>

      <div className="cev-grupos">
        <GrupoCasillas
          leyenda="Áreas"
          elementos={comoElementos(areas, "id_departamento")}
          seleccion={valor.areas}
          onAlternar={alternar("areas")}
          onLimpiar={limpiar("areas")}
          vacio="No hay áreas activas."
        />
        <GrupoCasillas
          leyenda="Sucursales"
          elementos={comoElementos(sucursales, "id_sucursal")}
          seleccion={valor.sucursales}
          onAlternar={alternar("sucursales")}
          onLimpiar={limpiar("sucursales")}
          vacio="No hay sucursales activas."
        />
        <GrupoCasillas
          ancho
          leyenda="Colaboradores"
          ayuda={
            <CampoTexto
              etiqueta="Buscar colaborador"
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Nombre, cargo, área o sucursal"
            />
          }
          elementos={visibles.map((empleado) => ({
            id: empleado.id_empleado,
            etiqueta: empleado.nombre_completo,
            ayuda: [empleado.cargo, empleado.area, empleado.sucursal].filter(Boolean).join(" · "),
          }))}
          seleccion={valor.colaboradores}
          onAlternar={alternar("colaboradores")}
          onLimpiar={limpiar("colaboradores")}
          vacio={busqueda ? "Ningún colaborador coincide con la búsqueda." : "No hay colaboradores activos."}
        />
      </div>
      {coincidencias.length > visibles.length && (
        <p className="cev-sutil">
          Se muestran {visibles.length} de {coincidencias.length} colaboradores. Escriba en el buscador para acotar la
          lista.
        </p>
      )}

      {error && (
        <p className="cev-error" role="alert">
          {error}
        </p>
      )}

      <p className="cev-resumen" aria-live="polite">
        El alcance incluye <strong>{plural(incluidos.length, "colaborador activo", "colaboradores activos")}</strong>.
        Quienes no tengan un jefe directo en su sucursal se indicarán en la revisión.
      </p>

      {deOtraArea > 0 && (
        <Alerta tono="aviso" titulo="Hay colaboradores de otra área">
          {plural(deOtraArea, "colaborador pertenece", "colaboradores pertenecen")} a un área distinta de «
          {areaPlantilla.nombre}», a la que va dirigida la plantilla. Puede continuar si es lo que desea.
        </Alerta>
      )}
    </div>
  );
}
