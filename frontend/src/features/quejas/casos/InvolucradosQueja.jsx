import { useMemo, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { quitarInvolucradoQueja, registrarInvolucradoQueja } from "../../../api/casosQueja";
import { Alerta, Avatar, Boton, ModalConfirmacion, Selector, Tarjeta, useAvisos } from "../../../components/ui";
import { formatearFechaCorta, nombreDe } from "./casos";

export default function InvolucradosQueja({ caso, sesion, empleados, deshabilitado, onActualizado }) {
  const avisar = useAvisos();
  const [idEmpleado, setIdEmpleado] = useState("");
  const [error, setError] = useState(null);
  const [errorCampo, setErrorCampo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [aQuitar, setAQuitar] = useState(null);
  const [quitando, setQuitando] = useState(false);

  const registrados = useMemo(() => new Set(caso.involucrados.map((p) => p.id_empleado)), [caso.involucrados]);
  const responsableInvolucrado = caso.responsable && registrados.has(caso.responsable.id_empleado);

  const opciones = useMemo(
    () =>
      (empleados.lista ?? [])
        .filter((e) => e.activo !== false && !registrados.has(e.id_empleado))
        .map((e) => ({ valor: e.id_empleado, etiqueta: [e.nombre_completo, e.cargo].filter(Boolean).join(" · ") })),
    [empleados.lista, registrados],
  );

  const agregar = async (evento) => {
    evento.preventDefault();
    setError(null);
    if (!idEmpleado) {
      setErrorCampo("Seleccione al empleado involucrado.");
      return;
    }
    setErrorCampo(null);
    setGuardando(true);
    try {
      const registrado = await registrarInvolucradoQueja(sesion, caso.id_queja, idEmpleado);
      avisar({ tono: "exito", titulo: "Involucrado registrado", mensaje: nombreDe(registrado) });
      setIdEmpleado("");
      onActualizado();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async () => {
    setQuitando(true);
    try {
      await quitarInvolucradoQueja(sesion, caso.id_queja, aQuitar.id_empleado);
      avisar({ tono: "exito", titulo: "Involucrado quitado", mensaje: nombreDe(aQuitar) });
      setAQuitar(null);
      onActualizado();
    } catch (fallo) {
      setAQuitar(null);
      setError(fallo.message);
    } finally {
      setQuitando(false);
    }
  };

  return (
    <Tarjeta nivelTitulo={2} titulo="Involucrados" className="qc-tarjeta">
      <p className="qc-ayuda">
        Empleados a los que se refiere la queja. El caso no se puede derivar a ninguno de ellos.
      </p>

      {responsableInvolucrado && (
        <Alerta tono="peligro" role="alert" titulo="Conflicto de interés">
          El responsable actual, {nombreDe(caso.responsable)}, figura como involucrado. Reasigne el caso a otra persona.
        </Alerta>
      )}

      {caso.involucrados.length > 0 ? (
        <ul className="qc-lista">
          {caso.involucrados.map((persona) => (
            <li key={persona.id_empleado} className="qc-lista__item">
              <div className="qc-persona">
                <Avatar nombre={nombreDe(persona)} decorativo />
                <div className="qc-celda">
                  <span>{nombreDe(persona)}</span>
                  <span className="qc-sutil">Registrado el {formatearFechaCorta(persona.registrado_en)}</span>
                </div>
              </div>
              {!deshabilitado && (
                <Boton
                  variante="sutil"
                  soloIcono
                  icono={Trash2}
                  aria-label={`Quitar a ${nombreDe(persona)}`}
                  onClick={() => setAQuitar(persona)}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="qc-sutil">Todavía no registró involucrados.</p>
      )}

      {!deshabilitado && (
        <form className="qc-agregar" onSubmit={agregar} noValidate>
          <Selector
            etiqueta="Agregar involucrado"
            value={idEmpleado}
            onChange={(e) => setIdEmpleado(e.target.value)}
            opciones={opciones}
            textoVacio={empleados.lista ? "Seleccione un empleado" : "Cargando empleados…"}
            error={errorCampo}
            disabled={guardando || !empleados.lista}
          />
          <Boton type="submit" icono={UserPlus} cargando={guardando} disabled={!empleados.lista}>
            Agregar
          </Boton>
        </form>
      )}

      {empleados.error && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudo cargar la lista de empleados"
          acciones={
            <Boton tamano="sm" onClick={empleados.reintentar}>
              Reintentar
            </Boton>
          }
        >
          {empleados.error}
        </Alerta>
      )}

      {error && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo actualizar los involucrados" onCerrar={() => setError(null)}>
          {error}
        </Alerta>
      )}

      <ModalConfirmacion
        abierto={Boolean(aQuitar)}
        titulo="Quitar involucrado"
        textoConfirmar="Quitar"
        procesando={quitando}
        onConfirmar={quitar}
        onCancelar={() => setAQuitar(null)}
      >
        <p>
          ¿Quitar a {nombreDe(aQuitar)} de los involucrados de la queja {caso.codigo_seguimiento}? Podrá volver a
          registrarlo después.
        </p>
      </ModalConfirmacion>
    </Tarjeta>
  );
}
