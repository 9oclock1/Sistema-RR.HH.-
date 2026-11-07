import { useCallback, useEffect, useState } from "react";

// obtener(id) devuelve la promesa del saldo; debe ser estable entre renders.
export function useSaldoVacaciones(idEmpleado, obtener) {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState({ clave: null, saldo: null, error: null });
  const clave = idEmpleado ? `${idEmpleado}#${version}` : null;

  useEffect(() => {
    if (!idEmpleado) return undefined;
    let vigente = true;
    obtener(idEmpleado)
      .then((saldo) => vigente && setResultado({ clave, saldo, error: null }))
      .catch((error) => vigente && setResultado({ clave, saldo: null, error }));
    return () => {
      vigente = false;
    };
  }, [idEmpleado, clave, obtener]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const actual = clave !== null && resultado.clave === clave;
  return {
    saldo: actual ? resultado.saldo : null,
    error: actual ? resultado.error : null,
    cargando: clave !== null && !actual,
    recargar,
  };
}
