import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { Megaphone, Plus, RefreshCw, SearchX } from "lucide-react";
import { getCargos } from "../../api/cargosApi";
import { listarConvocatoriasRrhh, publicarConvocatoria, reintentarNotificacionConvocatoria } from "../../api/convocatoriasInternas";
import { getSucursales } from "../../api/sucursalesApi";
import { Alerta, Boton, EncabezadoPagina, EstadoVacio, Etiqueta, Selector, Tabla, Tarjeta, TextoTruncado, useAvisos } from "../../components/ui";
import { useRol, useUsuario } from "../../context/sesion";
import { puedeAcceder } from "../../utils/permisos";
import useRecurso from "../quejas/casos/useRecurso";
import ConvocatoriaFormulario from "./ConvocatoriaFormulario";
import PostulacionesModal from "./PostulacionesModal";
import {
  FILTROS_ESTADO_RRHH,
  describirPlazo,
  estadoConvocatoria,
  estadoNotificacion,
  formatearAntiguedad,
  formatearFecha,
  formatearNota,
  pluralEmpleados,
} from "./convocatorias";
import "./convocatorias.css";

export default function ConvocatoriasRrhhPage() {
  const avisar = useAvisos();
  const rol = useRol();
  const idEmpleado = useUsuario();
  const sesion = useMemo(() => ({ rol, idEmpleado }), [rol, idEmpleado]);
  const puedePublicar = puedeAcceder(rol, ["admin"]);

  const [estado, setEstado] = useState("");
  const [catalogos, setCatalogos] = useState(null);
  const [abriendo, setAbriendo] = useState(false);
  const [reintentando, setReintentando] = useState(null);
  const [revisando, setRevisando] = useState(null);

  const cargar = useCallback(() => listarConvocatoriasRrhh(sesion, estado), [sesion, estado]);
  const { datos, error, cargando, reintentar } = useRecurso(cargar);

  const abrirFormulario = async () => {
    setAbriendo(true);
    try {
      const [cargos, sucursales] = await Promise.all([getCargos(), getSucursales()]);
      setCatalogos({ cargos, sucursales });
    } catch (fallo) {
      avisar({ tono: "peligro", titulo: "No se pudo abrir el formulario", mensaje: fallo.message });
    } finally {
      setAbriendo(false);
    }
  };

  const publicar = async (payload) => {
    const publicada = await publicarConvocatoria(sesion, payload);
    setCatalogos(null);
    reintentar();
    if (publicada.notificacion.estado === "ENTREGADA") {
      avisar({
        tono: "exito",
        titulo: "Convocatoria publicada",
        mensaje: `Se notificó a ${pluralEmpleados(publicada.notificacion.destinatarios)}.`,
      });
    } else {
      avisar({
        tono: "aviso",
        titulo: "Convocatoria publicada sin notificar",
        mensaje: "No se pudo avisar a los empleados. Reintente la notificación desde la lista.",
      });
    }
  };

  const reintentarNotificacion = async (convocatoria) => {
    setReintentando(convocatoria.id_convocatoria);
    try {
      const actualizada = await reintentarNotificacionConvocatoria(sesion, convocatoria.id_convocatoria);
      const entregada = actualizada.notificacion.estado === "ENTREGADA";
      avisar({
        tono: entregada ? "exito" : "aviso",
        titulo: entregada ? "Convocatoria notificada" : "La notificación sigue pendiente",
        mensaje: entregada
          ? `Se notificó a ${pluralEmpleados(actualizada.notificacion.destinatarios)}.`
          : "NotificationService no respondió. Intente de nuevo en unos minutos.",
      });
    } catch (fallo) {
      avisar({ tono: "peligro", titulo: "No se pudo reintentar la notificación", mensaje: fallo.message });
    } finally {
      setReintentando(null);
      reintentar();
    }
  };

  const columnas = [
    {
      clave: "titulo",
      titulo: "Convocatoria",
      ancho: "26%",
      celda: (c) => (
        <div className="cv-celda">
          <TextoTruncado>{c.titulo}</TextoTruncado>
          <span className="cv-sutil">
            {c.cargo} · {c.sucursal}
          </span>
        </div>
      ),
    },
    {
      clave: "requisitos",
      titulo: "Requisitos",
      ancho: "18%",
      celda: (c) => (
        <div className="cv-celda">
          <span>{formatearAntiguedad(c.meses_antiguedad_minima)}</span>
          <span className="cv-sutil">Nota mínima {formatearNota(c.nota_minima_desempeno)}</span>
        </div>
      ),
    },
    {
      clave: "postulacion",
      titulo: "Postulaciones",
      ancho: "18%",
      celda: (c) => (
        <div className="cv-celda">
          <span className="cv-numero">
            {formatearFecha(c.fecha_inicio_postulacion)} - {formatearFecha(c.fecha_cierre_postulacion)}
          </span>
          <span className="cv-sutil">{describirPlazo(c)}</span>
        </div>
      ),
    },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "12%",
      celda: (c) => {
        const info = estadoConvocatoria(c.estado);
        return (
          <Etiqueta tono={info.tono} icono={info.icono}>
            {info.texto}
          </Etiqueta>
        );
      },
    },
    {
      clave: "notificacion",
      titulo: "Notificación",
      ancho: "16%",
      celda: (c) => {
        const info = estadoNotificacion(c.estado_notificacion);
        return (
          <div className="cv-celda">
            <Etiqueta tono={info.tono} icono={info.icono}>
              {info.texto}
            </Etiqueta>
            {c.estado_notificacion === "ENTREGADA" && <span className="cv-sutil">{pluralEmpleados(c.destinatarios_notificados)}</span>}
            {c.estado_notificacion === "FALLIDA" && c.ultimo_error_notificacion && (
              <span className="cv-sutil cv-error" title={c.ultimo_error_notificacion}>
                {c.ultimo_error_notificacion}
              </span>
            )}
          </div>
        );
      },
    },
    {
      clave: "acciones",
      titulo: "Acciones",
      alinear: "fin",
      ancho: "10%",
      celda: (c) => (
        <div className="cv-acciones">
          {c.estado !== "PROGRAMADA" && (
            <Boton tamano="sm" onClick={() => setRevisando(c)} aria-label={`Ver las postulaciones de ${c.titulo}`}>
              Postulaciones
            </Boton>
          )}
          {puedePublicar && c.estado_notificacion !== "ENTREGADA" && c.estado !== "CERRADA" && (
            <Boton tamano="sm" cargando={reintentando === c.id_convocatoria} onClick={() => reintentarNotificacion(c)}>
              Reintentar aviso
            </Boton>
          )}
        </div>
      ),
    },
  ];

  const botonPublicar = (
    <Boton variante="primario" icono={Plus} cargando={abriendo} onClick={abrirFormulario}>
      Publicar convocatoria
    </Boton>
  );

  const vacio = estado ? (
    <EstadoVacio
      icono={SearchX}
      titulo="Ninguna convocatoria coincide con el filtro"
      accion={<Boton onClick={() => setEstado("")}>Ver todas</Boton>}
    />
  ) : (
    <EstadoVacio
      icono={Megaphone}
      titulo="Aún no hay convocatorias internas"
      mensaje="Publique la primera para que los empleados activos conozcan las vacantes de ascenso."
      accion={puedePublicar ? botonPublicar : undefined}
    />
  );

  return (
    <section className="cv-pagina" aria-labelledby="cv-titulo-rrhh">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Ascensos" }]}
        enlace={Link}
        titulo="Convocatorias internas"
        idTitulo="cv-titulo-rrhh"
        descripcion="Publique vacantes de ascenso dirigidas solo a empleados activos. Al publicarlas se les notifica y, al llegar la fecha de cierre, dejan de aceptar postulaciones."
        acciones={
          <>
            <Boton icono={RefreshCw} onClick={reintentar} cargando={cargando && Boolean(datos)}>
              Actualizar
            </Boton>
            {puedePublicar && datos?.total > 0 && botonPublicar}
          </>
        }
      />

      {error ? (
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
      ) : (
        <Tarjeta nivelTitulo={2}>
          <div className="cv-filtros">
            <Selector
              etiqueta="Estado"
              value={estado}
              onChange={(evento) => setEstado(evento.target.value)}
              textoVacio="Todas"
              opciones={FILTROS_ESTADO_RRHH}
            />
            {datos && (
              <p className="cv-total" role="status">
                {datos.total} {datos.total === 1 ? "convocatoria" : "convocatorias"}
              </p>
            )}
          </div>
          <Tabla
            className="cv-tabla"
            descripcion="Convocatorias internas de ascenso"
            columnas={columnas}
            filas={datos?.convocatorias ?? []}
            claveFila="id_convocatoria"
            cargando={cargando && !datos}
            filasCargando={4}
            vacio={vacio}
          />
        </Tarjeta>
      )}

      {catalogos && (
        <ConvocatoriaFormulario
          cargos={catalogos.cargos}
          sucursales={catalogos.sucursales}
          onGuardar={publicar}
          onCancelar={() => setCatalogos(null)}
        />
      )}

      {revisando && (
        <PostulacionesModal
          convocatoria={revisando}
          sesion={sesion}
          puedeRevalidar={puedePublicar}
          onCerrar={() => setRevisando(null)}
        />
      )}
    </section>
  );
}
