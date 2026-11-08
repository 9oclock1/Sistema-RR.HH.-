import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { actualizarEscala, crearEscala } from "../../api/plantillasEvaluacion";
import { Alerta, Boton, CampoTexto, Modal, Selector } from "../../components/ui";
import { escalaADatos, escalaAFormulario, nuevaEscala, nuevoNivel, TIPOS_ESCALA } from "./plantilla";

const MIN_NIVELES = 2;
const MAX_NIVELES = 10;

const sinCampos = (errores, quitar) => Object.fromEntries(Object.entries(errores).filter(([campo]) => !quitar(campo)));

// Se monta al abrirse (con una key por escala), así el formulario parte de la escala indicada.
// escala: la escala a editar, o null para crear una. onGuardada recibe la escala guardada.
export default function ModalEscala({ escala, idEmpleado, onGuardada, onCerrar }) {
  const [formulario, setFormulario] = useState(() => (escala ? escalaAFormulario(escala) : nuevaEscala()));
  const [errores, setErrores] = useState({});
  const [alerta, setAlerta] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Una escala usada en una plantilla publicada conserva su tipo y sus niveles.
  const nivelesFijos = Boolean(escala?.en_uso_publicado);

  const cambiar = (campo) => (evento) => {
    setFormulario((actual) => ({ ...actual, [campo]: evento.target.value }));
    setErrores((actuales) => sinCampos(actuales, (c) => c === campo));
  };

  const cambiarNivel = (indice, campo) => (evento) => {
    setFormulario((actual) => ({
      ...actual,
      niveles: actual.niveles.map((n, i) => (i === indice ? { ...n, [campo]: evento.target.value } : n)),
    }));
    setErrores((actuales) => sinCampos(actuales, (c) => c === `niveles[${indice}].${campo}` || c === "niveles"));
  };

  // Agregar o quitar niveles desplaza los índices de los errores: se limpian todos los de niveles.
  const sinErroresDeNiveles = () => setErrores((actuales) => sinCampos(actuales, (c) => c.startsWith("niveles")));

  const agregarNivel = () => {
    setFormulario((actual) => ({ ...actual, niveles: [...actual.niveles, nuevoNivel(actual.niveles)] }));
    sinErroresDeNiveles();
  };

  const quitarNivel = (indice) => {
    setFormulario((actual) => ({ ...actual, niveles: actual.niveles.filter((_, i) => i !== indice) }));
    sinErroresDeNiveles();
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setAlerta(null);
    try {
      const datos = escalaADatos(formulario);
      const guardada = escala ? await actualizarEscala(idEmpleado, escala.id_escala, datos) : await crearEscala(idEmpleado, datos);
      onGuardada(guardada, Boolean(escala));
    } catch (error) {
      const porCampo = Object.fromEntries((error.detalles ?? []).map((d) => [d.campo, d.mensaje]));
      setErrores(porCampo);
      setAlerta(Object.keys(porCampo).length > 0 ? "Revise los campos marcados." : error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto
      titulo={escala ? `Editar «${escala.nombre}»` : "Nueva escala de valoración"}
      onCerrar={onCerrar}
      bloqueado={guardando}
      pie={
        <>
          <Boton onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form="form-escala" cargando={guardando}>
            {escala ? "Guardar cambios" : "Crear escala"}
          </Boton>
        </>
      }
    >
      <form id="form-escala" className="plantilla-campos" onSubmit={guardar} noValidate>
        {alerta && (
          <Alerta tono="peligro" role="alert">
            {alerta}
          </Alerta>
        )}
        {nivelesFijos && (
          <Alerta tono="info" titulo="La escala se usa en una plantilla publicada.">
            Solo puede cambiar su nombre y descripción. Para otros niveles, cree una escala nueva.
          </Alerta>
        )}
        <CampoTexto
          id="escala-nombre"
          etiqueta="Nombre"
          requerido
          maxLength={80}
          autoComplete="off"
          data-autofocus
          value={formulario.nombre}
          onChange={cambiar("nombre")}
          error={errores.nombre}
        />
        <CampoTexto
          id="escala-descripcion"
          etiqueta="Descripción"
          maxLength={255}
          value={formulario.descripcion}
          onChange={cambiar("descripcion")}
          error={errores.descripcion}
        />
        <Selector
          id="escala-tipo"
          etiqueta="Tipo de escala"
          requerido
          opciones={TIPOS_ESCALA}
          value={formulario.tipo}
          onChange={cambiar("tipo")}
          error={errores.tipo}
          disabled={nivelesFijos}
          ayuda="Cuantitativa: niveles numéricos (p. ej. Likert de 1 a 5). Cualitativa: niveles con nombre."
        />

        <fieldset className="plantilla-niveles" disabled={nivelesFijos}>
          <legend className="plantilla-niveles__titulo">Niveles, del más bajo al más alto</legend>
          <p className="plantilla-niveles__ayuda">
            El evaluador ve la etiqueta; el valor se usa para calcular el puntaje (valor ÷ valor máximo × 100).
          </p>
          {errores.niveles && (
            <p className="plantilla-error" role="alert">
              {errores.niveles}
            </p>
          )}
          <div className="plantilla-nivel plantilla-nivel--encabezado" aria-hidden="true">
            <span className="plantilla-nivel__numero">Valor</span>
            <span className="plantilla-nivel__etiqueta">Etiqueta</span>
          </div>
          <ol className="plantilla-niveles__lista">
            {formulario.niveles.map((nivel, indice) => (
              <li key={nivel.clave} className="plantilla-nivel">
                <CampoTexto
                  id={`niveles[${indice}].valor`}
                  aria-label={`Valor del nivel ${indice + 1}`}
                  className="plantilla-nivel__numero"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={nivel.valor}
                  onChange={cambiarNivel(indice, "valor")}
                  error={errores[`niveles[${indice}].valor`]}
                />
                <CampoTexto
                  id={`niveles[${indice}].etiqueta`}
                  aria-label={`Etiqueta del nivel ${indice + 1}`}
                  className="plantilla-nivel__etiqueta"
                  required
                  maxLength={60}
                  value={nivel.etiqueta}
                  onChange={cambiarNivel(indice, "etiqueta")}
                  error={errores[`niveles[${indice}].etiqueta`]}
                />
                {!nivelesFijos && (
                  <Boton
                    variante="sutil"
                    soloIcono
                    icono={Trash2}
                    className="plantilla-nivel__quitar"
                    aria-label={`Quitar nivel ${indice + 1}`}
                    title="Quitar nivel"
                    onClick={() => quitarNivel(indice)}
                    disabled={formulario.niveles.length <= MIN_NIVELES}
                  />
                )}
              </li>
            ))}
          </ol>
          {!nivelesFijos && (
            <Boton
              variante="sutil"
              tamano="sm"
              icono={Plus}
              onClick={agregarNivel}
              disabled={formulario.niveles.length >= MAX_NIVELES}
            >
              Agregar nivel
            </Boton>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
