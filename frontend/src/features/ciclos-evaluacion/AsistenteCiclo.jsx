import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CalendarPlus } from "lucide-react";
import {
  crearCiclo,
  listarAreasCiclo,
  listarColaboradoresCiclo,
  listarOpcionesCiclo,
  listarSucursalesCiclo,
} from "../../api/ciclosEvaluacion";
import { Alerta, Boton, EncabezadoPagina, Esqueleto, Pasos, Tarjeta, useAvisos } from "../../components/ui";
import { useRol, useUsuario } from "../../context/sesion";
import { mapearErroresApi } from "../../utils/erroresApi";
import useRecurso from "../quejas/casos/useRecurso";
import { RUTA_CICLOS, alcanceVacio, rutaCiclo } from "./ciclo";
import PasoFechas from "./PasoFechas";
import PasoPlantilla from "./PasoPlantilla";
import PasoRevision from "./PasoRevision";
import SelectorAlcance from "./SelectorAlcance";
import {
  PASOS,
  pasoDelCampo,
  validarAlcanceCiclo,
  validarNombreYFechas,
  validarPlantillaYPeriodo,
} from "./validacionCiclo";
import "./ciclosEvaluacion.css";

const CAMPOS_API = ["id_version", "id_periodo", "nombre", "fecha_inicio", "fecha_limite", "alcance"];

const DATOS_INICIALES = {
  idVersion: "",
  idPeriodo: "",
  nombre: "",
  fechaInicio: "",
  fechaLimite: "",
  ...alcanceVacio(),
  alcanceElegido: false,
};

const TITULOS = {
  plantilla: "Elija la plantilla y el periodo",
  fechas: "Indique el nombre y las fechas",
  alcance: "Elija a quiénes se evalúa",
  revision: "Revise y programe el ciclo",
};

const migas = [
  { etiqueta: "Inicio", href: "/" },
  { etiqueta: "Desempeño" },
  { etiqueta: "Ciclos de evaluación", href: RUTA_CICLOS },
];

// Asistente de 4 pasos para programar un ciclo: plantilla y periodo, nombre y fechas, alcance y revisión.
export default function AsistenteCiclo() {
  const rol = useRol();
  const idEmpleado = useUsuario();
  const navegar = useNavigate();
  const avisar = useAvisos();
  const sesion = useMemo(() => ({ rol, idEmpleado }), [rol, idEmpleado]);

  const cargar = useCallback(
    () =>
      Promise.all([
        listarOpcionesCiclo({ rol }),
        listarAreasCiclo(),
        listarSucursalesCiclo(),
        listarColaboradoresCiclo(),
      ]).then(([opciones, areas, sucursales, empleados]) => ({ opciones, areas, sucursales, empleados })),
    [rol],
  );
  const { datos: catalogos, error: errorCarga, reintentar } = useRecurso(cargar);

  const [paso, setPaso] = useState(PASOS[0].id);
  const [datos, setDatos] = useState(DATOS_INICIALES);
  const [errores, setErrores] = useState({});
  const [errorEnvio, setErrorEnvio] = useState(null);
  const [totalAsignaciones, setTotalAsignaciones] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const tituloPaso = useRef(null);
  const montado = useRef(false);

  // Al cambiar de paso el foco pasa al título para que un lector de pantalla anuncie el nuevo paso.
  useEffect(() => {
    if (montado.current) tituloPaso.current?.focus();
    else montado.current = true;
  }, [paso]);

  const version = catalogos?.opciones.versiones.find((item) => item.id_version === datos.idVersion);
  const periodo = catalogos?.opciones.periodos.find((item) => item.id_periodo === datos.idPeriodo);
  const areaPlantilla = version
    ? { id_departamento: version.id_departamento_destino, nombre: version.area }
    : null;
  const alcance = useMemo(
    () => ({ areas: datos.areas, sucursales: datos.sucursales, colaboradores: datos.colaboradores }),
    [datos.areas, datos.sucursales, datos.colaboradores],
  );

  const quitarError = (campoApi) =>
    setErrores((actuales) => {
      if (!actuales[campoApi]) return actuales;
      const resto = { ...actuales };
      delete resto[campoApi];
      return resto;
    });

  const cambiar = (campo, valor, campoApi) => {
    setDatos((actuales) => ({ ...actuales, [campo]: valor }));
    quitarError(campoApi);
    setErrorEnvio(null);
  };

  // Al elegir plantilla, su área queda marcada como alcance de partida mientras no se haya tocado el alcance.
  const cambiarPlantilla = (valor) => {
    setDatos((actuales) => {
      const siguiente = { ...actuales, idVersion: valor };
      const elegida = catalogos.opciones.versiones.find((item) => item.id_version === valor);
      if (!actuales.alcanceElegido) siguiente.areas = elegida ? [elegida.id_departamento_destino] : [];
      return siguiente;
    });
    quitarError("id_version");
    setErrorEnvio(null);
  };

  const cambiarAlcance = (campo, lista) => {
    setDatos((actuales) => ({ ...actuales, [campo]: lista, alcanceElegido: true }));
    quitarError("alcance");
    setErrorEnvio(null);
  };

  const validarPaso = () => {
    if (paso === "plantilla") return validarPlantillaYPeriodo(datos);
    if (paso === "fechas") return validarNombreYFechas(datos, { periodo });
    if (paso === "alcance") return validarAlcanceCiclo(datos);
    return {};
  };

  const irA = (destino) => {
    setErrorEnvio(null);
    setTotalAsignaciones(null);
    setPaso(destino);
  };

  const siguiente = () => {
    const nuevos = validarPaso();
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;
    irA(PASOS[PASOS.findIndex((item) => item.id === paso) + 1].id);
  };

  const anterior = () => irA(PASOS[PASOS.findIndex((item) => item.id === paso) - 1].id);

  // Lleva al usuario al primer paso que tiene un campo rechazado por el servidor.
  const mostrarErrorDelServidor = (error) => {
    const conCampo = (error.detalles ?? []).filter((detalle) => detalle?.campo && detalle?.mensaje);
    const { porCampo } = mapearErroresApi(conCampo, CAMPOS_API);
    const destino = PASOS.find((item) => Object.keys(porCampo).some((campo) => pasoDelCampo(campo) === item.id));
    setErrores(porCampo);
    setErrorEnvio({ titulo: "No se pudo programar el ciclo", texto: error.message });
    if (destino) setPaso(destino.id);
  };

  const programar = async () => {
    setEnviando(true);
    setErrorEnvio(null);
    try {
      const resultado = await crearCiclo(sesion, {
        idVersion: datos.idVersion,
        idPeriodo: datos.idPeriodo,
        nombre: datos.nombre.trim(),
        fechaInicio: datos.fechaInicio,
        fechaLimite: datos.fechaLimite,
        alcance,
      });
      avisar({
        tono: "exito",
        titulo: "Ciclo programado",
        mensaje: `«${resultado.ciclo.nombre}» con ${resultado.total_asignaciones} asignaciones.`,
      });
      navegar(rutaCiclo(resultado.ciclo.id_ciclo));
    } catch (error) {
      mostrarErrorDelServidor(error);
      setEnviando(false);
    }
  };

  const indice = PASOS.findIndex((item) => item.id === paso);
  const esUltimo = indice === PASOS.length - 1;

  const contenido = () => {
    if (errorCarga) {
      return (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar los datos del asistente"
          acciones={
            <Boton tamano="sm" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          {errorCarga.message}
        </Alerta>
      );
    }
    if (!catalogos) {
      return (
        <div className="cev-campos" aria-busy="true">
          <Esqueleto forma="bloque" alto="40px" />
          <Esqueleto forma="bloque" alto="40px" />
        </div>
      );
    }
    if (paso === "plantilla") {
      return (
        <PasoPlantilla
          versiones={catalogos.opciones.versiones}
          periodos={catalogos.opciones.periodos}
          datos={datos}
          errores={errores}
          onCambiar={(campo, valor) =>
            campo === "idVersion" ? cambiarPlantilla(valor) : cambiar(campo, valor, "id_periodo")
          }
        />
      );
    }
    if (paso === "fechas") {
      const campoApi = { nombre: "nombre", fechaInicio: "fecha_inicio", fechaLimite: "fecha_limite" };
      return (
        <PasoFechas
          datos={datos}
          errores={errores}
          onCambiar={(campo, valor) => cambiar(campo, valor, campoApi[campo])}
        />
      );
    }
    if (paso === "alcance") {
      return (
        <SelectorAlcance
          areas={catalogos.areas}
          sucursales={catalogos.sucursales}
          empleados={catalogos.empleados}
          valor={alcance}
          onCambiar={cambiarAlcance}
          error={errores.alcance}
          areaPlantilla={areaPlantilla}
        />
      );
    }
    return (
      <PasoRevision
        sesion={sesion}
        datos={datos}
        alcance={alcance}
        version={version}
        periodo={periodo}
        onTotal={setTotalAsignaciones}
      />
    );
  };

  return (
    <section className="cev-pagina" aria-labelledby="cev-asistente-titulo">
      <EncabezadoPagina
        migas={migas}
        enlace={Link}
        titulo="Programar ciclo de evaluación"
        idTitulo="cev-asistente-titulo"
        descripcion="Elija la plantilla, las fechas y a quiénes se evalúa. El sistema asigna a cada evaluado el jefe directo de su sucursal."
      />

      {!idEmpleado && (
        <Alerta tono="aviso" titulo="Elija su usuario de prueba">
          Seleccione quién es en «Usuario de prueba», al pie de la barra lateral, para poder programar el ciclo.
        </Alerta>
      )}

      <Tarjeta className="cev-asistente">
        <Pasos pasos={PASOS} actual={paso} onSeleccionar={irA} />

        <h2 className="cev-paso-titulo" tabIndex={-1} ref={tituloPaso}>
          {TITULOS[paso]}
        </h2>

        {errorEnvio && (
          <Alerta tono="peligro" role="alert" titulo={errorEnvio.titulo} onCerrar={() => setErrorEnvio(null)}>
            {errorEnvio.texto}
          </Alerta>
        )}

        {contenido()}

        <div className="cev-pie">
          <Boton as={Link} to={RUTA_CICLOS} variante="sutil">
            Cancelar
          </Boton>
          <div className="cev-pie__acciones">
            {indice > 0 && (
              <Boton onClick={anterior} disabled={enviando}>
                Anterior
              </Boton>
            )}
            {esUltimo ? (
              <Boton
                variante="primario"
                icono={CalendarPlus}
                cargando={enviando}
                onClick={programar}
                disabled={!idEmpleado || !totalAsignaciones || enviando}
                title={idEmpleado ? undefined : "Elija su usuario de prueba para programar el ciclo"}
              >
                Programar ciclo
              </Boton>
            ) : (
              <Boton variante="primario" onClick={siguiente} disabled={!catalogos}>
                Siguiente
              </Boton>
            )}
          </div>
        </div>
      </Tarjeta>
    </section>
  );
}
