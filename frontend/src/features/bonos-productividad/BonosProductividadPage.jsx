import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus, Target } from "lucide-react";
import {
  actualizarRegla,
  cambiarEstadoRegla,
  crearRegla,
  eliminarRegla,
  listarReglas,
} from "../../api/bonosProductividad";
import { Alerta, Boton, EncabezadoPagina, EstadoVacio, ModalConfirmacion, Pestanas, Tarjeta, useAvisos } from "../../components/ui";
import "../conceptos/conceptos.css";
import "../condiciones/condiciones.css";
import ReglaFormulario from "./ReglaFormulario";
import ResultadosPeriodo from "./ResultadosPeriodo";
import TablaReglas from "./TablaReglas";

export default function BonosProductividadPage() {
  const avisar = useAvisos();
  const [pestana, setPestana] = useState("reglas");
  const [reglas, setReglas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [alerta, setAlerta] = useState(null);
  const [formulario, setFormulario] = useState(null);
  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(
    () =>
      listarReglas()
        .then((lista) => {
          setReglas(lista);
          setErrorCarga(null);
        })
        .catch((error) => setErrorCarga(error.message))
        .finally(() => setCargando(false)),
    []
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const reintentar = () => {
    setCargando(true);
    setErrorCarga(null);
    cargar();
  };

  const abrirFormulario = (regla) => {
    setAlerta(null);
    setFormulario({ regla });
  };

  const guardar = async (datos) => {
    const { regla } = formulario;
    if (regla) await actualizarRegla(regla.id_regla, datos);
    else await crearRegla(datos);
    setFormulario(null);
    await cargar();
    avisar({
      tono: "exito",
      titulo: regla ? "Regla actualizada" : "Regla creada",
      mensaje: `${datos.periodo} · ${datos.tipo_meta}`,
    });
  };

  const inactivar = async (regla) => {
    setAlerta(null);
    try {
      await cambiarEstadoRegla(regla.id_regla, false);
      await cargar();
      avisar({ tono: "exito", titulo: "Regla inactivada", mensaje: regla.periodo });
    } catch (error) {
      setAlerta({ titulo: "No se pudo inactivar la regla", texto: error.message });
    }
  };

  const confirmarEliminacion = async () => {
    const regla = porEliminar;
    setEliminando(true);
    try {
      await eliminarRegla(regla.id_regla);
      await cargar();
      avisar({ tono: "exito", titulo: "Regla eliminada", mensaje: regla.periodo });
    } catch (error) {
      const puedeInactivar = error.estado === 409 && regla.esta_activa;
      setAlerta({
        titulo: "No se pudo eliminar la regla",
        texto: error.message,
        accion: puedeInactivar ? { texto: "Inactivar regla", ejecutar: () => inactivar(regla) } : null,
      });
    } finally {
      setEliminando(false);
      setPorEliminar(null);
    }
  };

  const botonNueva = (
    <Boton variante="primario" icono={Plus} onClick={() => abrirFormulario(null)}>
      Nueva regla
    </Boton>
  );

  const tabla = (
    <TablaReglas
      reglas={reglas}
      cargando={cargando}
      vacio={
        <EstadoVacio
          icono={Target}
          titulo="Aún no hay reglas de bono por productividad"
          mensaje="Defina el tipo de meta, el umbral de cumplimiento y el monto o porcentaje del bono."
          accion={botonNueva}
        />
      }
      onEditar={abrirFormulario}
      onEliminar={setPorEliminar}
    />
  );

  return (
    <section className="conceptos" aria-labelledby="bonos-productividad-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Planillas" }]}
        enlace={Link}
        titulo="Bonos por productividad"
        idTitulo="bonos-productividad-titulo"
        descripcion="Bonos variables por cumplimiento de metas de venta, puntualidad o desempeño en caja, con las ventas reales del periodo que publica Marketplace y Ventas."
        acciones={!errorCarga && reglas.length > 0 && botonNueva}
      />

      {alerta && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo={alerta.titulo}
          onCerrar={() => setAlerta(null)}
          acciones={
            alerta.accion && (
              <Boton tamano="sm" onClick={alerta.accion.ejecutar}>
                {alerta.accion.texto}
              </Boton>
            )
          }
        >
          {alerta.texto}
        </Alerta>
      )}

      {errorCarga ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar las reglas"
          acciones={
            <Boton tamano="sm" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          {errorCarga}
        </Alerta>
      ) : (
        <Tarjeta className="conceptos-tarjeta">
          <Pestanas
            etiqueta="Reglas y resultados"
            activa={pestana}
            onCambiar={setPestana}
            pestanas={[
              { id: "reglas", etiqueta: "Reglas", contador: cargando ? undefined : reglas.length, contenido: tabla },
              {
                id: "resultados",
                etiqueta: "Resultados por colaborador",
                contenido: <ResultadosPeriodo hayReglas={reglas.some((r) => r.esta_activa)} />,
              },
            ]}
          />
        </Tarjeta>
      )}

      {formulario && (
        <ReglaFormulario
          key={formulario.regla?.id_regla ?? "nueva"}
          regla={formulario.regla}
          onGuardar={guardar}
          onCancelar={() => setFormulario(null)}
        />
      )}

      <ModalConfirmacion
        abierto={Boolean(porEliminar)}
        titulo="¿Eliminar la regla?"
        textoConfirmar="Eliminar"
        procesando={eliminando}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setPorEliminar(null)}
      >
        Se eliminará la regla de <strong>{porEliminar?.periodo}</strong>. Si ya generó bonos, solo podrá inactivarse.
      </ModalConfirmacion>
    </section>
  );
}
