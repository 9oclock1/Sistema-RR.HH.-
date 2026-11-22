import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { listarPlanillas } from "../../api/planillas";
import { Alerta, Boton, CampoTexto, EncabezadoPagina, EstadoVacio, Esqueleto, Etiqueta, Pestanas, Tarjeta } from "../../components/ui";
import { useRol, useUsuario } from "../../context/sesion";
import { formatearMes, mesActual } from "../condiciones/formato";
import { ESTADOS_PLANILLA, mesAnterior } from "../planillas/formato";
import PlanillaAportesVista from "./PlanillaAportesVista";
import PlanillaTributariaVista from "./PlanillaTributariaVista";
import { PERIODO_RE } from "./planillasFiscales";
import "../conceptos/conceptos.css";
import "./planillasFiscales.css";

const nombreMes = (periodo) => formatearMes(periodo).toLowerCase();

export default function PlanillasFiscalesPage() {
  const rol = useRol();
  const idEmpleado = useUsuario();
  const [periodo, setPeriodo] = useState(mesAnterior);
  const [pestana, setPestana] = useState("tributaria");
  const [carga, setCarga] = useState(null);
  const [intento, setIntento] = useState(0);
  const valido = PERIODO_RE.test(periodo) && periodo <= mesActual();
  const identidad = useMemo(() => ({ idEmpleado, rol }), [idEmpleado, rol]);

  useEffect(() => {
    if (!valido) return undefined;
    let vigente = true;
    listarPlanillas(periodo)
      .then(([resumen]) => vigente && setCarga({ periodo, planilla: resumen ?? null }))
      .catch((e) => vigente && setCarga({ periodo, error: e.message }));
    return () => {
      vigente = false;
    };
  }, [periodo, valido, intento]);

  const actual = valido && carga?.periodo === periodo ? carga : null;
  const planilla = actual?.planilla ?? null;
  const cerrada = planilla?.estado === "CERRADA";
  const estado = planilla && ESTADOS_PLANILLA[planilla.estado];

  const cambiarPeriodo = (valor) => {
    setPeriodo(valor);
    setCarga(null);
  };

  const contenido = () => {
    if (!valido) return null;
    if (!actual) return <Esqueleto forma="bloque" alto="14rem" />;
    if (actual.error) {
      return (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudo consultar la planilla"
          acciones={
            <Boton
              tamano="sm"
              onClick={() => {
                setCarga(null);
                setIntento((n) => n + 1);
              }}
            >
              Reintentar
            </Boton>
          }
        >
          {actual.error}
        </Alerta>
      );
    }
    if (!planilla) {
      return (
        <EstadoVacio
          titulo={`No hay planilla de ${nombreMes(periodo)}`}
          mensaje="Genere y cierre la planilla mensual del periodo para poder armar la planilla tributaria y la de aportes."
          accion={
            <Boton as={Link} to="/planillas/mensual" variante="primario">
              Ir a la planilla mensual
            </Boton>
          }
        />
      );
    }
    if (!cerrada) {
      return (
        <Alerta tono="aviso" titulo={`La planilla de ${nombreMes(periodo)} aún no está cerrada`}>
          Las planillas tributaria y de aportes se arman con la planilla cerrada del periodo. Estado actual: {estado.etiqueta.toLowerCase()}.
        </Alerta>
      );
    }
    const vista = { key: planilla.id_planilla, planilla, identidad, puedeGenerar: Boolean(idEmpleado) };
    return (
      <Pestanas
        etiqueta="Planillas del periodo"
        activa={pestana}
        onCambiar={setPestana}
        pestanas={[
          { id: "tributaria", etiqueta: "Planilla tributaria (RC-IVA)", contenido: <PlanillaTributariaVista {...vista} /> },
          { id: "aportes", etiqueta: "Aportes laborales y patronales", contenido: <PlanillaAportesVista {...vista} /> },
        ]}
      />
    );
  };

  return (
    <section className="conceptos" aria-labelledby="fiscales-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Planillas" }]}
        enlace={Link}
        titulo="Planilla tributaria y de aportes"
        idTitulo="fiscales-titulo"
        descripcion="Calcula el RC-IVA de cada dependiente y reúne los aportes laborales y patronales del periodo, listos para exportar en el formato de cada entidad."
      />

      {!idEmpleado && (
        <Alerta tono="info" titulo="Elija su usuario">
          Para generar las planillas, elija su usuario de prueba en la barra superior.
        </Alerta>
      )}

      <Tarjeta className="conceptos-tarjeta">
        <div className="pf-periodo">
          <CampoTexto
            id="fiscales-periodo"
            etiqueta="Periodo"
            type="month"
            value={periodo}
            max={mesActual()}
            onChange={(evento) => cambiarPeriodo(evento.target.value)}
            error={periodo && !valido ? "Elija un mes hasta el actual." : undefined}
          />
          {estado && <Etiqueta tono={estado.tono}>Planilla {estado.etiqueta.toLowerCase()}</Etiqueta>}
        </div>
        {contenido()}
      </Tarjeta>
    </section>
  );
}
