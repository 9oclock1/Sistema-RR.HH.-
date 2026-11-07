import { useState } from "react";
import { crearCompetencia } from "../../api/plantillasEvaluacion";
import { Alerta, Boton, CampoTexto, Modal, Selector } from "../../components/ui";
import { TIPOS_COMPETENCIA } from "./plantilla";

const VACIA = { nombre: "", descripcion: "", tipo: "COMPETENCIA_LABORAL" };

// Agrega una competencia al catálogo común; onCreada recibe la competencia guardada.
export default function ModalCompetencia({ abierto, onCreada, onCerrar }) {
  const [datos, setDatos] = useState(VACIA);
  const [errores, setErrores] = useState({});
  const [alerta, setAlerta] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cerrar = () => {
    setDatos(VACIA);
    setErrores({});
    setAlerta(null);
    onCerrar();
  };

  const cambiar = (campo) => (evento) => {
    setDatos((actual) => ({ ...actual, [campo]: evento.target.value }));
    setErrores((actuales) => Object.fromEntries(Object.entries(actuales).filter(([c]) => c !== campo)));
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setAlerta(null);
    try {
      const competencia = await crearCompetencia(datos);
      setDatos(VACIA);
      setErrores({});
      onCreada(competencia);
    } catch (error) {
      const porCampo = Object.fromEntries((error.detalles ?? []).map((d) => [d.campo, d.mensaje]));
      setErrores(porCampo);
      if (Object.keys(porCampo).length === 0) setAlerta(error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      titulo="Nueva competencia"
      onCerrar={cerrar}
      bloqueado={guardando}
      pie={
        <>
          <Boton onClick={cerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form="form-competencia" cargando={guardando}>
            Crear competencia
          </Boton>
        </>
      }
    >
      <form id="form-competencia" className="plantilla-campos" onSubmit={guardar} noValidate>
        {alerta && (
          <Alerta tono="peligro" role="alert">
            {alerta}
          </Alerta>
        )}
        <p className="plantilla-nota">
          Las competencias son comunes a todas las plantillas, para comparar resultados entre versiones y ciclos.
        </p>
        <CampoTexto
          id="competencia-nombre"
          etiqueta="Nombre"
          requerido
          maxLength={100}
          autoComplete="off"
          data-autofocus
          value={datos.nombre}
          onChange={cambiar("nombre")}
          error={errores.nombre}
        />
        <Selector
          id="competencia-tipo"
          etiqueta="Tipo"
          requerido
          opciones={TIPOS_COMPETENCIA}
          value={datos.tipo}
          onChange={cambiar("tipo")}
          error={errores.tipo}
        />
        <CampoTexto
          id="competencia-descripcion"
          etiqueta="Descripción"
          maxLength={255}
          value={datos.descripcion}
          onChange={cambiar("descripcion")}
          error={errores.descripcion}
        />
      </form>
    </Modal>
  );
}
