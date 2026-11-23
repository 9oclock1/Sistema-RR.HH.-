import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Plus, SearchX, UserMinus } from "lucide-react";
import {
  descargarDocumentoDesvinculacion,
  listarCausalesDesvinculacion,
  listarDesvinculaciones,
  registrarDesvinculacion,
} from "../../api/desvinculaciones";
import { getEmpleados } from "../../api/empleadosApi";
import {
  Alerta,
  Boton,
  EncabezadoPagina,
  EstadoVacio,
  Selector,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import { useRol, useUsuario } from "../../context/sesion";
import { puedeAcceder } from "../../utils/permisos";
import DesvinculacionFormulario from "./DesvinculacionFormulario";
import BeneficiosSocialesModal from "./BeneficiosSocialesModal";
import PromedioIndemnizableModal from "./PromedioIndemnizableModal";
import SaldosProporcionalesModal from "./SaldosProporcionalesModal";
import TablaDesvinculaciones from "./TablaDesvinculaciones";
import { ESTADOS, opciones } from "./formato";
import "./desvinculaciones.css";

const FILTROS_VACIOS = { estado: "", codigo_causal: "" };

export default function DesvinculacionesPage() {
  const avisar = useAvisos();
  const rol = useRol();
  const idEmpleado = useUsuario();
  const identidad = useMemo(() => ({ idEmpleado, rol }), [idEmpleado, rol]);
  // El Contador solo consulta: registrar bajas, descargar respaldos y calcular el promedio son del Administrador.
  const puedeGestionar = puedeAcceder(rol, ["admin"]);
  // La indemnización y el desahucio los calculan el Administrador y el Contador (RF-56).
  const puedeCalcularBeneficios = puedeAcceder(rol, ["admin", "contador"]);

  const [procesos, setProcesos] = useState([]);
  const [causales, setCausales] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [descargandoId, setDescargandoId] = useState(null);
  const [procesoPromedio, setProcesoPromedio] = useState(null);
  const [procesoBeneficios, setProcesoBeneficios] = useState(null);
  const [procesoSaldos, setProcesoSaldos] = useState(null);

  const cargar = useCallback(
    () =>
      Promise.all([
        listarDesvinculaciones({}, identidad),
        listarCausalesDesvinculacion(identidad),
        getEmpleados(),
      ])
        .then(([listaProcesos, listaCausales, listaEmpleados]) => {
          setProcesos(listaProcesos);
          setCausales(listaCausales);
          setEmpleados(listaEmpleados);
          setErrorCarga(null);
        })
        .catch((error) => setErrorCarga(error.message))
        .finally(() => setCargando(false)),
    [identidad]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(
    () =>
      procesos.filter(
        (p) =>
          (!filtros.estado || p.estado === filtros.estado) &&
          (!filtros.codigo_causal || p.causal?.codigo === filtros.codigo_causal)
      ),
    [procesos, filtros]
  );

  const reintentar = () => {
    setCargando(true);
    setErrorCarga(null);
    cargar();
  };

  const cambiarFiltro = (evento) =>
    setFiltros((actuales) => ({ ...actuales, [evento.target.name]: evento.target.value }));

  const guardar = async (formData) => {
    const creado = await registrarDesvinculacion(formData, identidad);
    setFormularioAbierto(false);
    await cargar();
    avisar({
      tono: "exito",
      titulo: "Proceso de liquidación iniciado",
      mensaje: `${creado.nombre_empleado} quedó dado de baja.`,
    });
  };

  const descargar = async (proceso) => {
    setDescargandoId(proceso.id_proceso);
    try {
      const blob = await descargarDocumentoDesvinculacion(proceso.id_proceso, identidad);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = proceso.documento?.nombre_archivo ?? `respaldo-${proceso.id_proceso}`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      avisar({
        tono: "peligro",
        titulo: "No se pudo descargar el respaldo",
        mensaje: error.message,
      });
    } finally {
      setDescargandoId(null);
    }
  };

  const botonRegistrar = (
    <Boton variante="primario" icono={Plus} onClick={() => setFormularioAbierto(true)}>
      Registrar baja
    </Boton>
  );

  const hayFiltros = filtros.estado || filtros.codigo_causal;
  const vacio = hayFiltros ? (
    <EstadoVacio
      icono={SearchX}
      titulo="Ningún proceso coincide con los filtros"
      accion={<Boton onClick={() => setFiltros(FILTROS_VACIOS)}>Limpiar filtros</Boton>}
    />
  ) : (
    <EstadoVacio
      icono={UserMinus}
      titulo="Aún no hay desvinculaciones registradas"
      mensaje={
        puedeGestionar
          ? "Registre la causal formal de baja, la fecha de retiro y el documento de respaldo para iniciar el proceso de liquidación."
          : "Aquí aparecerán los procesos de liquidación que registre el Administrador de RRHH."
      }
      accion={puedeGestionar && botonRegistrar}
    />
  );

  return (
    <section className="desv-pagina" aria-labelledby="desv-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Desvinculación" }]}
        enlace={Link}
        titulo="Desvinculaciones"
        idTitulo="desv-titulo"
        descripcion="Registro de la causal formal de baja, fecha de retiro y respaldo, que inicia el proceso de liquidación."
        acciones={puedeGestionar && !errorCarga && procesos.length > 0 && botonRegistrar}
      />

      {errorCarga ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar las desvinculaciones"
          acciones={
            <Boton tamano="sm" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          {errorCarga}
        </Alerta>
      ) : (
        <Tarjeta className="desv-tarjeta">
          <div className="desv-filtros">
            <Selector
              id="desv-filtro-estado"
              name="estado"
              etiqueta="Estado"
              value={filtros.estado}
              onChange={cambiarFiltro}
              textoVacio="Todos"
              opciones={opciones(ESTADOS)}
            />
            <Selector
              id="desv-filtro-causal"
              name="codigo_causal"
              etiqueta="Causal"
              value={filtros.codigo_causal}
              onChange={cambiarFiltro}
              textoVacio="Todas"
              opciones={causales.map((c) => ({ valor: c.codigo, etiqueta: c.nombre }))}
            />
            {!cargando && (
              <p className="desv-total" role="status">
                {visibles.length} de {procesos.length} registros
              </p>
            )}
          </div>

          <TablaDesvinculaciones
            procesos={visibles}
            cargando={cargando}
            vacio={vacio}
            onDescargar={descargar}
            descargandoId={descargandoId}
            puedeDescargar={puedeGestionar}
            onVerPromedio={setProcesoPromedio}
            onVerBeneficios={setProcesoBeneficios}
            onVerSaldos={setProcesoSaldos}
          />
        </Tarjeta>
      )}

      {formularioAbierto && (
        <DesvinculacionFormulario
          empleados={empleados}
          causales={causales}
          onGuardar={guardar}
          onCancelar={() => setFormularioAbierto(false)}
        />
      )}

      {procesoPromedio && (
        <PromedioIndemnizableModal
          proceso={procesoPromedio}
          identidad={identidad}
          onCerrar={() => setProcesoPromedio(null)}
          onCalculado={cargar}
          puedeCalcular={puedeGestionar}
        />
      )}

      {procesoBeneficios && (
        <BeneficiosSocialesModal
          proceso={procesoBeneficios}
          identidad={identidad}
          onCerrar={() => setProcesoBeneficios(null)}
          onCalculado={cargar}
          puedeCalcular={puedeCalcularBeneficios}
        />
      )}

      {procesoSaldos && (
        <SaldosProporcionalesModal
          proceso={procesoSaldos}
          identidad={identidad}
          onCerrar={() => setProcesoSaldos(null)}
          onCalculado={cargar}
          puedeCalcular={puedeGestionar}
        />
      )}
    </section>
  );
}
