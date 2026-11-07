import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Calculator, Plus, SearchX } from "lucide-react";
import {
  actualizarConcepto,
  cambiarEstadoConcepto,
  crearConcepto,
  eliminarConcepto,
  listarConceptos,
} from "../../api/conceptos";
import {
  Alerta,
  Boton,
  EncabezadoPagina,
  EstadoVacio,
  ModalConfirmacion,
  Selector,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import ConceptoFormulario from "./ConceptoFormulario";
import TablaConceptos from "./TablaConceptos";
import VigenciasModal from "./VigenciasModal";
import { TIPOS } from "./formato";
import "./conceptos.css";

const FILTROS_VACIOS = { tipo: "", estado: "" };

const OPCIONES_TIPO = Object.entries(TIPOS).map(([valor, tipo]) => ({ valor, etiqueta: tipo.plural }));
const OPCIONES_ESTADO = [
  { valor: "activo", etiqueta: "Activos" },
  { valor: "inactivo", etiqueta: "Inactivos" },
];

export default function ConceptosPage() {
  const avisar = useAvisos();
  const [conceptos, setConceptos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [alerta, setAlerta] = useState(null);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [formulario, setFormulario] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(
    () =>
      listarConceptos()
        .then((lista) => {
          setConceptos(lista);
          setErrorCarga(null);
        })
        .catch((error) => setErrorCarga(error.message))
        .finally(() => setCargando(false)),
    []
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(
    () =>
      conceptos.filter(
        (c) =>
          (!filtros.tipo || c.tipo === filtros.tipo) &&
          (!filtros.estado || c.esta_activo === (filtros.estado === "activo"))
      ),
    [conceptos, filtros]
  );

  const reintentar = () => {
    setCargando(true);
    setErrorCarga(null);
    cargar();
  };

  const cambiarFiltro = (evento) => setFiltros((actuales) => ({ ...actuales, [evento.target.name]: evento.target.value }));

  const abrirFormulario = (concepto) => {
    setAlerta(null);
    setFormulario({ concepto });
  };

  const guardar = async ({ esta_activo, ...datos }) => {
    const { concepto } = formulario;
    if (concepto) {
      await actualizarConcepto(concepto.id_concepto, datos);
      if (esta_activo !== concepto.esta_activo) await cambiarEstadoConcepto(concepto.id_concepto, esta_activo);
    } else {
      await crearConcepto(datos);
    }
    setFormulario(null);
    await cargar();
    avisar({
      tono: "exito",
      titulo: concepto ? "Concepto actualizado" : "Concepto creado",
      mensaje: `${datos.codigo.trim().toUpperCase()}: ${datos.nombre.trim()}`,
    });
  };

  const inactivar = async (concepto) => {
    setAlerta(null);
    try {
      await cambiarEstadoConcepto(concepto.id_concepto, false);
      await cargar();
      avisar({ tono: "exito", titulo: "Concepto inactivado", mensaje: concepto.codigo });
    } catch (error) {
      setAlerta({ titulo: "No se pudo inactivar el concepto", texto: error.message });
    }
  };

  const confirmarEliminacion = async () => {
    const concepto = porEliminar;
    setEliminando(true);
    try {
      await eliminarConcepto(concepto.id_concepto);
      await cargar();
      avisar({ tono: "exito", titulo: "Concepto eliminado", mensaje: concepto.codigo });
    } catch (error) {
      const puedeInactivar = error.estado === 409 && concepto.esta_activo;
      setAlerta({
        titulo: `No se pudo eliminar ${concepto.codigo}`,
        texto: error.message,
        accion: puedeInactivar ? { texto: "Inactivar concepto", ejecutar: () => inactivar(concepto) } : null,
      });
    } finally {
      setEliminando(false);
      setPorEliminar(null);
    }
  };

  const botonNuevo = (
    <Boton variante="primario" icono={Plus} onClick={() => abrirFormulario(null)}>
      Nuevo concepto
    </Boton>
  );

  const hayFiltros = filtros.tipo || filtros.estado;
  const vacio = hayFiltros ? (
    <EstadoVacio
      icono={SearchX}
      titulo="Ningún concepto coincide con los filtros"
      accion={
        <Boton onClick={() => setFiltros(FILTROS_VACIOS)}>
          Limpiar filtros
        </Boton>
      }
    />
  ) : (
    <EstadoVacio
      icono={Calculator}
      titulo="Aún no hay conceptos"
      mensaje="Cree los ingresos, descuentos y aportes que se aplicarán en la planilla."
      accion={botonNuevo}
    />
  );

  return (
    <section className="conceptos" aria-labelledby="conceptos-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Planillas" }]}
        enlace={Link}
        titulo="Conceptos de pago"
        idTitulo="conceptos-titulo"
        descripcion="Ingresos, descuentos de ley y aportes patronales con su valor vigente y cuenta contable."
        acciones={!errorCarga && conceptos.length > 0 && botonNuevo}
      />

      {alerta && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo={alerta.titulo}
          onCerrar={() => setAlerta(null)}
          acciones={
            alerta.accion && (
              <Boton tamano="sm" onClick={alerta.accion.ejecutar}>
                {alerta.accion.texto}
              </Boton>
            )
          }
        >
          {alerta.texto}
        </Alerta>
      )}

      {errorCarga ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar los conceptos"
          acciones={
            <Boton tamano="sm" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          {errorCarga}
        </Alerta>
      ) : (
        <Tarjeta className="conceptos-tarjeta">
          <div className="conceptos-filtros">
            <Selector
              id="conceptos-filtro-tipo"
              name="tipo"
              etiqueta="Tipo"
              value={filtros.tipo}
              onChange={cambiarFiltro}
              textoVacio="Todos"
              opciones={OPCIONES_TIPO}
            />
            <Selector
              id="conceptos-filtro-estado"
              name="estado"
              etiqueta="Estado"
              value={filtros.estado}
              onChange={cambiarFiltro}
              textoVacio="Todos"
              opciones={OPCIONES_ESTADO}
            />
            {!cargando && (
              <p className="conceptos-total" role="status">
                {visibles.length} de {conceptos.length} conceptos
              </p>
            )}
          </div>
          <TablaConceptos
            conceptos={visibles}
            cargando={cargando}
            vacio={vacio}
            onHistorial={setHistorial}
            onEditar={abrirFormulario}
            onEliminar={setPorEliminar}
          />
        </Tarjeta>
      )}

      {formulario && (
        <ConceptoFormulario
          key={formulario.concepto?.id_concepto ?? "nuevo"}
          concepto={formulario.concepto}
          onGuardar={guardar}
          onCancelar={() => setFormulario(null)}
        />
      )}

      {historial && (
        <VigenciasModal
          key={historial.id_concepto}
          concepto={historial}
          onCerrar={() => setHistorial(null)}
          onRegistrada={cargar}
        />
      )}

      <ModalConfirmacion
        abierto={Boolean(porEliminar)}
        titulo="¿Eliminar el concepto?"
        textoConfirmar="Eliminar"
        procesando={eliminando}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setPorEliminar(null)}
      >
        Se eliminará <strong>{porEliminar?.codigo}</strong> con todo su historial de vigencias. Si ya se usó en una
        planilla, solo podrá inactivarse.
      </ModalConfirmacion>
    </section>
  );
}
