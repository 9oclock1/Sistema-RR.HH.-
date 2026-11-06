import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { HandCoins, Plus, SearchX } from "lucide-react";
import { crearAnticipo, listarAnticipos, obtenerAnticipo } from "../../api/anticipos";
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
import AnticipoFormulario from "./AnticipoFormulario";
import AmortizacionModal from "./AmortizacionModal";
import TablaAnticipos from "./TablaAnticipos";
import { ESTADOS, TIPOS, opciones } from "./formato";
import "./anticipos.css";

const FILTROS_VACIOS = { tipo: "", estado: "" };

export default function AnticiposPage() {
  const avisar = useAvisos();
  const [anticipos, setAnticipos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [detalle, setDetalle] = useState(null);

  const cargar = useCallback(
    () =>
      Promise.all([listarAnticipos(), getEmpleados()])
        .then(([listaAnticipos, listaEmpleados]) => {
          setAnticipos(listaAnticipos);
          setEmpleados(listaEmpleados);
          setErrorCarga(null);
        })
        .catch((error) => setErrorCarga(error.message))
        .finally(() => setCargando(false)),
    []
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const empleadosPorId = useMemo(() => new Map(empleados.map((e) => [e.id_empleado, e])), [empleados]);

  const visibles = useMemo(
    () =>
      anticipos.filter(
        (p) => (!filtros.tipo || p.tipo === filtros.tipo) && (!filtros.estado || p.estado === filtros.estado)
      ),
    [anticipos, filtros]
  );

  const reintentar = () => {
    setCargando(true);
    setErrorCarga(null);
    cargar();
  };

  const cambiarFiltro = (evento) => setFiltros((actuales) => ({ ...actuales, [evento.target.name]: evento.target.value }));

  const guardar = async (datos) => {
    const nuevo = await crearAnticipo(datos);
    setFormularioAbierto(false);
    await cargar();
    const empleado = empleadosPorId.get(nuevo.id_empleado);
    avisar({
      tono: "exito",
      titulo: TIPOS[nuevo.tipo].etiqueta + " registrado",
      mensaje: empleado ? `${empleado.nombre_completo}: ${nuevo.numero_cuotas} cuotas` : undefined,
    });
  };

  const verCuotas = async (anticipo) => {
    const completo = await obtenerAnticipo(anticipo.id_prestamo);
    setDetalle(completo);
  };

  const botonNuevo = (
    <Boton variante="primario" icono={Plus} onClick={() => setFormularioAbierto(true)}>
      Nuevo anticipo o préstamo
    </Boton>
  );

  const hayFiltros = filtros.tipo || filtros.estado;
  const vacio = hayFiltros ? (
    <EstadoVacio
      icono={SearchX}
      titulo="Ningún registro coincide con los filtros"
      accion={<Boton onClick={() => setFiltros(FILTROS_VACIOS)}>Limpiar filtros</Boton>}
    />
  ) : (
    <EstadoVacio
      icono={HandCoins}
      titulo="Aún no hay anticipos ni préstamos"
      mensaje="Registre un anticipo de sueldo o un préstamo con su plan de cuotas."
      accion={botonNuevo}
    />
  );

  return (
    <section className="anticipos" aria-labelledby="anticipos-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Planillas" }]}
        enlace={Link}
        titulo="Anticipos y préstamos"
        idTitulo="anticipos-titulo"
        descripcion="Anticipos de sueldo y préstamos con su plan de cuotas, descontados automáticamente en la planilla."
        acciones={!errorCarga && anticipos.length > 0 && botonNuevo}
      />

      {errorCarga ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar los anticipos y préstamos"
          acciones={
            <Boton tamano="sm" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          {errorCarga}
        </Alerta>
      ) : (
        <Tarjeta className="anticipos-tarjeta">
          <div className="anticipos-filtros">
            <Selector
              id="anticipos-filtro-tipo"
              name="tipo"
              etiqueta="Tipo"
              value={filtros.tipo}
              onChange={cambiarFiltro}
              textoVacio="Todos"
              opciones={opciones(TIPOS)}
            />
            <Selector
              id="anticipos-filtro-estado"
              name="estado"
              etiqueta="Estado"
              value={filtros.estado}
              onChange={cambiarFiltro}
              textoVacio="Todos"
              opciones={opciones(ESTADOS)}
            />
            {!cargando && (
              <p className="anticipos-total" role="status">
                {visibles.length} de {anticipos.length} registros
              </p>
            )}
          </div>
          <TablaAnticipos
            anticipos={visibles}
            empleadosPorId={empleadosPorId}
            cargando={cargando}
            vacio={vacio}
            onVerCuotas={verCuotas}
          />
        </Tarjeta>
      )}

      {formularioAbierto && (
        <AnticipoFormulario empleados={empleados} onGuardar={guardar} onCancelar={() => setFormularioAbierto(false)} />
      )}

      {detalle && (
        <AmortizacionModal
          anticipo={detalle}
          empleado={empleadosPorId.get(detalle.id_empleado)}
          onCerrar={() => setDetalle(null)}
        />
      )}
    </section>
  );
}
