import { useCallback, useState } from "react";
import { Link } from "react-router";
import { ChartColumn, RefreshCw } from "lucide-react";
import { listarCiclosCerrados } from "../../api/desempenoGlobal";
import { Alerta, Boton, EncabezadoPagina, EstadoVacio, Esqueleto, Selector, Tarjeta } from "../../components/ui";
import { useRol } from "../../context/sesion";
import { puedeAcceder } from "../../utils/permisos";
import useRecurso from "../quejas/casos/useRecurso";
import { formatearMomento } from "../ciclos-evaluacion/ciclo";
import ConsolidadoCiclo from "./ConsolidadoCiclo";
import "./desempenoGlobal.css";

const etiquetaCiclo = (ciclo) => `${ciclo.nombre} · ${ciclo.periodo.nombre}`;

export default function DesempenoGlobalPage() {
  const rol = useRol();
  const esAdmin = puedeAcceder(rol, ["admin"]);
  const [elegido, setElegido] = useState("");
  const cargar = useCallback(() => listarCiclosCerrados(rol), [rol]);
  const { datos: ciclos, error, cargando, reintentar } = useRecurso(cargar);

  const ciclo = ciclos?.find((c) => c.id_ciclo === elegido) ?? ciclos?.[0] ?? null;

  return (
    <section className="dg-pagina" aria-labelledby="dg-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Desempeño" }]}
        enlace={Link}
        titulo="Resultados de desempeño"
        idTitulo="dg-titulo"
        descripcion="Consolide los resultados de un ciclo cerrado por área, sucursal y competencia, compare departamentos y detecte brechas de productividad con las métricas del CRM."
        acciones={
          <Boton icono={RefreshCw} onClick={reintentar}>
            Actualizar
          </Boton>
        }
      />

      {error ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar los ciclos"
          acciones={
            <Boton tamano="sm" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          {error.message}
        </Alerta>
      ) : cargando && !ciclos ? (
        <Esqueleto forma="bloque" alto="4rem" />
      ) : !ciclo ? (
        <Tarjeta>
          <EstadoVacio
            icono={ChartColumn}
            titulo="Aún no hay ciclos cerrados"
            mensaje="El consolidado se genera cuando un ciclo de evaluación termina su plazo."
          />
        </Tarjeta>
      ) : (
        <>
          <Tarjeta nivelTitulo={2} titulo="Ciclo a consolidar">
            <div className="dg-ciclo">
              <Selector
                etiqueta="Ciclo cerrado"
                value={ciclo.id_ciclo}
                onChange={(evento) => setElegido(evento.target.value)}
                opciones={ciclos.map((c) => ({ valor: c.id_ciclo, etiqueta: etiquetaCiclo(c) }))}
              />
              <p className="dg-sutil">
                Cerrado el {formatearMomento(ciclo.cerrado_en)} · {ciclo.evaluaciones.enviadas} de {ciclo.evaluaciones.total}{" "}
                evaluaciones enviadas
                {ciclo.evaluaciones.vencidas > 0 && `, ${ciclo.evaluaciones.vencidas} vencidas`}
              </p>
            </div>
          </Tarjeta>
          <ConsolidadoCiclo key={`${rol}-${ciclo.id_ciclo}`} ciclo={ciclo} rol={rol} esAdmin={esAdmin} />
        </>
      )}
    </section>
  );
}
