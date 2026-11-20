import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { BadgeCheck, FlaskConical, Gift, RefreshCw, Search, Trash2 } from "lucide-react";
import {
  aprobarAguinaldo,
  descartarAguinaldo,
  generarAguinaldo,
  listarAguinaldos,
  obtenerAguinaldo,
  reenviarIntegracionAguinaldo,
  simularConfirmacionAguinaldo,
} from "../../api/aguinaldo";
import {
  Alerta,
  Boton,
  CampoTexto,
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
import { formatearMomento } from "../condiciones/formato";
import { ESTADOS_PLANILLA, formatearBs, plural } from "../planillas/formato";
import IntegracionesPlanilla from "../planillas/IntegracionesPlanilla";
import SimularConfirmacionModal from "./SimularConfirmacionModal";
import "../conceptos/conceptos.css";
import "../planillas/planillas.css";

const NOMBRE_DESTINO = { contabilidad: "Contabilidad", pagos: "Pagos" };

const INTERVALO_INTEGRACIONES_MS = 10000;

// La gestión del aguinaldo cierra el 30 de noviembre: mientras no llegue esa fecha, la última cerrada es la anterior.
function gestionReciente() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  return hoy <= new Date(`${anio}-11-30T00:00:00`) ? anio - 1 : anio;
}

const normalizar = (texto) =>
  (texto ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const COLUMNAS = [
  {
    clave: "colaborador",
    titulo: "Colaborador",
    celda: (f) => (
      <div className="conceptos-nombre">
        <span>{f.empleado.nombre_completo}</span>
        <span className="conceptos-nota">Ingresó el {formatearFecha(f.fecha_ingreso)}</span>
      </div>
    ),
  },
  {
    clave: "tiempo",
    titulo: "Duodécimas",
    ancho: "16%",
    alinear: "fin",
    celda: (f) => (
      <span className="planilla-cifra">
        {f.meses_trabajados} m, {f.dias_trabajados} d
      </span>
    ),
  },
  { clave: "promedio", titulo: "Promedio de sueldo", ancho: "18%", alinear: "fin", celda: (f) => <span className="planilla-cifra">{formatearBs(f.promedio_sueldo)}</span> },
  {
    clave: "monto",
    titulo: "Aguinaldo",
    ancho: "16%",
    alinear: "fin",
    celda: (f) => (f.excluido ? <span className="conceptos-nota">—</span> : <strong className="planilla-cifra">{formatearBs(f.monto)}</strong>),
  },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "18%",
    celda: (f) =>
      f.excluido ? (
        <Etiqueta tono="neutral" title={f.motivo_exclusion}>
          Excluido
        </Etiqueta>
      ) : (
        <Etiqueta tono="exito">Incluido</Etiqueta>
      ),
  },
];

function Resumen({ aguinaldo }) {
  const { totales } = aguinaldo;
  return (
    <dl className="vigencias-resumen planilla-totales">
      <div>
        <dt>Colaboradores</dt>
        <dd>{totales.colaboradores}</dd>
      </div>
      <div>
        <dt>Excluidos (menos de 3 meses)</dt>
        <dd>{totales.excluidos}</dd>
      </div>
      <div>
        <dt>Total aguinaldos</dt>
        <dd className="planilla-cifra">{formatearBs(totales.total_aguinaldo)}</dd>
      </div>
    </dl>
  );
}

export default function AguinaldoPage() {
  const avisar = useAvisos();
  const rol = useRol();
  const idEmpleado = useUsuario();
  const [gestion, setGestion] = useState(gestionReciente);
  const [carga, setCarga] = useState(null);
  const [intento, setIntento] = useState(0);
  const [accion, setAccion] = useState(null);
  const [errorAccion, setErrorAccion] = useState(null);
  const [descartando, setDescartando] = useState(false);
  const [aprobando, setAprobando] = useState(false);
  const [simulando, setSimulando] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const anioValido = Number.isInteger(gestion) && gestion >= 2000 && gestion <= 2100;
  const gestionYaTermino = anioValido && new Date(`${gestion}-11-30T00:00:00`) <= new Date();
  const valido = anioValido && gestionYaTermino;
  const identidad = { idEmpleado, rol };

  useEffect(() => {
    if (!valido) return undefined;
    let vigente = true;
    listarAguinaldos()
      .then((lista) => lista.find((a) => a.gestion === gestion))
      .then((resumen) => (resumen ? obtenerAguinaldo(resumen.id_aguinaldo) : null))
      .then((aguinaldo) => vigente && setCarga({ gestion, aguinaldo }))
      .catch((e) => vigente && setCarga({ gestion, error: e.message }));
    return () => {
      vigente = false;
    };
  }, [gestion, valido, intento]);

  const actual = valido && carga?.gestion === gestion ? carga : null;
  const cargando = valido && !actual;
  const aguinaldo = actual?.aguinaldo ?? null;
  const errorDeGestion = errorAccion?.gestion === gestion ? errorAccion : null;
  const editable = !aguinaldo || aguinaldo.estado === "BORRADOR";
  const borrador = aguinaldo?.estado === "BORRADOR";
  const aprobable = borrador && aguinaldo.totales.colaboradores - aguinaldo.totales.excluidos > 0;

  const idAprobado = aguinaldo?.estado === "APROBADA" ? aguinaldo.id_aguinaldo : null;
  useEffect(() => {
    if (!idAprobado) return undefined;
    const temporizador = setInterval(() => {
      if (document.hidden) return;
      obtenerAguinaldo(idAprobado)
        .then((nuevo) => setCarga((previa) => (previa?.aguinaldo?.id_aguinaldo === idAprobado ? { ...previa, aguinaldo: nuevo } : previa)))
        .catch(() => {});
    }, INTERVALO_INTEGRACIONES_MS);
    return () => clearInterval(temporizador);
  }, [idAprobado]);

  const filas = useMemo(() => {
    const texto = normalizar(busqueda.trim());
    return (aguinaldo?.empleados ?? []).filter((f) => !texto || normalizar(f.empleado.nombre_completo).includes(texto));
  }, [aguinaldo, busqueda]);

  const reintentar = () => {
    setCarga(null);
    setIntento((n) => n + 1);
  };

  const generar = async () => {
    setAccion("generar");
    setErrorAccion(null);
    try {
      const generado = await generarAguinaldo(gestion, identidad);
      setCarga({ gestion, aguinaldo: generado });
      avisar({
        tono: "exito",
        titulo: aguinaldo ? `Aguinaldos de ${gestion} actualizados` : `Aguinaldos de ${gestion} generados`,
        mensaje: plural(generado.colaboradores, "colaborador", "colaboradores"),
      });
    } catch (e) {
      setErrorAccion({ gestion, mensaje: e.message });
    } finally {
      setAccion(null);
    }
  };

  const confirmarDescarte = async () => {
    setAccion("descartar");
    setErrorAccion(null);
    try {
      await descartarAguinaldo(aguinaldo.id_aguinaldo, identidad);
      setCarga({ gestion, aguinaldo: null });
      avisar({ tono: "exito", titulo: "Borrador descartado", mensaje: `Aguinaldos de ${gestion}` });
    } catch (e) {
      setErrorAccion({ gestion, mensaje: e.message });
    } finally {
      setAccion(null);
      setDescartando(false);
    }
  };

  const confirmarAprobacion = async () => {
    setAccion("aprobar");
    setErrorAccion(null);
    try {
      const aprobado = await aprobarAguinaldo(aguinaldo.id_aguinaldo, identidad);
      setCarga({ gestion, aguinaldo: aprobado });
      avisar({ tono: "exito", titulo: `Aguinaldos de ${gestion} aprobados`, mensaje: "Se envía a Contabilidad y Pagos." });
    } catch (e) {
      setErrorAccion({ gestion, mensaje: e.message });
    } finally {
      setAccion(null);
      setAprobando(false);
    }
  };

  const reenviar = async (destino) => {
    setAccion(`reenviar-${destino}`);
    setErrorAccion(null);
    try {
      const actualizado = await reenviarIntegracionAguinaldo(aguinaldo.id_aguinaldo, destino, identidad);
      setCarga({ gestion, aguinaldo: actualizado });
      avisar({ tono: "exito", titulo: "Envío en cola", mensaje: `Aguinaldos de ${gestion}` });
    } catch (e) {
      setErrorAccion({ gestion, mensaje: e.message });
    } finally {
      setAccion(null);
    }
  };

  // Contabilidad y Pagos no existen en este sistema: se simula su respuesta en vez de esperarla por Pub/Sub.
  const confirmarSimulacion = async (datos) => {
    const destino = simulando;
    const actualizado = await simularConfirmacionAguinaldo(aguinaldo.id_aguinaldo, destino, datos, identidad);
    setCarga({ gestion, aguinaldo: actualizado });
    setSimulando(null);
    avisar({
      tono: datos.resultado === "CONFIRMADA" ? "exito" : "aviso",
      titulo: `${NOMBRE_DESTINO[destino]} ${datos.resultado === "CONFIRMADA" ? "confirmó" : "rechazó"} (simulado)`,
      mensaje: `Aguinaldos de ${gestion}`,
    });
  };

  const botonGenerar = (
    <Boton
      variante={aprobable ? "predeterminado" : "primario"}
      icono={RefreshCw}
      cargando={accion === "generar"}
      disabled={!valido || !idEmpleado || Boolean(accion) || cargando || !editable}
      onClick={generar}
    >
      {accion === "generar" ? "Generando…" : aguinaldo ? "Volver a generar" : "Generar aguinaldos"}
    </Boton>
  );

  const estado = aguinaldo && ESTADOS_PLANILLA[aguinaldo.estado];

  return (
    <section className="conceptos" aria-labelledby="aguinaldo-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Planillas" }]}
        enlace={Link}
        titulo="Planilla de aguinaldos"
        idTitulo="aguinaldo-titulo"
        descripcion="Duodécimas del promedio de los tres últimos sueldos por los meses y días trabajados en la gestión (1.º de diciembre a 30 de noviembre), para aprobar y enviar a Contabilidad y Pagos."
      />

      {!idEmpleado && (
        <Alerta tono="info" titulo="Elija su usuario">
          Para generar, aprobar o descartar los aguinaldos, elija su usuario de prueba en la barra superior.
        </Alerta>
      )}

      <Tarjeta className="conceptos-tarjeta">
        <div className="planilla-barra">
          <CampoTexto
            id="aguinaldo-gestion"
            etiqueta="Gestión (año de cierre)"
            type="number"
            min="2000"
            max="2100"
            value={gestion}
            onChange={(evento) => setGestion(Number(evento.target.value))}
            error={anioValido && !gestionYaTermino ? "Esa gestión todavía no termina (cierra el 30 de noviembre)." : undefined}
          />
          <div className="planilla-barra__acciones">
            {aguinaldo?.estado === "BORRADOR" && (
              <Boton variante="sutil" icono={Trash2} disabled={!idEmpleado || Boolean(accion)} onClick={() => setDescartando(true)}>
                Descartar borrador
              </Boton>
            )}
            {editable && valido && botonGenerar}
            {borrador && (
              <Boton
                variante={aprobable ? "primario" : "predeterminado"}
                icono={BadgeCheck}
                disabled={!aprobable || !idEmpleado || Boolean(accion)}
                onClick={() => setAprobando(true)}
              >
                Aprobar aguinaldos
              </Boton>
            )}
          </div>
        </div>

        {errorDeGestion && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo completar la acción" onCerrar={() => setErrorAccion(null)}>
            {errorDeGestion.mensaje}
          </Alerta>
        )}

        {actual?.error ? (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudieron cargar los aguinaldos"
            acciones={
              <Boton tamano="sm" onClick={reintentar}>
                Reintentar
              </Boton>
            }
          >
            {actual.error}
          </Alerta>
        ) : !cargando && !aguinaldo ? (
          valido && (
            <EstadoVacio
              icono={Gift}
              titulo={`Aún no se generaron los aguinaldos de la gestión ${gestion}`}
              mensaje="Se calcula el promedio de los tres últimos sueldos y las duodécimas de cada colaborador. Se crea como borrador para revisarlo."
              accion={botonGenerar}
            />
          )
        ) : (
          <div className="planilla-contenido">
            {aguinaldo && (
              <>
                <div className="planilla-estado" role="status">
                  <Etiqueta tono={estado.tono}>{estado.etiqueta}</Etiqueta>
                  <span className="conceptos-nota">
                    Generado por {aguinaldo.generada.por.nombre_completo} el {formatearMomento(aguinaldo.generada.en)}
                    {aguinaldo.aprobada &&
                      ` · Aprobado por ${aguinaldo.aprobada.por.nombre_completo} el ${formatearMomento(aguinaldo.aprobada.en)}`}
                  </span>
                </div>

                {!borrador && (
                  <IntegracionesPlanilla
                    planilla={aguinaldo}
                    reenviando={accion?.startsWith("reenviar-") ? accion.slice("reenviar-".length) : null}
                    puedeReenviar={Boolean(idEmpleado) && !accion}
                    onReenviar={reenviar}
                  />
                )}

                {aguinaldo.estado === "APROBADA" && (
                  <div className="planilla-barra__acciones" role="group" aria-label="Simular confirmaciones">
                    {Object.entries(NOMBRE_DESTINO)
                      .filter(([clave]) => aguinaldo.integraciones[clave].estado !== "CONFIRMADA")
                      .map(([clave, nombre]) => (
                        <Boton
                          key={clave}
                          variante="sutil"
                          icono={FlaskConical}
                          disabled={!idEmpleado || Boolean(accion)}
                          onClick={() => setSimulando(clave)}
                        >
                          Simular respuesta de {nombre}
                        </Boton>
                      ))}
                  </div>
                )}

                <Resumen aguinaldo={aguinaldo} />

                <div className="conceptos-filtros planilla-filtros">
                  <CampoTexto
                    id="aguinaldo-busqueda"
                    etiqueta="Buscar colaborador"
                    type="search"
                    value={busqueda}
                    onChange={(evento) => setBusqueda(evento.target.value)}
                    placeholder="Nombre del colaborador"
                  />
                  <p className="conceptos-total" role="status">
                    {plural(aguinaldo.empleados.length, "colaborador", "colaboradores")}
                  </p>
                </div>
              </>
            )}

            <Tabla
              className="planilla-tabla"
              descripcion={`Aguinaldos de la gestión ${valido ? gestion : ""} por colaborador`}
              columnas={COLUMNAS}
              filas={filas}
              claveFila="id_aguinaldo_empleado"
              cargando={cargando}
              filasCargando={4}
              vacio={
                <EstadoVacio
                  icono={Search}
                  titulo="Nadie coincide con la búsqueda"
                  mensaje="Pruebe con otro nombre."
                />
              }
            />
          </div>
        )}
      </Tarjeta>

      <ModalConfirmacion
        abierto={descartando}
        titulo="¿Descartar el borrador?"
        textoConfirmar="Descartar"
        procesando={accion === "descartar"}
        onConfirmar={confirmarDescarte}
        onCancelar={() => setDescartando(false)}
      >
        Se eliminará el borrador de aguinaldos de la gestión <strong>{gestion}</strong>. Podrá generarlo de nuevo cuando quiera.
      </ModalConfirmacion>

      <ModalConfirmacion
        abierto={aprobando}
        titulo={`¿Aprobar los aguinaldos de la gestión ${gestion}?`}
        textoConfirmar="Aprobar aguinaldos"
        variante="primario"
        procesando={accion === "aprobar"}
        onConfirmar={confirmarAprobacion}
        onCancelar={() => setAprobando(false)}
      >
        {aguinaldo?.totales && (
          <div className="planilla-aprobacion">
            <dl className="vigencias-resumen planilla-aprobacion__totales">
              <div>
                <dt>Colaboradores</dt>
                <dd>{aguinaldo.totales.colaboradores - aguinaldo.totales.excluidos}</dd>
              </div>
              <div>
                <dt>Total aguinaldos</dt>
                <dd className="planilla-cifra">{formatearBs(aguinaldo.totales.total_aguinaldo)}</dd>
              </div>
            </dl>
            <p>
              Ya no se podrá volver a generar ni descartar. Se enviará el asiento contable a <strong>Contabilidad</strong> y la
              orden de dispersión a <strong>Pagos</strong>.
            </p>
          </div>
        )}
      </ModalConfirmacion>

      {simulando && (
        <SimularConfirmacionModal
          key={simulando}
          nombreDestino={NOMBRE_DESTINO[simulando]}
          onConfirmar={confirmarSimulacion}
          onCerrar={() => setSimulando(null)}
        />
      )}
    </section>
  );
}
