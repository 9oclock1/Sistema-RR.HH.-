import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { guardarAsignaciones } from "../../api/rolesTurno";

const ESPERA_GUARDADO_MS = 600;

export const claveCelda = (idEmpleado, fecha) => `${idEmpleado}|${fecha}`;

// Celdas del rol con los cambios locales encima. Los cambios se guardan solos poco después de hacerlos.
// El componente que lo usa se monta con key={id_rol} para empezar de cero al cambiar de rol.
export default function useEdicionRol(rol, alGuardar) {
  const [pendientes, setPendientes] = useState(() => new Map());
  const [estado, setEstado] = useState("guardado");
  const [error, setError] = useState(null);
  const enCurso = useRef(null);
  const temporizador = useRef(null);
  const idRol = rol?.id_rol;

  const servidor = useMemo(
    () => new Map((rol?.asignaciones ?? []).map((a) => [claveCelda(a.id_empleado, a.fecha), a])),
    [rol]
  );

  const valorDe = useCallback(
    (idEmpleado, fecha) => {
      const clave = claveCelda(idEmpleado, fecha);
      if (pendientes.has(clave)) return pendientes.get(clave);
      const celda = servidor.get(clave);
      return celda ? { id_turno: celda.id_turno, descanso: celda.descanso } : null;
    },
    [pendientes, servidor]
  );

  const guardar = useCallback(async () => {
    if (!idRol || enCurso.current || pendientes.size === 0) return;
    const enviados = new Map(pendientes);
    const cuerpo = [...enviados.entries()].map(([clave, valor]) => {
      const [id_empleado, fecha] = clave.split("|");
      return { id_empleado, fecha, id_turno: valor?.id_turno ?? null, descanso: valor?.descanso ?? false };
    });
    setEstado("guardando");
    enCurso.current = guardarAsignaciones(idRol, cuerpo)
      .then((actualizado) => {
        // Quedan solo los cambios hechos mientras se guardaba.
        setPendientes((actuales) => {
          const siguen = new Map(actuales);
          for (const [clave, valor] of enviados) if (siguen.get(clave) === valor) siguen.delete(clave);
          return siguen;
        });
        setError(null);
        setEstado("guardado");
        alGuardar(actualizado);
      })
      .catch((causa) => {
        setError(causa);
        setEstado("error");
      })
      .finally(() => {
        enCurso.current = null;
      });
  }, [idRol, pendientes, alGuardar]);

  useEffect(() => {
    if (pendientes.size === 0 || estado === "error" || estado === "guardando") return undefined;
    temporizador.current = setTimeout(guardar, ESPERA_GUARDADO_MS);
    return () => clearTimeout(temporizador.current);
  }, [pendientes, estado, guardar]);

  // cambios: [{ id_empleado, fecha, valor }] con valor { id_turno, descanso } o null para vaciar.
  const cambiar = useCallback(
    (cambios) => {
      setPendientes((actuales) => {
        let siguientes = null;
        for (const { id_empleado, fecha, valor } of cambios) {
          const clave = claveCelda(id_empleado, fecha);
          const anterior = actuales.has(clave) ? actuales.get(clave) : servidor.get(clave) ?? null;
          const igual =
            (anterior === null && valor === null) ||
            (anterior && valor && (anterior.id_turno ?? null) === valor.id_turno && Boolean(anterior.descanso) === valor.descanso);
          if (igual) continue;
          siguientes ??= new Map(actuales);
          siguientes.set(clave, valor);
        }
        return siguientes ?? actuales;
      });
      if (estado === "error") setEstado("pendiente");
    },
    [servidor, estado]
  );

  const descartar = useCallback(() => {
    setPendientes(new Map());
    setError(null);
    setEstado("guardado");
  }, []);

  const reintentar = useCallback(() => {
    setError(null);
    setEstado("pendiente");
  }, []);

  return {
    valorDe,
    cambiar,
    descartar,
    reintentar,
    pendientes: pendientes.size,
    estado: pendientes.size > 0 && estado === "guardado" ? "pendiente" : estado,
    error,
  };
}
