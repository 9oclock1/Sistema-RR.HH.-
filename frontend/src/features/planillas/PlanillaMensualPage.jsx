import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { FileSpreadsheet, ListChecks, RefreshCw, Search, Trash2, TriangleAlert } from "lucide-react";
import { descartarPlanilla, generarPlanilla, listarPlanillas, obtenerPlanilla } from "../../api/planillas";
import {
  Alerta,
  Boton,
  CampoTexto,
  Casilla,
  EncabezadoPagina,
  EstadoVacio,
  Etiqueta,
  ModalConfirmacion,
  Tabla,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import { useRol, useUsuario } from "../../context/sesion";
import { formatearFecha } from "../conceptos/formato";
import { formatearMes, formatearMomento, mesActual } from "../condiciones/formato";
import DetalleColaboradorModal from "./DetalleColaboradorModal";
import { ESTADOS_PLANILLA, formatearBs, mesAnterior, plural } from "./formato";
import "../conceptos/conceptos.css";
import "./planillas.css";

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const RUTA_HORAS_EXTRA = "/asistencia/horas-extra";

// Nombre del mes dentro de una frase: "planilla de octubre de 2026".
const nombreMes = (periodo) => formatearMes(periodo).toLowerCase();

const normalizar = (texto) =>
  (texto ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const cifra = (valor) => <span className="planilla-cifra">{formatearBs(valor)}</span>;

function columnas(onDetalle) {
  return [
    {
      clave: "colaborador",
      titulo: "Colaborador",
      celda: (f) => (
        <div className="conceptos-nombre">
          <span>{f.empleado.nombre_completo}</span>
          <span className="conceptos-nota">{[f.empleado.cargo, f.empleado.area].filter(Boolean).join(" · ")}</span>
          {f.alertas.length > 0 && (
            <Etiqueta tono="peligro" icono={TriangleAlert} className="planilla-alerta-fila">
              {plural(f.alertas.length, "inconsistencia", "inconsistencias")}
            </Etiqueta>
          )}
        </div>
      ),
    },
    {
      clave: "dias",
      titulo: "Días a pagar",
      ancho: "11%",
      alinear: "fin",
      celda: (f) => (
        <span className="planilla-cifra">
          <strong>{f.dias.pagados}</strong> de {f.dias.contrato}
        </span>
      ),
    },
    { clave: "haber", titulo: "Haber mensual", ancho: "13%", alinear: "fin", celda: (f) => cifra(f.contrato.haber_mensual) },
    { clave: "ganado", titulo: "Total ganado", ancho: "13%", alinear: "fin", celda: (f) => cifra(f.calculo.total_ganado) },
    { clave: "descuentos", titulo: "Descuentos", ancho: "12%", alinear: "fin", celda: (f) => cifra(f.calculo.total_descuentos) },
    {
      clave: "liquido",
      titulo: "Líquido pagable",
      ancho: "14%",
      alinear: "fin",
      celda: (f) => (
        <strong className={`planilla-cifra${f.calculo.liquido_pagable < 0 ? " planilla-negativo" : ""}`}>
          {formatearBs(f.calculo.liquido_pagable)}
        </strong>
      ),
    },
    {
      clave: "acciones",
      titulo: <span className="ds-solo-lector">Acciones</span>,
      ancho: "8%",
      alinear: "fin",
      celda: (f) => (
        <Boton
          tamano="sm"
          variante="sutil"
          icono={ListChecks}
          aria-label={`Detalle de ${f.empleado.nombre_completo}`}
          onClick={() => onDetalle(f)}
        >
          Detalle
        </Boton>
      ),
    },
  ];
}

function Resumen({ planilla }) {
  const { totales } = planilla;
  return (
    <dl className="vigencias-resumen planilla-totales">
      <div>
        <dt>Colaboradores</dt>
        <dd>{totales.colaboradores}</dd>
      </div>
      <div>
        <dt>Total ganado</dt>
        <dd className="planilla-cifra">{formatearBs(totales.total_ganado)}</dd>
      </div>
      <div>
        <dt>Descuentos</dt>
        <dd className="planilla-cifra">{formatearBs(totales.total_descuentos)}</dd>
      </div>
      <div>
        <dt>Líquido pagable</dt>
        <dd className="planilla-cifra">{formatearBs(totales.liquido_pagable)}</dd>
      </div>
      <div>
        <dt>Aportes patronales</dt>
        <dd className="planilla-cifra">{formatearBs(totales.total_aportes)}</dd>
      </div>
    </dl>
  );
}

export default function PlanillaMensualPage() {
  const avisar = useAvisos();
  const rol = useRol();
  const idEmpleado = useUsuario();
  const [periodo, setPeriodo] = useState(mesAnterior);
  // Respuesta con el mes al que corresponde: al cambiar de mes deja de mostrarse.
  const [carga, setCarga] = useState(null);
  const [intento, setIntento] = useState(0);
  const [accion, setAccion] = useState(null);
  const [errorAccion, setErrorAccion] = useState(null);
  const [descartando, setDescartando] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [soloAlertas, setSoloAlertas] = useState(false);
  const valido = PERIODO_RE.test(periodo) && periodo <= mesActual();

  useEffect(() => {
    if (!valido) return undefined;
    let vigente = true;
    listarPlanillas(periodo)
      .then(([resumen]) => (resumen ? obtenerPlanilla(resumen.id_planilla) : null))
      .then((planilla) => vigente && setCarga({ periodo, planilla }))
      .catch((e) => vigente && setCarga({ periodo, error: e.message }));
    return () => {
      vigente = false;
    };
  }, [periodo, valido, intento]);

  const actual = valido && carga?.periodo === periodo ? carga : null;
  const cargando = valido && !actual;
  const planilla = actual?.planilla ?? null;
  const errorDelMes = errorAccion?.periodo === periodo ? errorAccion : null;
  const editable = !planilla || planilla.estado === "BORRADOR";
  const identidad = { idEmpleado, rol };

  const filas = useMemo(() => {
    const texto = normalizar(busqueda.trim());
    return (planilla?.empleados ?? []).filter(
      (f) =>
        (!soloAlertas || f.alertas.length > 0) &&
        (!texto || normalizar([f.empleado.nombre_completo, f.empleado.cargo, f.empleado.area].join(" ")).includes(texto))
    );
  }, [planilla, busqueda, soloAlertas]);
  const filtrando = Boolean(busqueda.trim()) || soloAlertas;

  const cambiarPeriodo = (valor) => {
    setPeriodo(valor);
    setBusqueda("");
    setSoloAlertas(false);
  };

  const reintentar = () => {
    setCarga(null);
    setIntento((n) => n + 1);
  };

  const generar = async () => {
    setAccion("generar");
    setErrorAccion(null);
    try {
      const generada = await generarPlanilla(periodo, identidad);
      setCarga({ periodo, planilla: generada });
      avisar({
        tono: "exito",
        titulo: planilla ? `Planilla de ${nombreMes(periodo)} actualizada` : `Planilla de ${nombreMes(periodo)} generada`,
        mensaje: plural(generada.colaboradores, "colaborador", "colaboradores"),
      });
    } catch (e) {
      setErrorAccion({ periodo, mensaje: e.message, consolidar: e.estado === 409 && /^Consolide/.test(e.message) });
    } finally {
      setAccion(null);
    }
  };

  const confirmarDescarte = async () => {
    setAccion("descartar");
    setErrorAccion(null);
    try {
      await descartarPlanilla(planilla.id_planilla, identidad);
      setCarga({ periodo, planilla: null });
      avisar({ tono: "exito", titulo: "Borrador descartado", mensaje: `Planilla de ${nombreMes(periodo)}` });
    } catch (e) {
      setErrorAccion({ periodo, mensaje: e.message });
    } finally {
      setAccion(null);
      setDescartando(false);
    }
  };

  const botonGenerar = (
    <Boton
      variante="primario"
      icono={RefreshCw}
      cargando={accion === "generar"}
      disabled={!valido || !idEmpleado || Boolean(accion) || cargando || !editable}
      onClick={generar}
    >
      {accion === "generar" ? "Generando…" : planilla ? "Volver a generar" : "Generar planilla"}
    </Boton>
  );

  const estado = planilla && ESTADOS_PLANILLA[planilla.estado];

  return (
    <section className="conceptos" aria-labelledby="planilla-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Planillas" }]}
        enlace={Link}
        titulo="Planilla mensual"
        idTitulo="planilla-titulo"
        descripcion="Consolida la asistencia, las horas extra aprobadas, las licencias y los bonos del mes por colaborador para revisarlos antes de aprobar."
      />

      {!idEmpleado && (
        <Alerta tono="info" titulo="Elija su usuario">
          Para generar o descartar la planilla, elija su usuario de prueba en la barra superior.
        </Alerta>
      )}

      <Tarjeta className="conceptos-tarjeta">
        <div className="planilla-barra">
          <CampoTexto
            id="planilla-periodo"
            etiqueta="Periodo"
            type="month"
            value={periodo}
            max={mesActual()}
            onChange={(evento) => cambiarPeriodo(evento.target.value)}
            error={periodo && !valido ? "Elija un mes hasta el actual." : undefined}
          />
          <div className="planilla-barra__acciones">
            {planilla?.estado === "BORRADOR" && (
              <Boton
                variante="sutil"
                icono={Trash2}
                disabled={!idEmpleado || Boolean(accion)}
                onClick={() => setDescartando(true)}
              >
                Descartar borrador
              </Boton>
            )}
            {editable && botonGenerar}
          </div>
        </div>

        {errorDelMes && (
          <Alerta
            tono="peligro"
            role="alert"
            titulo={errorDelMes.consolidar ? "Faltan horas extra por consolidar" : "No se pudo completar la acción"}
            onCerrar={() => setErrorAccion(null)}
            acciones={
              errorDelMes.consolidar && (
                <Boton tamano="sm" as={Link} to={RUTA_HORAS_EXTRA}>
                  Ir a horas extra
                </Boton>
              )
            }
          >
            {errorDelMes.mensaje}
          </Alerta>
        )}

        {actual?.error ? (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudo cargar la planilla"
            acciones={
              <Boton tamano="sm" onClick={reintentar}>
                Reintentar
              </Boton>
            }
          >
            {actual.error}
          </Alerta>
        ) : !cargando && !planilla ? (
          valido && (
            <EstadoVacio
              icono={FileSpreadsheet}
              titulo={`Aún no se generó la planilla de ${nombreMes(periodo)}`}
              mensaje="Se necesitan las horas extra del mes consolidadas en Asistencia. La planilla se crea como borrador para revisarla."
              accion={botonGenerar}
            />
          )
        ) : (
          <div className="planilla-contenido">
            {planilla && (
              <>
                <div className="planilla-estado" role="status">
                  <Etiqueta tono={estado.tono}>{estado.etiqueta}</Etiqueta>
                  <span className="conceptos-nota">
                    Generada por {planilla.generada.por.nombre_completo} el {formatearMomento(planilla.generada.en)} · Datos
                    hasta el {formatearFecha(planilla.datos_hasta)}
                    {planilla.aprobada &&
                      ` · Aprobada por ${planilla.aprobada.por.nombre_completo} el ${formatearMomento(planilla.aprobada.en)}`}
                  </span>
                </div>

                {planilla.advertencias.length > 0 && (
                  <Alerta tono="aviso" titulo="Revise antes de aprobar">
                    <ul className="planilla-advertencias">
                      {planilla.advertencias.map((texto) => (
                        <li key={texto}>{texto}</li>
                      ))}
                    </ul>
                  </Alerta>
                )}

                {planilla.totales.con_alertas > 0 && (
                  <Alerta tono="peligro" titulo="Hay inconsistencias en el cálculo">
                    {plural(planilla.totales.con_alertas, "colaborador tiene", "colaboradores tienen")} alertas de
                    inconsistencia. La planilla no se puede aprobar hasta corregirlas y volver a generarla.
                  </Alerta>
                )}

                <Resumen planilla={planilla} />

                <div className="conceptos-filtros planilla-filtros">
                  <CampoTexto
                    id="planilla-busqueda"
                    etiqueta="Buscar colaborador"
                    type="search"
                    value={busqueda}
                    onChange={(evento) => setBusqueda(evento.target.value)}
                    placeholder="Nombre, cargo o área"
                  />
                  {planilla.totales.con_alertas > 0 && (
                    <Casilla
                      id="planilla-solo-alertas"
                      etiqueta="Solo con inconsistencias"
                      checked={soloAlertas}
                      onChange={(evento) => setSoloAlertas(evento.target.checked)}
                    />
                  )}
                  <p className="conceptos-total" role="status">
                    {filtrando
                      ? `${filas.length} de ${plural(planilla.empleados.length, "colaborador", "colaboradores")}`
                      : plural(planilla.empleados.length, "colaborador", "colaboradores")}
                  </p>
                </div>
              </>
            )}

            <Tabla
              className="planilla-tabla"
              descripcion={`Planilla de ${valido ? nombreMes(periodo) : "el periodo"} por colaborador`}
              columnas={columnas(setDetalle)}
              filas={filas}
              claveFila="id_planilla_empleado"
              cargando={cargando}
              filasCargando={4}
              vacio={
                <EstadoVacio
                  icono={Search}
                  titulo={filtrando ? "Nadie coincide con la búsqueda" : "La planilla no tiene colaboradores"}
                  mensaje={
                    filtrando
                      ? "Pruebe con otro nombre, cargo o área."
                      : "Ningún colaborador tiene contrato en el mes. Revise los contratos y vuelva a generarla."
                  }
                />
              }
            />
          </div>
        )}
      </Tarjeta>

      {detalle && <DetalleColaboradorModal key={detalle.id_planilla_empleado} fila={detalle} onCerrar={() => setDetalle(null)} />}

      <ModalConfirmacion
        abierto={descartando}
        titulo="¿Descartar el borrador?"
        textoConfirmar="Descartar"
        procesando={accion === "descartar"}
        onConfirmar={confirmarDescarte}
        onCancelar={() => setDescartando(false)}
      >
        Se eliminará el borrador de la planilla de <strong>{nombreMes(periodo)}</strong>. Podrá generarla de nuevo cuando
        quiera.
      </ModalConfirmacion>
    </section>
  );
}
