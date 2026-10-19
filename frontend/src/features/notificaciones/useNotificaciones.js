import { useCallback, useEffect, useState } from "react";
import { contarNoLeidas, listarNotificaciones, marcarLeida, marcarTodasLeidas } from "../../api/notificaciones";

const INTERVALO_MS = 30 * 1000;
const LIMITE_PANEL = 20;

const vacio = (dueno) => ({ dueno, noLeidas: 0, items: null, cargando: false, error: null });

// Alertas del empleado identificado: contador siempre al día (consulta liviana cada 30 s mientras la pestaña está visible)
// y lista completa solo cuando el panel la pide.
export function useNotificaciones(idEmpleado) {
  const [estado, setEstado] = useState(() => vacio(idEmpleado));
  // Al cambiar de empleado no se muestran las alertas del anterior.
  const actual = estado.dueno === idEmpleado ? estado : vacio(idEmpleado);

  const actualizar = useCallback(
    (cambios) =>
      setEstado((previo) => ({ ...(previo.dueno === idEmpleado ? previo : vacio(idEmpleado)), ...cambios })),
    [idEmpleado]
  );

  useEffect(() => {
    if (!idEmpleado) return undefined;
    let vigente = true;
    const consultar = () => {
      if (document.visibilityState === "hidden") return;
      contarNoLeidas(idEmpleado)
        .then(({ no_leidas }) => vigente && actualizar({ noLeidas: no_leidas }))
        // Sin respuesta se conserva el último contador; el siguiente ciclo lo reintenta.
        .catch(() => {});
    };
    consultar();
    const temporizador = setInterval(consultar, INTERVALO_MS);
    document.addEventListener("visibilitychange", consultar);
    return () => {
      vigente = false;
      clearInterval(temporizador);
      document.removeEventListener("visibilitychange", consultar);
    };
  }, [idEmpleado, actualizar]);

  const cargar = useCallback(async () => {
    if (!idEmpleado) return;
    actualizar({ cargando: true, error: null });
    try {
      const { notificaciones, no_leidas } = await listarNotificaciones(idEmpleado, { limite: LIMITE_PANEL });
      actualizar({ items: notificaciones, noLeidas: no_leidas, cargando: false });
    } catch (error) {
      actualizar({ cargando: false, error: error.message });
    }
  }, [idEmpleado, actualizar]);

  const leer = useCallback(
    async (notificacion) => {
      if (notificacion.leida) return;
      // El contador baja al instante; si el servidor falla, la siguiente consulta lo corrige.
      setEstado((previo) => ({
        ...previo,
        noLeidas: Math.max(0, previo.noLeidas - 1),
        items: previo.items?.map((n) => (n.id_notificacion === notificacion.id_notificacion ? { ...n, leida: true } : n)),
      }));
      try {
        await marcarLeida(idEmpleado, notificacion.id_notificacion);
      } catch {
        // Queda como no leída en el servidor; se verá de nuevo en la próxima carga.
      }
    },
    [idEmpleado]
  );

  const leerTodas = useCallback(async () => {
    await marcarTodasLeidas(idEmpleado);
    setEstado((previo) => ({ ...previo, noLeidas: 0, items: previo.items?.map((n) => ({ ...n, leida: true })) }));
  }, [idEmpleado]);

  return { ...actual, cargar, leer, leerTodas };
}
