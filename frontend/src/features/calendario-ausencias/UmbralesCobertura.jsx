import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { eliminarUmbralCobertura, guardarUmbralCobertura, listarUmbralesCobertura } from "../../api/calendarioAusencias";
import { Alerta, Boton, CampoTexto, Esqueleto, Modal, Selector, Tabla, useAvisos } from "../../components/ui";

const FORMULARIO_INICIAL = { id_sucursal: "", id_departamento: "", max_ausentes_porcentaje: "30", min_presentes: "1" };

// Solo RRHH: fija cuánta ausencia tolera cada área antes de que el calendario avise baja cobertura (criterio 3).
// Un umbral por sucursal y área; sin sucursal o sin área rige para todas.
export default function UmbralesCobertura({ abierto, alcance, identidad, onCerrar, onCambio }) {
  const avisar = useAvisos();
  const [datos, setDatos] = useState({ umbrales: null, error: null });
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!abierto) return undefined;
    let vigente = true;
    listarUmbralesCobertura(identidad)
      .then((respuesta) => vigente && setDatos({ umbrales: respuesta.umbrales, error: null }))
      .catch((error) => vigente && setDatos({ umbrales: null, error: error.message }));
    return () => {
      vigente = false;
    };
  }, [abierto, identidad, intento]);

  const nombreSucursal = (id) => (id ? (alcance.sucursales.find((s) => s.id_sucursal === id)?.nombre ?? "Sucursal") : "Todas las sucursales");
  const nombreArea = (id) => (id ? (alcance.areas.find((a) => a.id_departamento === id)?.nombre ?? "Área") : "Todas las áreas");
  const errorDe = (campo) => errores.find((e) => e.campo === campo)?.mensaje;
  const cambiar = (campo) => (evento) => setFormulario((actual) => ({ ...actual, [campo]: evento.target.value }));

  const guardar = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setErrores([]);
    try {
      await guardarUmbralCobertura(
        {
          id_sucursal: formulario.id_sucursal || undefined,
          id_departamento: formulario.id_departamento || undefined,
          max_ausentes_porcentaje: formulario.max_ausentes_porcentaje,
          min_presentes: formulario.min_presentes,
        },
        identidad
      );
      avisar({ tono: "exito", titulo: "Umbral guardado", mensaje: "El calendario ya usa el nuevo umbral." });
      setIntento((n) => n + 1);
      onCambio();
    } catch (error) {
      if (error.detalles?.length) setErrores(error.detalles);
      else avisar({ tono: "peligro", titulo: "No se pudo guardar el umbral", mensaje: error.message });
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (umbral) => {
    try {
      await eliminarUmbralCobertura(umbral.id_umbral, identidad);
      setIntento((n) => n + 1);
      onCambio();
    } catch (error) {
      avisar({ tono: "peligro", titulo: "No se pudo eliminar el umbral", mensaje: error.message });
    }
  };

  const columnas = [
    { clave: "sucursal", titulo: "Sucursal", celda: (u) => nombreSucursal(u.id_sucursal) },
    { clave: "area", titulo: "Área", celda: (u) => nombreArea(u.id_departamento) },
    { clave: "max", titulo: "Ausentes máx.", alinear: "fin", celda: (u) => `${u.max_ausentes_porcentaje} %` },
    { clave: "min", titulo: "Presentes mín.", alinear: "fin", celda: (u) => u.min_presentes },
    {
      clave: "accion",
      titulo: <span className="ds-solo-lector">Acción</span>,
      alinear: "fin",
      celda: (u) => (
        <Boton
          tamano="sm"
          variante="sutil"
          soloIcono
          icono={Trash2}
          aria-label={`Eliminar el umbral de ${nombreArea(u.id_departamento)} en ${nombreSucursal(u.id_sucursal)}`}
          onClick={() => eliminar(u)}
        />
      ),
    },
  ];

  return (
    <Modal abierto={abierto} titulo="Umbrales de cobertura" tamano="lg" onCerrar={onCerrar} pie={<Boton onClick={onCerrar}>Cerrar</Boton>}>
      <div className="cal-umbrales">
        <p className="cal-sutil">
          El calendario avisa «baja cobertura» cuando, en un día, faltan más personas de las toleradas o quedan menos presentes del mínimo.
          Sin umbral configurado se tolera hasta {alcance.umbral_predeterminado.max_ausentes_porcentaje} % de ausentes y se exige al
          menos {alcance.umbral_predeterminado.min_presentes} persona presente. Rige el más específico: sucursal y área, luego área,
          luego sucursal y, por último, el general.
        </p>

        {datos.error && (
          <Alerta tono="peligro" role="alert" titulo="No se pudieron cargar los umbrales">
            {datos.error}
          </Alerta>
        )}
        {!datos.umbrales && !datos.error && <Esqueleto forma="bloque" />}
        {datos.umbrales && (
          <Tabla
            columnas={columnas}
            filas={datos.umbrales}
            claveFila="id_umbral"
            descripcion="Umbrales de cobertura configurados"
            vacio={<p className="cal-sutil">Aún no configuró umbrales: rige el predeterminado.</p>}
          />
        )}

        <form className="cal-umbrales__formulario" onSubmit={guardar} noValidate>
          <h3 className="cal-umbrales__titulo">Agregar o actualizar un umbral</h3>
          <div className="cal-umbrales__campos">
            <Selector
              etiqueta="Sucursal"
              value={formulario.id_sucursal}
              onChange={cambiar("id_sucursal")}
              opciones={alcance.sucursales.map((s) => ({ valor: s.id_sucursal, etiqueta: s.nombre }))}
              textoVacio="Todas las sucursales"
              error={errorDe("id_sucursal")}
            />
            <Selector
              etiqueta="Área"
              value={formulario.id_departamento}
              onChange={cambiar("id_departamento")}
              opciones={alcance.areas.map((a) => ({ valor: a.id_departamento, etiqueta: a.nombre }))}
              textoVacio="Todas las áreas"
              error={errorDe("id_departamento")}
            />
            <CampoTexto
              type="number"
              etiqueta="Ausentes tolerados (%)"
              min={1}
              max={100}
              value={formulario.max_ausentes_porcentaje}
              onChange={cambiar("max_ausentes_porcentaje")}
              error={errorDe("max_ausentes_porcentaje")}
              requerido
            />
            <CampoTexto
              type="number"
              etiqueta="Presentes mínimos"
              min={0}
              value={formulario.min_presentes}
              onChange={cambiar("min_presentes")}
              error={errorDe("min_presentes")}
            />
          </div>
          <Boton type="submit" variante="primario" cargando={guardando}>
            Guardar umbral
          </Boton>
        </form>
      </div>
    </Modal>
  );
}
