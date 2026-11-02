import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { crearVersionPlantilla, eliminarPlantilla, listarPlantillas } from "../../api/plantillasEvaluacion";
import { Alerta, Boton, EncabezadoPagina, ModalConfirmacion, Tarjeta, useAvisos } from "../../components/ui";
import EditorPlantilla from "./EditorPlantilla";
import TablaPlantillas from "./TablaPlantillas";
import "./plantillasEvaluacion.css";

export default function PlantillasEvaluacionPage() {
  const avisar = useAvisos();
  const [plantillas, setPlantillas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [alerta, setAlerta] = useState(null);
  // null: lista; { id }: editor (id null para una plantilla nueva).
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

  const nuevaVersion = async (plantilla) => {
    setAlerta(null);
    try {
      const borrador = await crearVersionPlantilla(plantilla.id_plantilla);
      abrir(borrador.id_plantilla);
      avisar({ tono: "exito", titulo: `Versión ${borrador.version} en borrador`, mensaje: borrador.nombre });
    } catch (error) {
      setAlerta({ titulo: "No se pudo crear la nueva versión", texto: error.message });
    }
  };

  const confirmarEliminacion = async () => {
    const plantilla = porEliminar;
    setEliminando(true);
    try {
      await eliminarPlantilla(plantilla.id_plantilla);
      await cargar();
      avisar({ tono: "exito", titulo: "Borrador eliminado", mensaje: plantilla.nombre });
    } catch (error) {
      setAlerta({ titulo: `No se pudo eliminar «${plantilla.nombre}»`, texto: error.message });
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
        onAbrir={abrir}
        onVolver={() => setAbierta(null)}
      />
    );
  }

  const botonNuevo = (
    <Boton variante="primario" icono={Plus} onClick={() => abrir(null)}>
      Nueva plantilla
    </Boton>
  );

  return (
    <section className="plantillas" aria-labelledby="plantillas-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Desempeño" }]}
        enlace={Link}
        titulo="Plantillas de evaluación"
        idTitulo="plantillas-titulo"
        descripcion="Criterios, preguntas ponderadas y escalas de valoración. Una versión publicada no se modifica."
        acciones={!errorCarga && plantillas.length > 0 && botonNuevo}
      />

      {alerta && (
        <Alerta tono="peligro" role="alert" titulo={alerta.titulo} onCerrar={() => setAlerta(null)}>
          {alerta.texto}
        </Alerta>
      )}

      {errorCarga ? (
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
        <Tarjeta className="plantillas-tarjeta">
          <TablaPlantillas
            plantillas={plantillas}
            cargando={cargando}
            accionVacia={botonNuevo}
            onAbrir={(plantilla) => abrir(plantilla.id_plantilla)}
            onNuevaVersion={nuevaVersion}
            onEliminar={setPorEliminar}
          />
        </Tarjeta>
      )}

      <ModalConfirmacion
        abierto={Boolean(porEliminar)}
        titulo="¿Eliminar el borrador?"
        textoConfirmar="Eliminar"
        procesando={eliminando}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setPorEliminar(null)}
      >
        Se eliminará el borrador <strong>{porEliminar?.nombre}</strong> (versión {porEliminar?.version}) con sus criterios y
        preguntas. Esta acción no se puede deshacer.
      </ModalConfirmacion>
    </section>
  );
}
