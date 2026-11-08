import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Ruler, Trash2 } from "lucide-react";
import { eliminarEscala, listarEscalas } from "../../api/plantillasEvaluacion";
import { Alerta, Boton, EstadoVacio, Etiqueta, ModalConfirmacion, Tabla, Tarjeta, useAvisos } from "../../components/ui";
import ModalEscala from "./ModalEscala";
import { describirNiveles, TIPOS_ESCALA } from "./plantilla";
import "./escalas.css";

const nombreTipo = (tipo) => TIPOS_ESCALA.find((t) => t.valor === tipo)?.etiqueta ?? tipo;

const COLUMNAS = ({ onEditar, onEliminar }) => [
  {
    clave: "nombre",
    titulo: "Nombre",
    celda: (escala) => (
      <button type="button" className="plantillas-enlace ds-foco" onClick={() => onEditar(escala)}>
        {escala.nombre}
      </button>
    ),
  },
  { clave: "tipo", titulo: "Tipo", ancho: "13%", celda: (escala) => nombreTipo(escala.tipo) },
  {
    clave: "niveles",
    titulo: "Niveles",
    celda: (escala) => <span className="plantillas-niveles-resumen">{describirNiveles(escala)}</span>,
  },
  {
    clave: "uso",
    titulo: "Uso",
    ancho: "13%",
    celda: (escala) =>
      escala.en_uso_publicado ? (
        <Etiqueta tono="exito">Publicada</Etiqueta>
      ) : escala.en_uso ? (
        <Etiqueta tono="aviso">En borradores</Etiqueta>
      ) : (
        <Etiqueta>Sin uso</Etiqueta>
      ),
  },
  {
    clave: "acciones",
    titulo: <span className="ds-solo-lector">Acciones</span>,
    celda: (escala) => (
      <div className="plantillas-acciones">
        <Boton
          variante="sutil"
          soloIcono
          icono={Pencil}
          aria-label={`Editar ${escala.nombre}`}
          title="Editar"
          onClick={() => onEditar(escala)}
        />
        {!escala.en_uso && (
          <Boton
            variante="sutil"
            soloIcono
            icono={Trash2}
            aria-label={`Eliminar ${escala.nombre}`}
            title="Eliminar escala"
            onClick={() => onEliminar(escala)}
          />
        )}
      </div>
    ),
  },
];

// Catálogo de escalas de valoración que usan las preguntas de todas las plantillas.
// idEmpleado: usuario de prueba de la barra lateral; viaja en X-Empleado-Id.
export default function PanelEscalas({ idEmpleado }) {
  const avisar = useAvisos();
  const [escalas, setEscalas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [alerta, setAlerta] = useState(null);
  // undefined: modal cerrado; null: escala nueva; objeto: escala a editar.
  const [editando, setEditando] = useState(undefined);
  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(
    () =>
      listarEscalas(idEmpleado)
        .then((lista) => {
          setEscalas(lista);
          setErrorCarga(null);
        })
        .catch((error) => setErrorCarga(error.message))
        .finally(() => setCargando(false)),
    [idEmpleado]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardada = async (escala, editada) => {
    setEditando(undefined);
    await cargar();
    avisar({ tono: "exito", titulo: editada ? "Escala actualizada" : "Escala creada", mensaje: escala.nombre });
  };

  const confirmarEliminacion = async () => {
    const escala = porEliminar;
    setEliminando(true);
    try {
      await eliminarEscala(idEmpleado, escala.id_escala);
      await cargar();
      avisar({ tono: "exito", titulo: "Escala eliminada", mensaje: escala.nombre });
    } catch (error) {
      setAlerta({ titulo: `No se pudo eliminar «${escala.nombre}»`, texto: error.message });
    } finally {
      setEliminando(false);
      setPorEliminar(null);
    }
  };

  const botonNueva = (
    <Boton variante="primario" icono={Plus} onClick={() => setEditando(null)}>
      Nueva escala
    </Boton>
  );

  if (errorCarga) {
    return (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudieron cargar las escalas"
        acciones={
          <Boton tamano="sm" onClick={cargar}>
            Reintentar
          </Boton>
        }
      >
        {errorCarga}
      </Alerta>
    );
  }

  return (
    <>
      {alerta && (
        <Alerta tono="peligro" role="alert" titulo={alerta.titulo} onCerrar={() => setAlerta(null)}>
          {alerta.texto}
        </Alerta>
      )}
      <div className="plantillas-barra">
        <p className="plantilla-nota">
          Escalas cuantitativas y cualitativas con la etiqueta de cada nivel. Las preguntas de las plantillas eligen una
          de estas escalas.
        </p>
        {escalas.length > 0 && botonNueva}
      </div>
      <Tarjeta className="plantillas-tarjeta">
        <Tabla
          className="plantillas-tabla"
          descripcion="Escalas de valoración"
          columnas={COLUMNAS({ onEditar: setEditando, onEliminar: setPorEliminar })}
          filas={escalas}
          claveFila="id_escala"
          cargando={cargando}
          filasCargando={2}
          vacio={
            <EstadoVacio
              icono={Ruler}
              titulo="Aún no hay escalas de valoración"
              mensaje="Cree una escala, por ejemplo una Likert de 1 a 5 con la etiqueta de cada nivel."
              accion={botonNueva}
            />
          }
        />
      </Tarjeta>

      {editando !== undefined && (
        <ModalEscala
          key={editando?.id_escala ?? "nueva"}
          escala={editando}
          idEmpleado={idEmpleado}
          onGuardada={guardada}
          onCerrar={() => setEditando(undefined)}
        />
      )}

      <ModalConfirmacion
        abierto={Boolean(porEliminar)}
        titulo="¿Eliminar la escala?"
        textoConfirmar="Eliminar"
        procesando={eliminando}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setPorEliminar(null)}
      >
        Se eliminará la escala <strong>{porEliminar?.nombre}</strong> con sus niveles. Esta acción no se puede deshacer.
      </ModalConfirmacion>
    </>
  );
}
