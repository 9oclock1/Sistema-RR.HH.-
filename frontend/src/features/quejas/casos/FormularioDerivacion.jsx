import { useMemo, useRef, useState } from "react";
import { Save, Send } from "lucide-react";
import { clasificarCasoQueja, derivarCasoQueja } from "../../../api/casosQueja";
import { Alerta, Boton, CampoAreaTexto, Selector, Tarjeta, useAvisos } from "../../../components/ui";
import {
  COMENTARIO_MAX,
  esConflictoInteres,
  idsEnConflicto,
  MOTIVOS_RESPONSABLE,
  nombreDe,
  validarDerivacion,
} from "./casos";

const opcionesDe = (lista, id) => lista.map((item) => ({ valor: String(item[id]), etiqueta: item.nombre }));

function erroresDelServidor(error) {
  return Object.fromEntries((error.detalles ?? []).filter((d) => d.campo).map((d) => [d.campo, d.mensaje]));
}

export default function FormularioDerivacion({ caso, sesion, catalogos, responsables, deshabilitado, onActualizado }) {
  const avisar = useAvisos();
  const [idCategoria, setIdCategoria] = useState(String(caso.categoria.id));
  const [idPrioridad, setIdPrioridad] = useState(caso.prioridad ? String(caso.prioridad.id) : "");
  const [idResponsable, setIdResponsable] = useState("");
  const [comentario, setComentario] = useState("");
  const [errores, setErrores] = useState({});
  const [accion, setAccion] = useState(null);
  const [conflictoServidor, setConflictoServidor] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const refConflicto = useRef(null);

  const enConflicto = useMemo(() => idsEnConflicto(caso), [caso]);
  const conflicto = Boolean(idResponsable) && (enConflicto.has(idResponsable) || conflictoServidor);
  const idActual = caso.responsable?.id_empleado;
  const idDenunciante = caso.denunciante?.id_empleado;

  const opcionesResponsable = useMemo(
    () =>
      (responsables.lista ?? []).map((persona) => {
        const partes = [persona.nombre_completo, persona.cargo].filter(Boolean).join(" · ");
        const marcas = [
          MOTIVOS_RESPONSABLE[persona.motivo],
          enConflicto.has(persona.id_empleado) &&
            (persona.id_empleado === idDenunciante ? "presentó la queja" : "involucrado"),
          persona.id_empleado === idActual && "responsable actual",
        ].filter(Boolean);
        return {
          valor: persona.id_empleado,
          etiqueta: `${partes} (${marcas.join(", ")})`,
          deshabilitada: persona.id_empleado === idActual,
        };
      }),
    [responsables.lista, enConflicto, idActual, idDenunciante],
  );

  const datos = { idCategoria, idPrioridad, idResponsable, comentario };

  const fallar = (error) => {
    if (esConflictoInteres(error)) {
      setConflictoServidor(true);
      refConflicto.current?.focus();
      return;
    }
    const delServidor = erroresDelServidor(error);
    if (Object.keys(delServidor).length > 0) setErrores(delServidor);
    else setErrorGeneral(error.message);
  };

  const ejecutar = async (tipo, conResponsable, tarea) => {
    setErrorGeneral(null);
    const encontrados = validarDerivacion(datos, { conResponsable });
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;
    if (conResponsable && conflicto) {
      refConflicto.current?.focus();
      return;
    }
    setAccion(tipo);
    try {
      await tarea();
      onActualizado();
    } catch (error) {
      fallar(error);
    } finally {
      setAccion(null);
    }
  };

  const clasificar = () =>
    ejecutar("clasificar", false, async () => {
      await clasificarCasoQueja(sesion, caso.id_queja, { idCategoria, idPrioridad });
      avisar({ tono: "exito", titulo: "Clasificación guardada", mensaje: `Queja ${caso.codigo_seguimiento}.` });
    });

  const derivar = (evento) => {
    evento.preventDefault();
    return ejecutar("derivar", true, async () => {
      const resultado = await derivarCasoQueja(sesion, caso.id_queja, {
        idCategoria,
        idPrioridad,
        idResponsable,
        comentario: comentario.trim() || undefined,
      });
      avisar({
        tono: "exito",
        titulo: "Caso derivado",
        mensaje: `Se derivó la queja a ${nombreDe(resultado.responsable)}.`,
      });
      if (resultado.notificacion.estado !== "ENTREGADO") {
        avisar({
          tono: "aviso",
          titulo: "No se pudo avisar al responsable",
          mensaje: "La derivación quedó registrada. Reintente el aviso en «Derivaciones».",
        });
      }
    });
  };

  const cambiarResponsable = (evento) => {
    setIdResponsable(evento.target.value);
    setConflictoServidor(false);
  };

  const bloqueado = deshabilitado || accion !== null;

  return (
    <Tarjeta nivelTitulo={2} titulo="Clasificación y derivación" className="qc-tarjeta">
      <form className="qc-formulario" onSubmit={derivar} noValidate>
        <div className="qc-formulario__fila">
          <Selector
            etiqueta="Categoría"
            requerido
            value={idCategoria}
            onChange={(e) => setIdCategoria(e.target.value)}
            opciones={opcionesDe(catalogos.categorias, "id_categoria_queja")}
            error={errores.id_categoria_queja}
            disabled={bloqueado}
          />
          <Selector
            etiqueta="Prioridad"
            requerido
            value={idPrioridad}
            onChange={(e) => setIdPrioridad(e.target.value)}
            opciones={opcionesDe(catalogos.prioridades, "id_prioridad_queja")}
            textoVacio="Seleccione la prioridad"
            error={errores.id_prioridad_queja}
            disabled={bloqueado}
          />
        </div>

        <Selector
          etiqueta={idActual ? "Nuevo responsable" : "Responsable"}
          requerido
          ayuda="Personal de RRHH o supervisores. No puede ser alguien involucrado en la queja."
          value={idResponsable}
          onChange={cambiarResponsable}
          opciones={opcionesResponsable}
          textoVacio={responsables.cargando ? "Cargando responsables…" : "Seleccione al responsable"}
          error={errores.id_empleado_responsable}
          disabled={bloqueado || !responsables.lista}
        />

        {responsables.error && (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudo cargar la lista de responsables"
            acciones={
              <Boton tamano="sm" onClick={responsables.reintentar}>
                Reintentar
              </Boton>
            }
          >
            {responsables.error}
          </Alerta>
        )}

        {conflicto && (
          <Alerta ref={refConflicto} tabIndex={-1} tono="peligro" role="alert" titulo="Conflicto de interés">
            {idResponsable === idDenunciante
              ? "La persona elegida presentó esta queja, así que no puede atenderla."
              : "La persona elegida está involucrada en esta queja, así que no puede atenderla."}{" "}
            Derive el caso a otra persona.
          </Alerta>
        )}

        <CampoAreaTexto
          etiqueta="Comentario para el expediente"
          ayuda={`Opcional, hasta ${COMENTARIO_MAX} caracteres. No se envía en el aviso al responsable.`}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          error={errores.comentario}
          filas={3}
          maxLength={COMENTARIO_MAX}
          disabled={bloqueado}
        />

        {errorGeneral && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo guardar">
            {errorGeneral}
          </Alerta>
        )}

        <div className="qc-acciones">
          <Boton
            type="submit"
            variante="primario"
            icono={Send}
            cargando={accion === "derivar"}
            disabled={bloqueado || conflicto}
          >
            {idActual ? "Reasignar caso" : "Derivar caso"}
          </Boton>
          <Boton icono={Save} onClick={clasificar} cargando={accion === "clasificar"} disabled={bloqueado}>
            Guardar solo la clasificación
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
