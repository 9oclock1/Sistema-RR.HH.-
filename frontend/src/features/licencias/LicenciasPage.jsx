import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowLeftRight } from "lucide-react";
import { descargarComprobante, listarMisSolicitudes, listarTiposLicencia } from "../../api/licencias";
import { Alerta, Boton, EncabezadoPagina, useAvisos } from "../../components/ui";
import IdentificacionEmpleado from "../marcaje/IdentificacionEmpleado";
import { guardarEmpleado, leerEmpleado, olvidarEmpleado } from "../marcaje/sesionEmpleado";
import MisSolicitudes from "./MisSolicitudes";
import SolicitudLicenciaFormulario from "./SolicitudLicenciaFormulario";
import "./licencias.css";

const esRechazoDeIdentidad = (error) => error.estado === 401 || error.estado === 403;

export default function LicenciasPage() {
  const avisar = useAvisos();
  const [idInicial] = useState(leerEmpleado);
  const [idEmpleado, setIdEmpleado] = useState(idInicial);
  const [tipos, setTipos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(Boolean(idInicial));
  const [errorIdentificacion, setErrorIdentificacion] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const [radicada, setRadicada] = useState(null);
  const [enfocarIdentificacion, setEnfocarIdentificacion] = useState(false);
  const refResultado = useRef(null);

  const cargar = useCallback(
    (id) =>
      Promise.all([listarTiposLicencia(), listarMisSolicitudes(id)])
        .then(([listaTipos, listaSolicitudes]) => {
          guardarEmpleado(id);
          setIdEmpleado(id);
          setTipos(listaTipos);
          setSolicitudes(listaSolicitudes);
          setErrorCarga(null);
        })
        .catch((error) => {
          if (!esRechazoDeIdentidad(error)) {
            setErrorCarga(error.message);
            return;
          }
          olvidarEmpleado();
          setIdEmpleado(null);
          setErrorCarga(null);
          setErrorIdentificacion(error.message);
        })
        .finally(() => setCargando(false)),
    []
  );

  useEffect(() => {
    if (idInicial) cargar(idInicial);
  }, [cargar, idInicial]);

  useEffect(() => {
    if (radicada) refResultado.current?.focus();
  }, [radicada]);

  const identificar = (id) => {
    setErrorIdentificacion(null);
    setErrorCarga(null);
    setCargando(true);
    cargar(id);
  };

  const reintentar = () => {
    setErrorCarga(null);
    setCargando(true);
    cargar(idEmpleado);
  };

  const cambiarEmpleado = () => {
    olvidarEmpleado();
    setIdEmpleado(null);
    setSolicitudes([]);
    setRadicada(null);
    setEnfocarIdentificacion(true);
  };

  const alRadicar = (solicitud) => {
    setRadicada(solicitud);
    setSolicitudes((actuales) => [solicitud, ...actuales]);
  };

  const descargar = async (solicitud, adjunto) => {
    try {
      const blob = await descargarComprobante(idEmpleado, solicitud.id_solicitud, adjunto.id_adjunto);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = adjunto.nombre_original;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      avisar({ tono: "peligro", titulo: "No se pudo descargar el comprobante", mensaje: error.message });
    }
  };

  return (
    <section className="licencias" aria-labelledby="licencias-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Asistencia" }]}
        enlace={Link}
        titulo="Licencias y permisos"
        idTitulo="licencias-titulo"
        descripcion="Solicite licencias médicas, de maternidad, de paternidad, duelo, académicas o personales con su respaldo."
        acciones={
          idEmpleado && (
            <Boton variante="sutil" icono={ArrowLeftRight} onClick={cambiarEmpleado}>
              Cambiar empleado
            </Boton>
          )
        }
      />

      <div className="licencias-columna">
        {errorCarga && (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudo cargar la información"
            acciones={
              idEmpleado && (
                <Boton tamano="sm" onClick={reintentar} cargando={cargando}>
                  Reintentar
                </Boton>
              )
            }
          >
            {errorCarga}
          </Alerta>
        )}

        {!idEmpleado && (
          <IdentificacionEmpleado
            error={errorIdentificacion}
            procesando={cargando}
            enfocar={enfocarIdentificacion}
            onIdentificar={identificar}
            onEditar={() => setErrorIdentificacion(null)}
          />
        )}

        {idEmpleado && !errorCarga && (
          <>
            {radicada && (
              <Alerta
                ref={refResultado}
                tabIndex={-1}
                tono={radicada.requiere_autorizacion_rrhh ? "aviso" : "exito"}
                role="status"
                titulo="Solicitud enviada"
                onCerrar={() => setRadicada(null)}
              >
                <p>
                  Su solicitud de «{radicada.tipo_nombre}» ({radicada.dias_solicitados} día(s)) quedó{" "}
                  <strong>pendiente de aprobación</strong>.
                </p>
                {radicada.advertencias.map((advertencia) => (
                  <p key={advertencia}>{advertencia}</p>
                ))}
              </Alerta>
            )}
            {tipos.length > 0 && (
              <SolicitudLicenciaFormulario idEmpleado={idEmpleado} tipos={tipos} onRadicada={alRadicar} />
            )}
            <MisSolicitudes solicitudes={solicitudes} cargando={cargando} onDescargar={descargar} />
          </>
        )}
      </div>
    </section>
  );
}
