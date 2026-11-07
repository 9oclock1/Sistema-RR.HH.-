import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { crearVersionPlantilla, eliminarPlantilla, listarPlantillas } from "../../api/plantillasEvaluacion";
import { useUsuario } from "../../context/sesion";
import { Alerta, Boton, EncabezadoPagina, ModalConfirmacion, Pestanas, Tarjeta, useAvisos } from "../../components/ui";
import EditorPlantilla from "./EditorPlantilla";
import PanelEscalas from "./PanelEscalas";
import TablaPlantillas from "./TablaPlantillas";
import "./plantillasEvaluacion.css";

export default function PlantillasEvaluacionPage() {
  const avisar = useAvisos();
  // Usuario de prueba de la barra lateral: queda como creador y publicador hasta contar con inicio de sesión.
  const idEmpleado = useUsuario();
  const [pestana, setPestana] = useState("plantillas");
  const [plantillas, setPlantillas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [alerta, setAlerta] = useState(null);
  // null: lista; { id }: editor de una versión (id null para una plantilla nueva).
  const [abierta, setAbierta] = useState(null);
  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(
    () =>
      listarPlantillas()
        .then((lista) => {
          setPlantillas(lista);
          setErrorCarga(null);
        })
        .catch((error) => setErrorCarga(error.message))
        .finally(() => setCargando(false)),
    []
  );

  useEffect(() => {
    if (!abierta) cargar();
  }, [abierta, cargar]);

  const reintentar = () => {
    setCargando(true);
    setErrorCarga(null);
    cargar();
  };

  const abrir = (id) => {
    setAlerta(null);
    setAbierta({ id });
  };

  const nuevaVersion = async (version) => {
    setAlerta(null);
    try {
      const borrador = await crearVersionPlantilla(version.id_version);
      abrir(borrador.id_version);
      avisar({ tono: "exito", titulo: `Versión ${borrador.numero_version} en borrador`, mensaje: borrador.nombre });
    } catch (error) {
      setAlerta({ titulo: "No se pudo crear la nueva versión", texto: error.message });
    }
  };

  const confirmarEliminacion = async () => {
    const version = porEliminar;
    setEliminando(true);
    try {
      await eliminarPlantilla(version.id_version);
      await cargar();
      avisar({ tono: "exito", titulo: "Borrador eliminado", mensaje: version.nombre });
    } catch (error) {
      setAlerta({ titulo: `No se pudo eliminar «${version.nombre}»`, texto: error.message });
    } finally {
      setEliminando(false);
      setPorEliminar(null);
    }
  };

  if (abierta) {
    return (
      <EditorPlantilla
        key={abierta.id ?? "nueva"}
        idInicial={abierta.id}
        idEmpleado={idEmpleado}
        onAbrir={abrir}
        onVolver={() => setAbierta(null)}
      />
    );
  }

  const botonNuevo = (
    <Boton
      variante="primario"
      icono={Plus}
      onClick={() => abrir(null)}
      disabled={!idEmpleado}
      title={idEmpleado ? undefined : "Elija su usuario de prueba para crear plantillas"}
    >
      Nueva plantilla
    </Boton>
  );

  const listaPlantillas = errorCarga ? (
    <Alerta
      tono="peligro"
      role="alert"
      titulo="No se pudieron cargar las plantillas"
      acciones={
        <Boton tamano="sm" onClick={reintentar}>
          Reintentar
        </Boton>
      }
    >
      {errorCarga}
    </Alerta>
  ) : (
    <>
      {!idEmpleado && (
        <Alerta tono="aviso" titulo="Elija su usuario de prueba">
          Seleccione quién es en «Usuario de prueba», al pie de la barra lateral, para crear o publicar plantillas.
        </Alerta>
      )}
      {plantillas.length > 0 && <div className="plantillas-barra plantillas-barra--fin">{botonNuevo}</div>}
      <Tarjeta className="plantillas-tarjeta">
        <TablaPlantillas
          plantillas={plantillas}
          cargando={cargando}
          accionVacia={botonNuevo}
          onAbrir={(version) => abrir(version.id_version)}
          onNuevaVersion={nuevaVersion}
          onEliminar={setPorEliminar}
        />
      </Tarjeta>
    </>
  );

  return (
    <section className="plantillas" aria-labelledby="plantillas-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Desempeño" }]}
        enlace={Link}
        titulo="Plantillas de evaluación"
        idTitulo="plantillas-titulo"
        descripcion="Secciones por competencia, criterios, preguntas ponderadas y escalas de valoración. Una versión publicada no se modifica."
      />

      {alerta && (
        <Alerta tono="peligro" role="alert" titulo={alerta.titulo} onCerrar={() => setAlerta(null)}>
          {alerta.texto}
        </Alerta>
      )}

      <Pestanas
        etiqueta="Configuración de evaluaciones"
        activa={pestana}
        onCambiar={setPestana}
        pestanas={[
          { id: "plantillas", etiqueta: "Plantillas", contenido: listaPlantillas },
          { id: "escalas", etiqueta: "Escalas de valoración", contenido: <PanelEscalas /> },
        ]}
      />

      <ModalConfirmacion
        abierto={Boolean(porEliminar)}
        titulo="¿Eliminar el borrador?"
        textoConfirmar="Eliminar"
        procesando={eliminando}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setPorEliminar(null)}
      >
        Se eliminará el borrador <strong>{porEliminar?.nombre}</strong> (versión {porEliminar?.numero_version}) con sus
        secciones, criterios y preguntas. Esta acción no se puede deshacer.
        {porEliminar?.numero_version === 1 && " Como es la única versión, también se eliminará la plantilla."}
      </ModalConfirmacion>
    </section>
  );
}
