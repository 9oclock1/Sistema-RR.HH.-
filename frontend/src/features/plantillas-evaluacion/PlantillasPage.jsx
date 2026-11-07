import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ClipboardList, Plus, RefreshCw, SearchX, UserRound } from "lucide-react";
import {
  actualizarPlantilla,
  crearPlantilla,
  eliminarPlantilla,
  listarPlantillas,
} from "../../api/plantillasEvaluacion";
import {
  Alerta,
  Boton,
  CampoTexto,
  EncabezadoPagina,
  EstadoVacio,
  ModalConfirmacion,
  Selector,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import { useUsuario } from "../../context/sesion";
import { useDepartamentosActivos } from "../../hooks/useDepartamentosActivos";
import FormularioPlantilla from "./FormularioPlantilla";
import TablaPlantillas from "./TablaPlantillas";
import { OPCIONES_ESTADO, coincideConBusqueda } from "./formato";
import "./plantillasEvaluacion.css";

const FILTROS_VACIOS = { estado: "", idDepartamento: "", busqueda: "" };

// Se monta de nuevo al cambiar de usuario (key), así nunca queda a la vista la lista o el formulario de otra persona.
function Listado({ idEmpleado, intento, onActualizar }) {
  const avisar = useAvisos();
  const { departamentos, error: errorAreas } = useDepartamentosActivos();
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  // La respuesta lleva la clave de lo que se pidió: si el usuario cambia de filtro mientras tanto, se descarta.
  const [resultado, setResultado] = useState({ clave: null });
  const [formulario, setFormulario] = useState(null);
  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [alerta, setAlerta] = useState(null);

  const { estado, idDepartamento, busqueda } = filtros;
  const clave = `${estado}|${idDepartamento}|${intento}`;

  useEffect(() => {
    let vigente = true;
    listarPlantillas(idEmpleado, { estado, idDepartamento })
      .then((datos) => vigente && setResultado({ clave, datos }))
      .catch((error) => vigente && setResultado({ clave, error: error.message }));
    return () => {
      vigente = false;
    };
  }, [clave, idEmpleado, estado, idDepartamento]);

  const vista = resultado.clave === clave ? resultado : {};
  const visibles = useMemo(
    () => (vista.datos ?? []).filter((plantilla) => coincideConBusqueda(plantilla, busqueda)),
    [vista.datos, busqueda],
  );

  const opcionesArea = departamentos.map((d) => ({ valor: d.id_departamento, etiqueta: d.nombre }));
  const hayFiltros = Boolean(estado || idDepartamento || busqueda.trim());

  const cambiarFiltro = (evento) =>
    setFiltros((actuales) => ({ ...actuales, [evento.target.name]: evento.target.value }));

  const abrirFormulario = (plantilla) => {
    setAlerta(null);
    setFormulario({ plantilla });
  };

  const guardar = async (datos) => {
    const { plantilla } = formulario;
    if (plantilla) await actualizarPlantilla(idEmpleado, plantilla.id_plantilla, datos);
    else await crearPlantilla(idEmpleado, datos);
    setFormulario(null);
    onActualizar();
    avisar({
      tono: "exito",
      titulo: plantilla ? "Plantilla actualizada" : "Plantilla creada como borrador",
      mensaje: datos.nombre.trim(),
    });
  };

  const confirmarEliminacion = async () => {
    const plantilla = porEliminar;
    setEliminando(true);
    try {
      await eliminarPlantilla(idEmpleado, plantilla.id_plantilla);
      onActualizar();
      avisar({ tono: "exito", titulo: "Plantilla eliminada", mensaje: plantilla.nombre });
    } catch (error) {
      setAlerta({ titulo: `No se pudo eliminar «${plantilla.nombre}»`, texto: error.message });
    } finally {
      setEliminando(false);
      setPorEliminar(null);
    }
  };

  const botonNueva = (
    <Boton variante="primario" icono={Plus} onClick={() => abrirFormulario(null)}>
      Nueva plantilla
    </Boton>
  );

  const vacio = hayFiltros ? (
    <EstadoVacio
      icono={SearchX}
      titulo="Ninguna plantilla coincide con los filtros"
      accion={<Boton onClick={() => setFiltros(FILTROS_VACIOS)}>Limpiar filtros</Boton>}
    />
  ) : (
    <EstadoVacio
      icono={ClipboardList}
      titulo="Aún no hay plantillas de evaluación"
      mensaje="Cree una plantilla con su área destino y su vigencia para medir de forma consistente a cada equipo."
      accion={botonNueva}
    />
  );

  return (
    <>
      <div className="pl-barra">
        <Boton icono={RefreshCw} onClick={onActualizar}>
          Actualizar
        </Boton>
        {botonNueva}
      </div>

      {alerta && (
        <Alerta tono="peligro" role="alert" titulo={alerta.titulo} onCerrar={() => setAlerta(null)}>
          {alerta.texto}
        </Alerta>
      )}

      {vista.error ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar las plantillas"
          acciones={
            <Boton tamano="sm" onClick={onActualizar}>
              Reintentar
            </Boton>
          }
        >
          {vista.error}
        </Alerta>
      ) : (
        <Tarjeta className="pl-tarjeta">
          <div className="pl-filtros">
            <CampoTexto
              id="plantillas-filtro-busqueda"
              name="busqueda"
              etiqueta="Buscar"
              type="search"
              value={busqueda}
              onChange={cambiarFiltro}
              placeholder="Nombre, objetivo o área"
              autoComplete="off"
            />
            <Selector
              id="plantillas-filtro-estado"
              name="estado"
              etiqueta="Estado"
              value={estado}
              onChange={cambiarFiltro}
              textoVacio="Todos"
              opciones={OPCIONES_ESTADO}
            />
            <Selector
              id="plantillas-filtro-area"
              name="idDepartamento"
              etiqueta="Área destino"
              value={idDepartamento}
              onChange={cambiarFiltro}
              textoVacio="Todas"
              opciones={opcionesArea}
            />
            {vista.datos && (
              <p className="pl-total" role="status">
                {visibles.length} de {vista.datos.length} plantillas
              </p>
            )}
          </div>
          <TablaPlantillas
            plantillas={visibles}
            cargando={!vista.datos}
            vacio={vacio}
            onEditar={abrirFormulario}
            onEliminar={setPorEliminar}
          />
        </Tarjeta>
      )}

      {formulario && (
        <FormularioPlantilla
          key={formulario.plantilla?.id_plantilla ?? "nueva"}
          plantilla={formulario.plantilla}
          departamentos={departamentos}
          errorAreas={errorAreas}
          onGuardar={guardar}
          onCancelar={() => setFormulario(null)}
        />
      )}

      <ModalConfirmacion
        abierto={Boolean(porEliminar)}
        titulo="¿Eliminar la plantilla?"
        textoConfirmar="Eliminar"
        procesando={eliminando}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setPorEliminar(null)}
      >
        Se eliminará <strong>{porEliminar?.nombre}</strong> con sus secciones. Esta acción no se puede deshacer.
      </ModalConfirmacion>
    </>
  );
}

export default function PlantillasPage() {
  // Usuario de prueba de la barra lateral: figura como creador hasta contar con inicio de sesión.
  const idEmpleado = useUsuario();
  const [intento, setIntento] = useState(0);
  const actualizar = () => setIntento((n) => n + 1);

  return (
    <section className="pl-pagina" aria-labelledby="pl-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Desempeño" }]}
        enlace={Link}
        titulo="Plantillas de evaluación"
        idTitulo="pl-titulo"
        descripcion="Plantillas estandarizadas para medir competencias laborales y rendimiento operativo en cada periodo."
      />

      {idEmpleado ? (
        <Listado key={idEmpleado} idEmpleado={idEmpleado} intento={intento} onActualizar={actualizar} />
      ) : (
        <EstadoVacio
          icono={UserRound}
          titulo="Elija su usuario de prueba"
          mensaje="Seleccione quién es en «Usuario de prueba», al pie de la barra lateral, para registrar plantillas a su nombre."
        />
      )}
    </section>
  );
}
