import { Boton, CampoAreaTexto, CampoTexto, Modal, Selector } from "../../components/ui";
import useFormularioPlantilla from "./useFormularioPlantilla";
import { validarDatosPlantilla } from "./validacionPlantilla";

const ETIQUETAS = {
  nombre: "Nombre",
  id_departamento: "Área destino",
  objetivo: "Objetivo",
  vigencia_desde: "Vigente desde",
  vigencia_hasta: "Vigente hasta",
};

const desdePlantilla = (plantilla) => ({
  nombre: plantilla?.nombre ?? "",
  id_departamento: plantilla?.area.id_departamento ?? "",
  objetivo: plantilla?.objetivo ?? "",
  vigencia_desde: plantilla?.vigencia_desde ?? "",
  vigencia_hasta: plantilla?.vigencia_hasta ?? "",
});

const ID_FORMULARIO = "plantilla-formulario";

// Datos base de la plantilla: nombre, área destino, objetivo y vigencia. La estructura se arma aparte, por versión.
export default function FormularioPlantilla({ plantilla, departamentos, errorAreas, onGuardar, onCancelar }) {
  const editando = Boolean(plantilla);
  const { enviar, enviando, propsCampo, resumen } = useFormularioPlantilla({
    inicial: desdePlantilla(plantilla),
    etiquetas: ETIQUETAS,
    prefijo: "plantilla",
    onGuardar,
    validar: validarDatosPlantilla,
    tituloConflicto: "Ya existe una plantilla igual",
  });

  const opcionesArea = departamentos.map((d) => ({ valor: d.id_departamento, etiqueta: d.nombre }));
  // Un área dada de baja después de crear la plantilla sigue a la vista para no dejar el campo en blanco.
  if (plantilla && !opcionesArea.some((o) => o.valor === plantilla.area.id_departamento)) {
    opcionesArea.push({ valor: plantilla.area.id_departamento, etiqueta: plantilla.area.nombre });
  }

  return (
    <Modal
      abierto
      titulo={editando ? "Editar plantilla" : "Nueva plantilla de evaluación"}
      onCerrar={onCancelar}
      bloqueado={enviando}
      pie={
        <>
          <Boton variante="sutil" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form={ID_FORMULARIO} cargando={enviando}>
            {enviando ? "Guardando…" : "Guardar"}
          </Boton>
        </>
      }
    >
      <form id={ID_FORMULARIO} className="pl-formulario" onSubmit={enviar} noValidate>
        {resumen}

        <div className="pl-formulario__campos">
          <CampoTexto
            {...propsCampo("nombre")}
            className="pl-formulario__ancho"
            requerido
            maxLength={120}
            autoComplete="off"
            ayuda="Dos plantillas del mismo área no pueden tener el mismo nombre en periodos que se cruzan."
            data-autofocus
          />
          <Selector
            {...propsCampo("id_departamento")}
            className="pl-formulario__ancho"
            requerido
            textoVacio="Seleccione…"
            opciones={opcionesArea}
            error={propsCampo("id_departamento").error ?? (errorAreas ? "No se pudieron cargar las áreas." : undefined)}
          />
          <CampoAreaTexto
            {...propsCampo("objetivo")}
            className="pl-formulario__ancho"
            requerido
            filas={3}
            maxLength={1000}
            ayuda="Qué se quiere medir con esta evaluación."
          />
          <CampoTexto {...propsCampo("vigencia_desde")} type="date" requerido />
          <CampoTexto {...propsCampo("vigencia_hasta")} type="date" requerido />
        </div>

        <p className="pl-nota">
          {editando
            ? "Los datos base solo se pueden cambiar mientras la plantilla no se haya publicado."
            : "La plantilla se guarda como borrador. Podrá definir sus secciones y publicarla después."}
        </p>
      </form>
    </Modal>
  );
}
