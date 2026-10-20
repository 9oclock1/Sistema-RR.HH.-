import { useEffect, useMemo, useState } from "react";
import { RefreshCw, SquareKanban } from "lucide-react";
import { Alerta, Boton, Contador, EncabezadoPagina, EstadoVacio, Esqueleto, Selector, useAvisos } from "../../../components/ui";
import { getConvocatorias } from "../../../api/convocatoriasApi";
import { cambiarEtapaPostulacion, obtenerCatalogoPipeline, obtenerPipeline } from "../../../api/pipelineSeleccion";
import { useRol, useUsuario } from "../../../context/sesion";
import { useEmpleados } from "../../Asignaciones/hooks/useEmpleados";
import ModalCambioEtapa from "./ModalCambioEtapa";
import ModalContratacion from "./ModalContratacion";
import ModalDetallePostulacion from "./ModalDetallePostulacion";
import TarjetaPostulante from "./TarjetaPostulante";
import { CODIGO_ETAPA, destinosPermitidos, nombreCompleto, puedeMoverse } from "./reglas";
import "./pipeline.css";

const CLAVE_CONVOCATORIA = "rrhh.pipeline.convocatoria";
// Mientras haya altas en curso, el tablero se refresca para mostrar cuándo terminan de enviarse.
const INTERVALO_ALTAS_MS = 10000;

function leerConvocatoria() {
  try {
    return localStorage.getItem(CLAVE_CONVOCATORIA) ?? "";
  } catch {
    return "";
  }
}

function guardarConvocatoria(id) {
  try {
    localStorage.setItem(CLAVE_CONVOCATORIA, id);
  } catch {
    // Sin almacenamiento: la convocatoria elegida dura solo esta visita.
  }
}

const altaEnCurso = (p) =>
  p.codigo_etapa === CODIGO_ETAPA.CONTRATADO &&
  p.integraciones_fallidas === 0 &&
  !(p.alta_contabilidad_enviada && p.alta_operativa_enviada);

// RF-14: pipeline de candidatos de una convocatoria. Cada columna es una etapa; la tarjeta se arrastra a la etapa
// siguiente (o se usa «Mover») y el cambio queda registrado con fecha, hora y usuario responsable.
export default function PipelineSeleccionPage() {
  const rol = useRol();
  const idUsuario = useUsuario();
  const { empleados } = useEmpleados();
  const avisar = useAvisos();

  const [catalogo, setCatalogo] = useState(null);
  const [convocatorias, setConvocatorias] = useState(null);
  const [errorInicial, setErrorInicial] = useState(null);
  const [intentoInicial, setIntentoInicial] = useState(0);
  const [idConvocatoria, setIdConvocatoria] = useState(leerConvocatoria);
  const [resultado, setResultado] = useState({ clave: null });
  const [recarga, setRecarga] = useState(0);
  const [arrastrando, setArrastrando] = useState(null);
  const [columnaActiva, setColumnaActiva] = useState(null);
  const [movimiento, setMovimiento] = useState(null);
  const [detalle, setDetalle] = useState(null);

  const sesion = useMemo(
    () => ({
      rol,
      idUsuario,
      nombreUsuario: empleados.find((e) => e.id_empleado === idUsuario)?.nombre_completo ?? null,
    }),
    [rol, idUsuario, empleados],
  );

  useEffect(() => {
    const controlador = new AbortController();
    Promise.all([obtenerCatalogoPipeline({ signal: controlador.signal }), getConvocatorias(undefined, { signal: controlador.signal })])
      .then(([catalogoRecibido, lista]) => {
        setCatalogo(catalogoRecibido);
        setConvocatorias(lista.filter((c) => c.estado !== "borrador"));
        setErrorInicial(null);
      })
      .catch((falla) => falla.name !== "AbortError" && setErrorInicial(falla.message));
    return () => controlador.abort();
  }, [intentoInicial]);

  const convocatoriaValida = convocatorias?.some((c) => c.id_convocatoria === idConvocatoria);
  const clave = convocatoriaValida ? `${idConvocatoria}|${recarga}` : null;

  useEffect(() => {
    if (!clave) return undefined;
    const controlador = new AbortController();
    obtenerPipeline(clave.split("|")[0], { signal: controlador.signal })
      .then((datos) => setResultado({ clave, datos }))
      .catch((falla) => falla.name !== "AbortError" && setResultado({ clave, error: falla.message }));
    return () => controlador.abort();
  }, [clave]);

  // Al recargar se conserva el tablero anterior hasta que llegue el nuevo, para que no parpadee.
  const vista = resultado.clave === clave || resultado.clave?.startsWith(`${idConvocatoria}|`) ? resultado : {};
  const postulaciones = useMemo(() => vista.datos?.postulaciones ?? [], [vista.datos]);
  const hayAltasEnCurso = postulaciones.some(altaEnCurso);

  useEffect(() => {
    if (!hayAltasEnCurso) return undefined;
    const temporizador = setInterval(() => setRecarga((n) => n + 1), INTERVALO_ALTAS_MS);
    return () => clearInterval(temporizador);
  }, [hayAltasEnCurso]);

  const recargar = () => setRecarga((n) => n + 1);

  const elegirConvocatoria = (evento) => {
    setIdConvocatoria(evento.target.value);
    guardarConvocatoria(evento.target.value);
  };

  const puedeEditar = Boolean(idUsuario);
  const destinosDe = (postulacion) => destinosPermitidos(catalogo, postulacion.id_etapa);

  const soltarEn = (etapa) => {
    const postulacion = arrastrando;
    setArrastrando(null);
    setColumnaActiva(null);
    if (!postulacion || postulacion.id_etapa === etapa.id_etapa) return;
    if (!destinosDe(postulacion).some((d) => d.id_etapa === etapa.id_etapa)) {
      avisar({
        tono: "aviso",
        titulo: "Cambio no permitido",
        mensaje: `${nombreCompleto(postulacion)} no puede pasar de «${postulacion.nombre_etapa}» a «${etapa.nombre}».`,
      });
      return;
    }
    setMovimiento({
      postulacion,
      idDestino: etapa.id_etapa,
      contratacion: etapa.codigo === CODIGO_ETAPA.CONTRATADO,
    });
  };

  const enviarCambio = async (cuerpo) => {
    try {
      const respuesta = await cambiarEtapaPostulacion(movimiento.postulacion.id_postulacion, cuerpo, sesion);
      recargar();
      return respuesta;
    } catch (falla) {
      // Otro reclutador pudo mover la tarjeta antes: el tablero se pone al día.
      if (falla.status === 409 || falla.status === 404) recargar();
      throw falla;
    }
  };

  const confirmarCambio = async (cuerpo) => {
    const respuesta = await enviarCambio(cuerpo);
    setMovimiento(null);
    avisar({ tono: "exito", titulo: "Etapa actualizada", mensaje: respuesta.message });
  };

  // Desde «Mover», elegir «Contratado» pasa al modal de formalización.
  const formalizar = (idEtapa) =>
    setMovimiento((actual) => ({ ...actual, idDestino: idEtapa, contratacion: true }));

  const contratados = postulaciones.filter((p) => p.codigo_etapa === CODIGO_ETAPA.CONTRATADO).length;
  const opcionesConvocatoria = (convocatorias ?? []).map((c) => ({
    valor: c.id_convocatoria,
    etiqueta: `${c.codigo_convocatoria} · ${c.titulo_puesto}${c.estado === "cerrada" ? " (cerrada)" : ""}`,
  }));

  let tablero;
  if (errorInicial || vista.error) {
    tablero = (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudo cargar el pipeline"
        acciones={
          <Boton tamano="sm" onClick={errorInicial ? () => setIntentoInicial((n) => n + 1) : recargar}>
            Reintentar
          </Boton>
        }
      >
        {errorInicial ?? vista.error}
      </Alerta>
    );
  } else if (!catalogo || !convocatorias) {
    tablero = <Esqueleto forma="bloque" ancho="100%" alto="calc(var(--space-8) * 8)" />;
  } else if (!convocatoriaValida) {
    tablero = (
      <EstadoVacio
        icono={SquareKanban}
        titulo={convocatorias.length ? "Elija una convocatoria" : "Aún no hay convocatorias publicadas"}
        mensaje="El pipeline muestra a los postulantes de la convocatoria agrupados por etapa."
      />
    );
  } else if (!vista.datos) {
    tablero = <Esqueleto forma="bloque" ancho="100%" alto="calc(var(--space-8) * 8)" />;
  } else {
    tablero = (
      <div className="pl-tablero" role="list" aria-label="Etapas del proceso de selección">
        {catalogo.etapas.map((etapa) => {
          const tarjetas = postulaciones.filter((p) => p.id_etapa === etapa.id_etapa);
          const permitida = arrastrando && destinosDe(arrastrando).some((d) => d.id_etapa === etapa.id_etapa);
          const clases = [
            "pl-columna",
            arrastrando && (permitida ? "pl-columna--permitida" : "pl-columna--bloqueada"),
            columnaActiva === etapa.id_etapa && permitida && "pl-columna--sobre",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <section
              key={etapa.id_etapa}
              role="listitem"
              className={clases}
              aria-labelledby={`pl-columna-${etapa.id_etapa}`}
              onDragOver={(evento) => {
                if (!permitida) return;
                evento.preventDefault();
                evento.dataTransfer.dropEffect = "move";
                setColumnaActiva(etapa.id_etapa);
              }}
              onDragLeave={() => setColumnaActiva((actual) => (actual === etapa.id_etapa ? null : actual))}
              onDrop={(evento) => {
                evento.preventDefault();
                soltarEn(etapa);
              }}
            >
              <header className="pl-columna__cabecera">
                <h2 id={`pl-columna-${etapa.id_etapa}`} className="pl-columna__titulo">
                  {etapa.nombre}
                </h2>
                <Contador aria-label={`${tarjetas.length} postulantes`}>{tarjetas.length}</Contador>
              </header>
              <div className="pl-columna__tarjetas">
                {tarjetas.length === 0 ? (
                  <p className="pl-sutil pl-columna__vacia">Sin postulantes</p>
                ) : (
                  tarjetas.map((postulacion) => (
                    <TarjetaPostulante
                      key={postulacion.id_postulacion}
                      postulacion={postulacion}
                      movible={puedeEditar && puedeMoverse(catalogo, postulacion)}
                      arrastrando={arrastrando?.id_postulacion === postulacion.id_postulacion}
                      alIniciarArrastre={setArrastrando}
                      alTerminarArrastre={() => {
                        setArrastrando(null);
                        setColumnaActiva(null);
                      }}
                      alMover={(p) => setMovimiento({ postulacion: p, idDestino: null })}
                      alVerDetalle={setDetalle}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="pl-pagina">
      <EncabezadoPagina
        titulo="Pipeline de selección"
        descripcion="Arrastre a cada postulante a su nueva etapa. Cada cambio queda registrado con fecha, hora y responsable."
        acciones={
          convocatoriaValida && (
            <Boton icono={RefreshCw} onClick={recargar}>
              Actualizar
            </Boton>
          )
        }
      />

      <div className="pl-barra">
        <Selector
          etiqueta="Convocatoria"
          className="pl-barra__convocatoria"
          value={convocatoriaValida ? idConvocatoria : ""}
          onChange={elegirConvocatoria}
          textoVacio="Seleccione una convocatoria"
          opciones={opcionesConvocatoria}
          disabled={!convocatorias}
        />
        {vista.datos && (
          <p className="pl-sutil" aria-live="polite">
            {postulaciones.length} postulante(s) · {contratados} de {vista.datos.convocatoria.cantidad_vacantes} vacante(s)
            cubierta(s)
          </p>
        )}
      </div>

      {!puedeEditar && convocatoriaValida && (
        <Alerta tono="aviso" titulo="Seleccione su usuario">
          Para mover postulantes elija su usuario de prueba en la barra superior: el cambio queda registrado a su nombre.
        </Alerta>
      )}

      {tablero}

      {movimiento?.contratacion && (
        <ModalContratacion
          key={`contratacion-${movimiento.postulacion.id_postulacion}`}
          postulacion={movimiento.postulacion}
          convocatoria={vista.datos.convocatoria}
          idEtapaContratado={movimiento.idDestino}
          cargos={catalogo.cargos_operativos}
          sesion={sesion}
          onCerrar={() => setMovimiento(null)}
          onContratar={enviarCambio}
        />
      )}
      {movimiento && !movimiento.contratacion && (
        <ModalCambioEtapa
          key={`${movimiento.postulacion.id_postulacion}-${movimiento.idDestino}`}
          postulacion={movimiento.postulacion}
          destinos={destinosDe(movimiento.postulacion)}
          idDestinoInicial={movimiento.idDestino}
          onCerrar={() => setMovimiento(null)}
          onConfirmar={confirmarCambio}
          onFormalizar={formalizar}
        />
      )}
      {detalle && (
        <ModalDetallePostulacion
          key={detalle.id_postulacion}
          postulacion={detalle}
          sesion={sesion}
          onCerrar={() => setDetalle(null)}
          onActualizar={recargar}
        />
      )}
    </div>
  );
}
