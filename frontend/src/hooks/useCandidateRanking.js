import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchCandidateRanking } from "../api/recruitmentApi";

const LIMITE_POR_PAGINA = 10;
const ESPERA_FILTROS_MS = 400;

const FILTROS_INICIALES = {
  desempate: "experiencia",
  orden_desempate: "desc",
  experiencia_min: "",
  ciudad: "",
};

const PAGINACION_INICIAL = {
  total_registros: 0,
  pagina_actual: 1,
  limite: LIMITE_POR_PAGINA,
  total_paginas: 1,
  tiene_siguiente: false,
  tiene_anterior: false,
};

// La fecha de postulación favorece por defecto a quien postuló primero; el resto, a quien tiene más.
const ordenPorDefecto = (desempate) => (desempate === "fecha_postulacion" ? "asc" : "desc");

/**
 * RF-13: ranking de postulantes de una convocatoria.
 * Los filtros se aplican tras una breve espera (para no consultar en cada tecla) y cualquier cambio vuelve a la página 1.
 */
export function useCandidateRanking(idConvocatoria) {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_INICIALES);
  // La página pertenece a una convocatoria: si cambia la convocatoria, se vuelve a la primera sin un efecto extra.
  const [seleccion, setSeleccion] = useState({ idConvocatoria: null, pagina: 1 });
  const [recarga, setRecarga] = useState(0);
  const [resultado, setResultado] = useState({ clave: null });
  const temporizador = useRef(null);

  const pagina = seleccion.idConvocatoria === idConvocatoria ? seleccion.pagina : 1;

  const clave = useMemo(
    () => (idConvocatoria ? JSON.stringify([idConvocatoria, pagina, filtrosAplicados, recarga]) : null),
    [idConvocatoria, pagina, filtrosAplicados, recarga],
  );

  useEffect(() => {
    if (!clave) return undefined;
    let vigente = true;
    const [id, paginaPedida, f] = JSON.parse(clave);
    fetchCandidateRanking(id, {
      pagina: paginaPedida,
      limite: LIMITE_POR_PAGINA,
      desempate: f.desempate,
      orden_desempate: f.orden_desempate,
      experiencia_min: f.experiencia_min,
      ciudad: f.ciudad,
    })
      .then((datos) => vigente && setResultado({ clave, datos }))
      .catch((err) =>
        vigente && setResultado({ clave, error: err.message || "Error al obtener el ranking de postulantes." }),
      );
    return () => {
      vigente = false;
    };
  }, [clave]);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const aplicar = useCallback(
    (nuevos) => {
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        setFiltrosAplicados(nuevos);
        setSeleccion({ idConvocatoria, pagina: 1 });
      }, ESPERA_FILTROS_MS);
    },
    [idConvocatoria],
  );

  const actualizarFiltro = (campo, valor) => {
    const nuevos = { ...filtros, [campo]: valor };
    if (campo === "desempate") nuevos.orden_desempate = ordenPorDefecto(valor);
    setFiltros(nuevos);
    aplicar(nuevos);
  };

  const restablecerFiltros = () => {
    setFiltros(FILTROS_INICIALES);
    aplicar(FILTROS_INICIALES);
  };

  const cambiarPagina = (nuevaPagina) => setSeleccion({ idConvocatoria, pagina: nuevaPagina });

  const recargar = () => setRecarga((n) => n + 1);

  const vista = resultado.clave === clave ? resultado : {};

  return {
    candidatos: vista.datos?.ranking ?? [],
    paginacion: resultado.datos?.paginacion ?? PAGINACION_INICIAL,
    cargando: Boolean(clave) && resultado.clave !== clave,
    error: vista.error ?? null,
    filtros,
    actualizarFiltro,
    restablecerFiltros,
    cambiarPagina,
    recargar,
  };
}
