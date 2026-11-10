import { useCallback, useState } from "react";
import { ChartColumn } from "lucide-react";
import { listarColaboradoresDelCiclo, obtenerConsolidado } from "../../api/desempenoGlobal";
import { Alerta, Boton, EstadoVacio, Esqueleto, Pestanas, Tarjeta } from "../../components/ui";
import useRecurso from "../quejas/casos/useRecurso";
import ComparativaGrupos from "./ComparativaGrupos";
import MatrizCompetencias from "./MatrizCompetencias";
import MensajesCrm from "./MensajesCrm";
import SolicitudCrm from "./SolicitudCrm";
import TablaColaboradores from "./TablaColaboradores";
import UmbralBrecha from "./UmbralBrecha";
import { formatearPuntaje, puntajeOGuion } from "./desempenoGlobal";

function Indicadores({ resumen, departamentos, sucursales, crm }) {
  const nombresEnBrecha = (grupos) => grupos.filter((g) => g.es_brecha).map((g) => g.nombre).join(", ");
  const datos = [
    {
      etiqueta: "Promedio global",
      valor: puntajeOGuion(resumen.promedio_global),
      nota: `Sobre 100, de ${resumen.evaluados} colaborador(es) evaluado(s)`,
    },
    {
      etiqueta: "Cobertura",
      valor: resumen.cobertura_porcentual === null ? "—" : `${formatearPuntaje(resumen.cobertura_porcentual)} %`,
      nota: `${resumen.evaluados} de ${resumen.asignados} con evaluación enviada${resumen.evaluaciones_vencidas > 0 ? ` · ${resumen.evaluaciones_vencidas} vencida(s)` : ""}`,
    },
    {
      etiqueta: "Áreas en brecha",
      valor: resumen.departamentos_en_brecha,
      nota: nombresEnBrecha(departamentos) || "Ninguna bajo el umbral",
      brecha: resumen.departamentos_en_brecha > 0,
    },
    {
      etiqueta: "Sucursales en brecha",
      valor: resumen.sucursales_en_brecha,
      nota: nombresEnBrecha(sucursales) || "Ninguna bajo el umbral",
      brecha: resumen.sucursales_en_brecha > 0,
    },
    {
      etiqueta: "Métricas del CRM",
      valor: crm.colaboradores_con_metricas,
      nota: `${crm.cantidad_quejas} quejas · ${crm.cantidad_felicitaciones} felicitaciones`,
    },
  ];
  return (
    <dl className="dg-indicadores">
      {datos.map(({ etiqueta, valor, nota, brecha }) => (
        <div key={etiqueta} className={`dg-indicador${brecha ? " dg-indicador--brecha" : ""}`}>
          <dt>{etiqueta}</dt>
          <dd className="dg-indicador__valor">{valor}</dd>
          <dd className="dg-sutil">{nota}</dd>
        </div>
      ))}
    </dl>
  );
}

function Cargando() {
  return (
    <div className="dg-apilado" aria-busy="true" aria-label="Cargando el consolidado">
      <Esqueleto forma="bloque" alto="5.5rem" />
      <Esqueleto forma="bloque" alto="14rem" />
    </div>
  );
}

// Todo lo de un ciclo cerrado: umbral, indicadores globales, estado del CRM y el detalle por pestañas.
export default function ConsolidadoCiclo({ ciclo, rol, esAdmin }) {
  const [pestana, setPestana] = useState("areas");
  const cargarConsolidado = useCallback(() => obtenerConsolidado(rol, ciclo.id_ciclo), [rol, ciclo.id_ciclo]);
  const cargarColaboradores = useCallback(() => listarColaboradoresDelCiclo(rol, ciclo.id_ciclo), [rol, ciclo.id_ciclo]);
  const consolidado = useRecurso(cargarConsolidado);
  const colaboradores = useRecurso(cargarColaboradores);

  const refrescar = () => {
    consolidado.reintentar();
    colaboradores.reintentar();
  };

  const error = consolidado.error ?? colaboradores.error;
  if (error) {
    return (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudo cargar el consolidado del ciclo"
        acciones={
          <Boton tamano="sm" onClick={refrescar}>
            Reintentar
          </Boton>
        }
      >
        {error.message}
      </Alerta>
    );
  }
  if (!consolidado.datos || !colaboradores.datos) return <Cargando />;

  const { resumen, departamentos, sucursales, competencias, crm } = consolidado.datos;
  const umbral = consolidado.datos.ciclo.umbral_brecha;
  const lista = colaboradores.datos.colaboradores;
  const sinResultados = resumen.evaluados === 0;

  const pestanas = [
    {
      id: "areas",
      etiqueta: "Áreas",
      contenido: (
        <ComparativaGrupos grupos={departamentos} tipo="departamento" umbral={umbral} promedioGlobal={resumen.promedio_global} />
      ),
    },
    {
      id: "sucursales",
      etiqueta: "Sucursales",
      contenido: <ComparativaGrupos grupos={sucursales} tipo="sucursal" umbral={umbral} promedioGlobal={resumen.promedio_global} />,
    },
    {
      id: "competencias",
      etiqueta: "Competencias",
      contenido: <MatrizCompetencias competencias={competencias} departamentos={departamentos} umbral={umbral} />,
    },
    {
      id: "colaboradores",
      etiqueta: "Colaboradores",
      contador: lista.length,
      contenido: <TablaColaboradores colaboradores={lista} />,
    },
    {
      id: "crm",
      etiqueta: "Mensajes del CRM",
      contenido: (
        <MensajesCrm rol={rol} esAdmin={esAdmin} ciclo={consolidado.datos.ciclo} colaboradores={lista} alCambiar={refrescar} />
      ),
    },
  ];

  return (
    <div className="dg-apilado">
      <UmbralBrecha rol={rol} esAdmin={esAdmin} idCiclo={ciclo.id_ciclo} umbral={umbral} alCambiar={refrescar} />
      {sinResultados ? (
        <EstadoVacio
          icono={ChartColumn}
          titulo="Este ciclo no tiene evaluaciones enviadas"
          mensaje="No hay promedios que consolidar: todas las evaluaciones vencieron sin enviarse."
        />
      ) : (
        <Indicadores resumen={resumen} departamentos={departamentos} sucursales={sucursales} crm={crm} />
      )}
      <SolicitudCrm rol={rol} esAdmin={esAdmin} idCiclo={ciclo.id_ciclo} crm={crm} alCambiar={refrescar} />
      <Tarjeta nivelTitulo={2} titulo="Detalle del ciclo">
        <Pestanas pestanas={pestanas} activa={pestana} onCambiar={setPestana} etiqueta="Detalle del consolidado" />
      </Tarjeta>
    </div>
  );
}
