import { useCallback, useEffect, useRef, useState } from 'react';
import { getPerfilCargo } from '../../../api/convocatoriasApi';

const SIN_PERFIL = { cargando: false, datos: null, error: null };

// Vista previa del perfil de un cargo. `cargar` devuelve los datos (o null si falló o se reemplazó
// por otra consulta), para que el formulario decida si los aplica a sus campos.
export function usePerfilCargo() {
  const [estado, setEstado] = useState(SIN_PERFIL);
  const controllerRef = useRef(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const cargar = useCallback(async (idCargo) => {
    controllerRef.current?.abort();
    if (!idCargo) {
      setEstado(SIN_PERFIL);
      return null;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setEstado({ cargando: true, datos: null, error: null });

    try {
      const datos = await getPerfilCargo(idCargo, { signal: controller.signal });
      setEstado({ cargando: false, datos, error: null });
      return datos;
    } catch (error) {
      if (error.name === 'AbortError') return null;
      setEstado({ cargando: false, datos: null, error });
      return null;
    }
  }, []);

  return { ...estado, cargar };
}
