import { useState, useEffect, useCallback, useRef } from "react";
import { fetchCandidateRanking } from "../api/recruitmentApi";

export function useCandidateRanking(idConvocatoria) {
  const [candidatos, setCandidatos] = useState([]);
  const [paginacion, setPaginacion] = useState({
    total_registros: 0,
    pagina_actual: 1,
    limite: 10,
    total_paginas: 1,
    tiene_siguiente: false,
    tiene_anterior: false,
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const [filtros, setFiltros] = useState({
    desempate: "experiencia",
    orden_desempate: "desc",
    experiencia_min: "",
    pretension_salarial_max: "",
  });

  const [pagina, setPagina] = useState(1);
  const timeoutRef = useRef(null);

  const cargarRanking = useCallback(
    (nuevaPagina = pagina, filtrosActuales = filtros) => {
      if (!idConvocatoria) {
        setCandidatos([]);
        return Promise.resolve();
      }

      setCargando(true);
      setError(null);

      const params = {
        pagina: nuevaPagina,
        limite: 10,
        desempate: filtrosActuales.desempate,
        orden_desempate: filtrosActuales.orden_desempate,
        experiencia_min: filtrosActuales.experiencia_min || undefined,
        pretension_salarial_max:
          filtrosActuales.pretension_salarial_max || undefined,
      };

      return fetchCandidateRanking(idConvocatoria, params)
        .then((data) => {
          setCandidatos(data?.ranking || []);
          if (data?.paginacion) {
            setPaginacion(data.paginacion);
          }
        })
        .catch((err) => {
          setError(
            err.message || "Error al obtener el ranking de postulantes.",
          );
        })
        .finally(() => {
          setCargando(false);
        });
    },
    [idConvocatoria, pagina, filtros],
  );

  useEffect(() => {
    setPagina(1);
    cargarRanking(1, filtros);
  }, [idConvocatoria, filtros.desempate, filtros.orden_desempate]);

  const actualizarFiltro = (campo, valor) => {
    const nuevosFiltros = { ...filtros, [campo]: valor };
    setFiltros(nuevosFiltros);

    if (campo === "desempate" || campo === "orden_desempate") {
      setPagina(1);
      cargarRanking(1, nuevosFiltros);
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setPagina(1);
        cargarRanking(1, nuevosFiltros);
      }, 400);
    }
  };

  const cambiarPagina = (nuevaPagina) => {
    setPagina(nuevaPagina);
    cargarRanking(nuevaPagina, filtros);
  };

  const recargar = () => {
    return cargarRanking(pagina, filtros);
  };

  return {
    candidatos,
    paginacion,
    cargando,
    error,
    filtros,
    actualizarFiltro,
    cambiarPagina,
    recargar,
  };
}
