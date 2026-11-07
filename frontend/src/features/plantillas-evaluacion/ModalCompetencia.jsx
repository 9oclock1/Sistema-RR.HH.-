import { Boton, CampoAreaTexto, CampoTexto, Modal, Selector } from "../../components/ui";
import { OPCIONES_TIPO_COMPETENCIA } from "./formato";
import useFormularioPlantilla from "./useFormularioPlantilla";

const ETIQUETAS = {
  nombre: "Nombre",
  tipo: "Tipo",
  descripcion: "Descripción",
};

const ID_FORMULARIO = "competencia-formulario";

// Alta de una competencia laboral o un factor operativo en el catálogo común a todas las plantillas.
export default function ModalCompetencia({ onGuardar, onCancelar }) {
  const { enviar, enviando, propsCampo, resumen } = useFormularioPlantilla({
    inicial: { nombre: "", tipo: "", descripcion: "" },
    etiquetas: ETIQUETAS,
    prefijo: "competencia",
    onGuardar,
  });

  return (
    <Modal
      abierto
      titulo="Nueva competencia o factor"
      tamano="sm"
      onCerrar={onCancelar}
      bloqueado={enviando}
      pie={
        <>
          <Boton variante="sutil" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form={ID_FORMULARIO} cargando={enviando}>
            {enviando ? "Guardando…" : "Crear y agregar"}
          </Boton>
        </>
      }
    >
      <form id={ID_FORMULARIO} className="pl-formulario" onSubmit={enviar} noValidate>
        {resumen}
        <CampoTexto {...propsCampo("nombre")} requerido maxLength={100} autoComplete="off" data-autofocus />
        <Selector
          {...propsCampo("tipo")}
          requerido
          textoVacio="Seleccione…"
          opciones={OPCIONES_TIPO_COMPETENCIA}
          ayuda="Una competencia laboral mide el desempeño de la persona; un factor operativo, el rendimiento del puesto."
        />
        <CampoAreaTexto {...propsCampo("descripcion")} filas={2} maxLength={255} ayuda="Opcional." />
      </form>
    </Modal>
  );
}
