import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { MoonStar, Plus } from "lucide-react";
import { cambiarEstadoConcepto } from "../../api/conceptos";
import { actualizarCondicion, crearCondicion, eliminarCondicion, listarCondiciones } from "../../api/condiciones";
import {
  Alerta,
  Boton,
  EncabezadoPagina,
  EstadoVacio,
  ModalConfirmacion,
  Pestanas,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import VigenciasModal from "../conceptos/VigenciasModal";
import AsignacionesModal from "./AsignacionesModal";
import BonosPeriodo from "./BonosPeriodo";
import CondicionFormulario from "./CondicionFormulario";
import TablaCondiciones from "./TablaCondiciones";
import "../conceptos/conceptos.css";
import "./condiciones.css";

export default function CondicionesPage() {
  const avisar = useAvisos();
  const [pestana, setPestana] = useState("condiciones");
  const [condiciones, setCondiciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [alerta, setAlerta] = useState(null);
  const [formulario, setFormulario] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [asignando, setAsignando] = useState(null);
  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(
    () =>
      listarCondiciones()
        .then((lista) => {
          setCondiciones(lista);
          setErrorCarga(null);
        })
        .catch((error) => setErrorCarga(error.message))
        .finally(() => setCargando(false)),
    []
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const reintentar = () => {
    setCargando(true);
    setErrorCarga(null);
    cargar();
  };

  const abrirFormulario = (condicion) => {
    setAlerta(null);
    setFormulario({ condicion });
  };

  const guardar = async ({ esta_activo, ...datos }) => {
    const { condicion } = formulario;
    if (condicion) {
      await actualizarCondicion(condicion.id_condicion, datos);
      if (esta_activo !== condicion.esta_activo) await cambiarEstadoConcepto(condicion.id_concepto, esta_activo);
    } else {
      await crearCondicion(datos);
    }
    setFormulario(null);
    await cargar();
    avisar({
      tono: "exito",
      titulo: condicion ? "Condición actualizada" : "Condición creada",
      mensaje: `${datos.codigo.trim().toUpperCase()}: ${datos.nombre.trim()}`,
    });
  };

  const inactivar = async (condicion) => {
    setAlerta(null);
    try {
      await cambiarEstadoConcepto(condicion.id_concepto, false);
      await cargar();
      avisar({ tono: "exito", titulo: "Condición inactivada", mensaje: condicion.codigo });
    } catch (error) {
      setAlerta({ titulo: "No se pudo inactivar la condición", texto: error.message });
    }
  };

  const confirmarEliminacion = async () => {
    const condicion = porEliminar;
    setEliminando(true);
    try {
      await eliminarCondicion(condicion.id_condicion);
      await cargar();
      avisar({ tono: "exito", titulo: "Condición eliminada", mensaje: condicion.codigo });
    } catch (error) {
      const puedeInactivar = error.estado === 409 && condicion.esta_activo;
      setAlerta({
        titulo: `No se pudo eliminar ${condicion.codigo}`,
        texto: error.message,
        accion: puedeInactivar ? { texto: "Inactivar condición", ejecutar: () => inactivar(condicion) } : null,
      });
    } finally {
      setEliminando(false);
      setPorEliminar(null);
    }
  };

  const botonNueva = (
    <Boton variante="primario" icono={Plus} onClick={() => abrirFormulario(null)}>
      Nueva condición
    </Boton>
  );

  const tabla = (
    <TablaCondiciones
      condiciones={condiciones}
      cargando={cargando}
      vacio={
        <EstadoVacio
          icono={MoonStar}
          titulo="Aún no hay condiciones especiales"
          mensaje="Registre bonos por trasnoche, feriados trabajados o áreas como congelados."
          accion={botonNueva}
        />
      }
      onAsignar={setAsignando}
      onHistorial={setHistorial}
      onEditar={abrirFormulario}
      onEliminar={setPorEliminar}
    />
  );

  return (
    <section className="conceptos" aria-labelledby="condiciones-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Planillas" }]}
        enlace={Link}
        titulo="Bonos por condiciones especiales"
        idTitulo="condiciones-titulo"
        descripcion="Trasnoches y feriados trabajados se detectan de las jornadas marcadas; las demás condiciones se asignan por colaborador."
        acciones={!errorCarga && condiciones.length > 0 && botonNueva}
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
          titulo="No se pudieron cargar las condiciones"
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
          <Pestanas
            etiqueta="Condiciones y bonos"
            activa={pestana}
            onCambiar={setPestana}
            pestanas={[
              {
                id: "condiciones",
                etiqueta: "Condiciones",
                contador: cargando ? undefined : condiciones.length,
                contenido: tabla,
              },
              {
                id: "bonos",
                etiqueta: "Bonos del periodo",
                contenido: <BonosPeriodo hayCondiciones={condiciones.some((c) => c.esta_activo)} />,
              },
            ]}
          />
        </Tarjeta>
      )}

      {formulario && (
        <CondicionFormulario
          key={formulario.condicion?.id_condicion ?? "nueva"}
          condicion={formulario.condicion}
          onGuardar={guardar}
          onCancelar={() => setFormulario(null)}
        />
      )}

      {historial && (
        <VigenciasModal
          key={historial.id_condicion}
          concepto={historial}
          onCerrar={() => setHistorial(null)}
          onRegistrada={cargar}
        />
      )}

      {asignando && (
        <AsignacionesModal
          key={asignando.id_condicion}
          condicion={asignando}
          onCerrar={() => setAsignando(null)}
          onCambio={cargar}
        />
      )}

      <ModalConfirmacion
        abierto={Boolean(porEliminar)}
        titulo="¿Eliminar la condición?"
        textoConfirmar="Eliminar"
        procesando={eliminando}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setPorEliminar(null)}
      >
        Se eliminará <strong>{porEliminar?.codigo}</strong> con su historial de valores y sus asignaciones. Si ya tiene
        bonos procesados, solo podrá inactivarse.
      </ModalConfirmacion>
    </section>
  );
}
