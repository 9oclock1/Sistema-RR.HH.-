import { useCallback, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { listarSucursalesQueja, obtenerSucursalQueja, registrarSucursalQueja } from "../../../api/casosQueja";
import { Alerta, Boton, Selector, Tarjeta, useAvisos } from "../../../components/ui";
import useRecurso from "./useRecurso";

export default function SucursalQueja({ idQueja, sesion, editable }) {
  const avisar = useAvisos();
  const actual = useRecurso(
    useCallback(() => Promise.resolve().then(() => obtenerSucursalQueja(sesion, idQueja)), [sesion, idQueja]),
  );
  const sucursales = useRecurso(useCallback(() => Promise.resolve().then(() => listarSucursalesQueja()), []));
  const [seleccion, setSeleccion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const vigente = actual.datos?.sucursal ?? null;
  const valorVigente = vigente?.id_sucursal ?? "";
  const valor = seleccion ?? valorVigente;

  const opciones = useMemo(() => {
    const lista = (Array.isArray(sucursales.datos) ? sucursales.datos : []).map((sucursal) => ({
      valor: sucursal.id_sucursal,
      etiqueta: sucursal.nombre,
    }));
    if (vigente && !lista.some((opcion) => opcion.valor === vigente.id_sucursal)) {
      lista.push({ valor: vigente.id_sucursal, etiqueta: vigente.nombre });
    }
    return lista;
  }, [sucursales.datos, vigente]);

  const guardar = async () => {
    setError(null);
    setGuardando(true);
    try {
      const resultado = await registrarSucursalQueja(sesion, idQueja, valor);
      avisar({
        tono: "exito",
        titulo: "Sucursal guardada",
        mensaje: resultado?.sucursal ? resultado.sucursal.nombre : "El caso quedó sin sucursal.",
      });
      setSeleccion(null);
      actual.reintentar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Tarjeta nivelTitulo={2} titulo="Sucursal del caso" className="qc-tarjeta">
      <p className="qc-ayuda">
        Dónde ocurrió el problema. Permite filtrar el historial de quejas y no identifica a quien presentó la queja.
      </p>
      <div className="qc-agregar">
        <Selector
          etiqueta="Sucursal"
          value={valor}
          onChange={(evento) => setSeleccion(evento.target.value)}
          opciones={opciones}
          textoVacio="Sin sucursal"
          disabled={!editable || guardando || actual.cargando}
          error={sucursales.error ? "No se pudo cargar la lista de sucursales." : undefined}
        />
        {editable && (
          <Boton icono={MapPin} cargando={guardando} disabled={valor === valorVigente} onClick={guardar}>
            Guardar
          </Boton>
        )}
      </div>
      {error && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo guardar la sucursal" onCerrar={() => setError(null)}>
          {error}
        </Alerta>
      )}
    </Tarjeta>
  );
}
