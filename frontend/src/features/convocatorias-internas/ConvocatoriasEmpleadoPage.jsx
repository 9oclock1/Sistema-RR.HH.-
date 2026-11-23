import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { Megaphone, RefreshCw, ShieldAlert, UserRound } from "lucide-react";
import { listarConvocatoriasEmpleado, postularConvocatoria } from "../../api/convocatoriasInternas";
import { Alerta, Boton, EncabezadoPagina, EstadoVacio, Esqueleto, Selector, Tarjeta, useAvisos } from "../../components/ui";
import { useRol, useUsuario } from "../../context/sesion";
import useRecurso from "../quejas/casos/useRecurso";
import TarjetaConvocatoria from "./TarjetaConvocatoria";
import { FILTROS_ESTADO_EMPLEADO, MENSAJE_SOLO_ACTIVOS } from "./convocatorias";
import "./convocatorias.css";

const MENSAJES_VACIO = {
  VIGENTES: "Cuando Recursos Humanos publique una convocatoria de ascenso, aparecerá aquí y recibirá un mensaje.",
  CERRADA: "Todavía no hay convocatorias cerradas.",
  TODAS: "Todavía no hay convocatorias publicadas.",
};

export default function ConvocatoriasEmpleadoPage() {
  const rol = useRol();
  const idEmpleado = useUsuario();
  const [estado, setEstado] = useState("VIGENTES");
  const sesion = useMemo(() => ({ rol, idEmpleado }), [rol, idEmpleado]);
  const cargar = useCallback(
    () => (idEmpleado ? listarConvocatoriasEmpleado(sesion, estado) : Promise.resolve(null)),
    [sesion, idEmpleado, estado],
  );
  const { datos, error, cargando, reintentar } = useRecurso(cargar);
  const avisar = useAvisos();
  const [postulando, setPostulando] = useState(null);

  // KAN-81: la postulación se valida al registrarla; el aviso dice si quedó apto, no apto o pendiente.
  const postular = async (convocatoria) => {
    setPostulando(convocatoria.id_convocatoria);
    try {
      const postulacion = await postularConvocatoria(sesion, convocatoria.id_convocatoria);
      const resultado = {
        APTO: { tono: "exito", mensaje: "Cumple los requisitos: quedó como apto para el ranking de méritos." },
        NO_APTO: { tono: "aviso", mensaje: "No cumple algún requisito. Revise los motivos en la convocatoria." },
        PENDIENTE_VALIDACION: { tono: "info", mensaje: "Recursos Humanos completará la validación de méritos." },
      }[postulacion.estado_postulacion];
      avisar({ tono: resultado.tono, titulo: `Postulación registrada: ${convocatoria.titulo}`, mensaje: resultado.mensaje });
    } catch (fallo) {
      avisar({ tono: "peligro", titulo: "No se pudo registrar la postulación", mensaje: fallo.message });
    } finally {
      setPostulando(null);
      reintentar();
    }
  };

  const sinPermiso = error?.status === 403;

  return (
    <section className="cv-pagina" aria-labelledby="cv-titulo-empleado">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Ascensos" }]}
        enlace={Link}
        titulo="Convocatorias de ascenso"
        idTitulo="cv-titulo-empleado"
        descripcion="Vacantes internas publicadas por Recursos Humanos para el plan de carrera. Solo las ven los empleados activos."
        acciones={
          idEmpleado && (
            <Boton icono={RefreshCw} onClick={reintentar} cargando={cargando && Boolean(datos)}>
              Actualizar
            </Boton>
          )
        }
      />

      {!idEmpleado && (
        <Tarjeta>
          <EstadoVacio
            icono={UserRound}
            titulo="Elija su usuario de prueba"
            mensaje="Seleccione quién es en «Usuario de prueba», al pie de la barra lateral, para ver las convocatorias disponibles."
          />
        </Tarjeta>
      )}

      {idEmpleado && sinPermiso && (
        <Tarjeta>
          <EstadoVacio icono={ShieldAlert} titulo="Acceso solo para empleados activos" mensaje={MENSAJE_SOLO_ACTIVOS} />
        </Tarjeta>
      )}

      {idEmpleado && error && !sinPermiso && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar las convocatorias"
          acciones={
            <Boton tamano="sm" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          {error.message}
        </Alerta>
      )}

      {idEmpleado && !error && (
        <div className="cv-apilado">
          <div className="cv-filtros">
            <Selector
              etiqueta="Mostrar"
              value={estado}
              onChange={(evento) => setEstado(evento.target.value)}
              opciones={FILTROS_ESTADO_EMPLEADO}
            />
            {datos && (
              <p className="cv-total" role="status">
                {datos.total} {datos.total === 1 ? "convocatoria" : "convocatorias"}
              </p>
            )}
          </div>

          {!datos && <Esqueleto forma="bloque" alto="12rem" />}

          {datos && datos.convocatorias.length === 0 && (
            <Tarjeta>
              <EstadoVacio icono={Megaphone} titulo="No hay convocatorias para mostrar" mensaje={MENSAJES_VACIO[estado]} />
            </Tarjeta>
          )}

          {datos && datos.convocatorias.length > 0 && (
            <ul className={cargando ? "cv-rejilla cv-actualizando" : "cv-rejilla"} aria-label="Convocatorias de ascenso" aria-busy={cargando}>
              {datos.convocatorias.map((convocatoria) => (
                <TarjetaConvocatoria
                  key={convocatoria.id_convocatoria}
                  convocatoria={convocatoria}
                  onPostular={postular}
                  postulando={postulando === convocatoria.id_convocatoria}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
