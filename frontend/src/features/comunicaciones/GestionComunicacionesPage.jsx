import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Megaphone,
  Send,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  consultarAuditoria,
  consultarEnviados,
  emitirComunicadoInstitucional,
  enviarComunicacionDirecta,
  obtenerDestinatariosDisponibles,
} from "../../api/comunicaciones";
import {
  Alerta,
  Avatar,
  Boton,
  CampoAreaTexto,
  CampoTexto,
  Casilla,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  Modal,
  Pestanas,
  Selector,
  Tabla,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import { useRol } from "../../context/sesion";
import { puedeAcceder } from "../../utils/permisos";
import { formatearFecha, formatearFechaLarga } from "./formatoFecha";
import "./comunicaciones.css";

export default function GestionComunicacionesPage() {
  const avisar = useAvisos();
  const rol = useRol();
  const esAdminOGerente = puedeAcceder(rol, ["admin", "gerente"]);

  const [pestanaSeleccionada, setPestanaSeleccionada] = useState(
    () => (puedeAcceder(rol, ["admin", "gerente"]) ? "institucional" : "directo")
  );

  const pestanaActiva =
    !esAdminOGerente && pestanaSeleccionada === "institucional" ? "directo" : pestanaSeleccionada;

  // Destinatarios y catálogos disponibles desde el backend
  const [destinatariosData, setDestinatariosData] = useState({
    empleados: [],
    departamentos: [],
    sucursales: [],
  });

  // Identidad activa del remitente
  const idRemitenteSugerido = useMemo(() => {
    if (rol === "supervisor") {
      const sup = destinatariosData.empleados.find(
        (e) => (e.cargo && e.cargo.toLowerCase().includes("supervisor")) || e.id_empleado === "cb7995a6-4b23-4738-ab8b-37d0b203d73b"
      );
      if (sup) return sup.id_empleado;
      return "cb7995a6-4b23-4738-ab8b-37d0b203d73b"; // Luis Rojas Vargas
    }
    const adminEmp = destinatariosData.empleados.find(
      (e) => e.id_empleado === "4192f252-acf0-4522-a109-e051cad9a50b"
    );
    if (adminEmp) return adminEmp.id_empleado;
    return localStorage.getItem("rrhh.idEmpleado") || "4192f252-acf0-4522-a109-e051cad9a50b";
  }, [rol, destinatariosData.empleados]);

  const [idRemitente, setIdRemitente] = useState(
    () => localStorage.getItem("rrhh.idRemitente") || localStorage.getItem("rrhh.idEmpleado") || ""
  );

  const idRemitenteEfectivo = idRemitente || idRemitenteSugerido;

  // Lista de enviados
  const [enviados, setEnviados] = useState([]);
  const [cargandoEnviados, setCargandoEnviados] = useState(false);
  const [errorEnviados, setErrorEnviados] = useState(null);

  // Auditoría Modal (RF-67)
  const [auditoriaSeleccionada, setAuditoriaSeleccionada] = useState(null);
  const [cargandoAuditoria, setCargandoAuditoria] = useState(false);

  // ----------------------------------------------------
  // Formulario 1: Comunicado Institucional (RF-65)
  // ----------------------------------------------------
  const [formInst, setFormInst] = useState({
    tipo_codigo: "COMUNICADO",
    alcance_codigo: "GENERAL",
    id_departamento_destino: "",
    id_sucursal_destino: "",
    asunto: "",
    contenido: "",
    requiere_confirmacion: false,
  });
  const [erroresInst, setErroresInst] = useState({});
  const [enviandoInst, setEnviandoInst] = useState(false);
  const [alertaInst, setAlertaInst] = useState(null);

  // ----------------------------------------------------
  // Formulario 2: Mensaje Directo (RF-64)
  // ----------------------------------------------------
  const [formDir, setFormDir] = useState({
    id_empleado_destinatario: "",
    asunto: "",
    contenido: "",
    requiere_confirmacion: false,
  });
  const [erroresDir, setErroresDir] = useState({});
  const [enviandoDir, setEnviandoDir] = useState(false);
  const [alertaDir, setAlertaDir] = useState(null);

  // Cargar destinatarios disponibles
  useEffect(() => {
    obtenerDestinatariosDisponibles()
      .then((datos) => {
        setDestinatariosData({
          empleados: datos.empleados || [],
          departamentos: datos.departamentos || [],
          sucursales: datos.sucursales || [],
        });
      })
      .catch((err) => {
        console.error("Error al cargar destinatarios:", err);
      });
  }, []);

  // Cargar enviados
  useEffect(() => {
    if (pestanaActiva !== "enviados") return;
    let cancelado = false;

    consultarEnviados(idRemitenteEfectivo, rol)
      .then((datos) => {
        if (cancelado) return;
        setEnviados(datos || []);
        setErrorEnviados(null);
      })
      .catch((err) => {
        if (cancelado) return;
        setErrorEnviados(err.message || "Error al cargar la lista de enviados.");
      })
      .finally(() => {
        if (!cancelado) setCargandoEnviados(false);
      });

    return () => {
      cancelado = true;
    };
  }, [pestanaActiva, idRemitenteEfectivo, rol]);

  const recargarEnviados = useCallback(() => {
    setCargandoEnviados(true);
    setErrorEnviados(null);
    consultarEnviados(idRemitenteEfectivo, rol)
      .then((datos) => {
        setEnviados(datos || []);
      })
      .catch((err) => {
        setErrorEnviados(err.message || "Error al cargar la lista de enviados.");
      })
      .finally(() => setCargandoEnviados(false));
  }, [idRemitenteEfectivo, rol]);

  // Cálculo de estimación de destinatarios activos para el alcance institucional
  const estimacionDestinatarios = useMemo(() => {
    const { empleados } = destinatariosData;
    const activos = empleados.filter((e) => e.activo);

    if (formInst.alcance_codigo === "GENERAL") {
      return { total: activos.length, esCero: activos.length === 0 };
    }

    if (formInst.alcance_codigo === "DEPARTAMENTO") {
      if (!formInst.id_departamento_destino) return { total: 0, noSeleccionado: true };
      const enDepto = activos.filter((e) => e.id_departamento === formInst.id_departamento_destino);
      return { total: enDepto.length, esCero: enDepto.length === 0 };
    }

    if (formInst.alcance_codigo === "SUCURSAL") {
      if (!formInst.id_sucursal_destino) return { total: 0, noSeleccionado: true };
      const enSuc = activos.filter((e) => e.id_sucursal === formInst.id_sucursal_destino);
      return { total: enSuc.length, esCero: enSuc.length === 0 };
    }

    return { total: 0 };
  }, [formInst.alcance_codigo, formInst.id_departamento_destino, formInst.id_sucursal_destino, destinatariosData]);

  // Empleado seleccionado para mensaje directo
  const empleadoDirectoSeleccionado = useMemo(() => {
    return destinatariosData.empleados.find((e) => e.id_empleado === formDir.id_empleado_destinatario);
  }, [formDir.id_empleado_destinatario, destinatariosData.empleados]);

  // Manejar envío de Comunicado Institucional (RF-65)
  const handleEnviarInstitucional = async (e) => {
    e.preventDefault();
    setAlertaInst(null);
    setErroresInst({});

    // Validaciones locales iniciales
    const errores = {};
    if (!formInst.asunto.trim()) errores.asunto = "El asunto es requerido.";
    if (!formInst.contenido.trim()) errores.contenido = "El contenido es requerido.";

    if (formInst.alcance_codigo === "DEPARTAMENTO" && !formInst.id_departamento_destino) {
      errores.id_departamento_destino = "Seleccione un departamento de destino.";
    }
    if (formInst.alcance_codigo === "SUCURSAL" && !formInst.id_sucursal_destino) {
      errores.id_sucursal_destino = "Seleccione una sucursal de destino.";
    }

    if (Object.keys(errores).length > 0) {
      setErroresInst(errores);
      return;
    }

    setEnviandoInst(true);
    try {
      // RF-65 AC 1 & 2: Emisión y entrega
      const res = await emitirComunicadoInstitucional(formInst, idRemitenteEfectivo, rol);
      avisar({
        tono: "exito",
        titulo: "Comunicado emitido",
        mensaje: res.mensaje || `Entregado a ${res.cantidad_destinatarios} empleados activos.`,
      });

      // Limpiar formulario
      setFormInst({
        tipo_codigo: "COMUNICADO",
        alcance_codigo: "GENERAL",
        id_departamento_destino: "",
        id_sucursal_destino: "",
        asunto: "",
        contenido: "",
        requiere_confirmacion: false,
      });

      // Cambiar a la pestaña de enviados para ver el resultado
      setCargandoEnviados(true);
      setPestanaSeleccionada("enviados");
    } catch (err) {
      // RF-65 AC 3: Si el grupo no tiene activos, el backend informa y no registra el intento
      setAlertaInst({
        titulo: "No se pudo emitir el comunicado",
        mensaje: err.message,
      });
      if (err.detalles) {
        const dObj = {};
        err.detalles.forEach((d) => (dObj[d.campo] = d.mensaje));
        setErroresInst(dObj);
      }
    } finally {
      setEnviandoInst(false);
    }
  };

  // Manejar envío de Mensaje Directo (RF-64)
  const handleEnviarDirecto = async (e) => {
    e.preventDefault();
    setAlertaDir(null);
    setErroresDir({});

    const errores = {};
    if (!formDir.id_empleado_destinatario) {
      errores.id_empleado_destinatario = "Seleccione un empleado destinatario.";
    }
    if (!formDir.asunto.trim()) errores.asunto = "El asunto es requerido.";
    if (!formDir.contenido.trim()) errores.contenido = "El contenido es requerido.";

    if (Object.keys(errores).length > 0) {
      setErroresDir(errores);
      return;
    }

    setEnviandoDir(true);
    try {
      // RF-64 AC 1: Almacena y entrega en bandeja
      const res = await enviarComunicacionDirecta(formDir, idRemitenteEfectivo, rol);
      avisar({
        tono: "exito",
        titulo: "Mensaje directo enviado",
        mensaje: `Entregado en la bandeja de ${res.destinatario?.nombre_completo || "destinatario"}.`,
      });

      // Limpiar formulario
      setFormDir({
        id_empleado_destinatario: "",
        asunto: "",
        contenido: "",
        requiere_confirmacion: false,
      });

      setCargandoEnviados(true);
      setPestanaSeleccionada("enviados");
    } catch (err) {
      // RF-64 AC 4: Si no es activo, el sistema rechaza y da el motivo
      setAlertaDir({
        titulo: "No se pudo enviar el mensaje",
        mensaje: err.message,
      });
      if (err.detalles) {
        const dObj = {};
        err.detalles.forEach((d) => (dObj[d.campo] = d.mensaje));
        setErroresDir(dObj);
      }
    } finally {
      setEnviandoDir(false);
    }
  };

  // Abrir auditoría de una comunicación (RF-67 AC 2 & 3)
  const handleAbrirAuditoria = async (comunicacion) => {
    setCargandoAuditoria(true);
    setAuditoriaSeleccionada(null);

    try {
      const auditoria = await consultarAuditoria(comunicacion.id_comunicacion, idRemitenteEfectivo, rol);
      setAuditoriaSeleccionada(auditoria);
    } catch (err) {
      avisar({ tono: "peligro", titulo: "Error al cargar auditoría", mensaje: err.message });
    } finally {
      setCargandoAuditoria(false);
    }
  };

  // Opciones para selectors
  const opcionesTipos = [
    { valor: "COMUNICADO", etiqueta: "Comunicado institucional" },
    { valor: "CIRCULAR", etiqueta: "Circular interna" },
    { valor: "REGLAMENTO", etiqueta: "Reglamento / Disposición oficial" },
  ];

  const opcionesAlcance = [
    { valor: "GENERAL", etiqueta: "Toda la organización (General)" },
    { valor: "DEPARTAMENTO", etiqueta: "Por departamento / Área" },
    { valor: "SUCURSAL", etiqueta: "Por sucursal" },
  ];

  const opcionesDepartamentos = destinatariosData.departamentos.map((d) => ({
    valor: d.id_departamento,
    etiqueta: d.nombre,
  }));

  const opcionesSucursales = destinatariosData.sucursales.map((s) => ({
    valor: s.id_sucursal,
    etiqueta: `${s.nombre} (${s.ciudad})`,
  }));

  const opcionesEmpleados = destinatariosData.empleados.map((emp) => ({
    valor: emp.id_empleado,
    etiqueta: `${emp.nombre_completo || `${emp.nombres || ""} ${emp.apellidos || ""}`.trim() || "Empleado"} — ${emp.cargo || "Funcionario"}${emp.activo ? "" : " [INACTIVO]"}`,
  }));

  const opcionesRemitente = useMemo(() => {
    return destinatariosData.empleados
      .filter((e) => e.activo)
      .map((emp) => ({
        valor: emp.id_empleado,
        etiqueta: `${emp.nombre_completo || `${emp.nombres || ""} ${emp.apellidos || ""}`.trim()} — ${emp.cargo || "Funcionario"}`,
      }));
  }, [destinatariosData.empleados]);

  // Columnas para la tabla de enviados (RF-64 AC 3, RF-65 AC 2)
  const columnasEnviados = [
    {
      clave: "asunto",
      titulo: "Asunto / Tipo",
      celda: (fila) => (
        <div>
          <div style={{ fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }}>{fila.asunto}</div>
          <div style={{ display: "flex", gap: "var(--space-1)", marginTop: 2 }}>
            <Etiqueta tono={fila.tipo_codigo === "DIRECTA" ? "neutral" : "info"}>
              {fila.tipo_nombre || fila.tipo_codigo}
            </Etiqueta>
            {fila.requiere_confirmacion && (
              <Etiqueta tono="peligro" icono={ShieldAlert}>
                Obligatorio
              </Etiqueta>
            )}
          </div>
        </div>
      ),
    },
    {
      clave: "destino",
      titulo: "Destinatario / Alcance",
      celda: (fila) => {
        if (fila.alcance_codigo === "INDIVIDUAL") {
          return <span>{fila.nombre_destinatario_directo || "Empleado directo"}</span>;
        }
        return (
          <span>
            {fila.alcance_nombre || fila.alcance_codigo}
            {fila.nombre_grupo_destino ? `: ${fila.nombre_grupo_destino}` : ""}
          </span>
        );
      },
    },
    {
      clave: "fecha_envio",
      titulo: "Fecha de envío",
      celda: (fila) => <time dateTime={fila.fecha_envio}>{formatearFecha(fila.fecha_envio)}</time>,
    },
    {
      clave: "cantidad_destinatarios",
      titulo: "Destinatarios",
      celda: (fila) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Users className="ds-icono" style={{ color: "var(--color-text-subtle)" }} />
          <strong>{fila.cantidad_destinatarios}</strong>
        </span>
      ),
    },
    {
      clave: "confirmaciones",
      titulo: "Confirmaciones",
      celda: (fila) => {
        if (!fila.requiere_confirmacion) {
          return <span style={{ color: "var(--color-text-subtle)", fontSize: "var(--font-size-small)" }}>Informativo</span>;
        }
        const confirmados = fila.total_confirmados ?? 0;
        const total = fila.cantidad_destinatarios;
        return (
          <Etiqueta tono={confirmados === total && total > 0 ? "exito" : "aviso"}>
            {confirmados} de {total} confirmados
          </Etiqueta>
        );
      },
    },
    {
      clave: "acciones",
      titulo: "Acciones",
      alinear: "derecha",
      celda: (fila) => (
        <Boton
          tamano="sm"
          variante="predeterminado"
          icono={Eye}
          onClick={() => handleAbrirAuditoria(fila)}
        >
          Auditoría
        </Boton>
      ),
    },
  ];

  const pestanas = useMemo(() => {
    const lista = [];
    if (esAdminOGerente) {
      lista.push({
        id: "institucional",
        etiqueta: "Emitir comunicado",
        icono: Megaphone,
      });
    }
    lista.push(
      {
        id: "directo",
        etiqueta: "Mensaje directo",
        icono: Send,
      },
      {
        id: "enviados",
        etiqueta: "Enviados y auditoría",
        icono: FileText,
        contador: enviados.length > 0 ? enviados.length : undefined,
      }
    );
    return lista;
  }, [esAdminOGerente, enviados.length]);

  return (
    <section className="comunicaciones" aria-labelledby="gestion-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Comunicaciones" }]}
        enlace={Link}
        titulo="Gestión de comunicaciones"
        idTitulo="gestion-titulo"
        descripcion="Emisión de comunicados institucionales, mensajes directos a empleados y auditoría de lecturas."
        acciones={
          opcionesRemitente.length > 0 && (
            <div style={{ minWidth: 260 }}>
              <Selector
                etiqueta="Remitente (Identidad activa)"
                ayuda={`Rol actual: ${rol}`}
                value={idRemitenteEfectivo}
                onChange={(e) => {
                  setIdRemitente(e.target.value);
                  try {
                    localStorage.setItem("rrhh.idRemitente", e.target.value);
                  } catch {
                    /* sin almacenamiento */
                  }
                }}
                opciones={opcionesRemitente}
              />
            </div>
          )
        }
      >
        <Pestanas pestanas={pestanas} activa={pestanaActiva} onCambiar={setPestanaSeleccionada} />
      </EncabezadoPagina>

      {/* ==================================================== */}
      {/* PESTAÑA 1: COMUNICADO INSTITUCIONAL (RF-65, RF-67) */}
      {/* ==================================================== */}
      {pestanaActiva === "institucional" && (
        <Tarjeta>
          {alertaInst && (
            <Alerta
              tono="peligro"
              role="alert"
              titulo={alertaInst.titulo}
              onCerrar={() => setAlertaInst(null)}
              style={{ marginBottom: "var(--space-3)" }}
            >
              {alertaInst.mensaje}
            </Alerta>
          )}

          <form onSubmit={handleEnviarInstitucional} className="form-comunicado" noValidate>
            <div className="form-comunicado__fila-doble">
              <Selector
                id="inst-tipo"
                etiqueta="Tipo de comunicación"
                opciones={opcionesTipos}
                value={formInst.tipo_codigo}
                onChange={(e) => setFormInst((p) => ({ ...p, tipo_codigo: e.target.value }))}
                requerido
              />

              <Selector
                id="inst-alcance"
                etiqueta="Alcance de distribución"
                opciones={opcionesAlcance}
                value={formInst.alcance_codigo}
                onChange={(e) =>
                  setFormInst((p) => ({
                    ...p,
                    alcance_codigo: e.target.value,
                    id_departamento_destino: "",
                    id_sucursal_destino: "",
                  }))
                }
                requerido
              />
            </div>

            {/* Selector condicional de departamento */}
            {formInst.alcance_codigo === "DEPARTAMENTO" && (
              <Selector
                id="inst-depto"
                etiqueta="Departamento / Área de destino"
                opciones={opcionesDepartamentos}
                textoVacio="Seleccione un departamento…"
                value={formInst.id_departamento_destino}
                onChange={(e) => setFormInst((p) => ({ ...p, id_departamento_destino: e.target.value }))}
                error={erroresInst.id_departamento_destino}
                requerido
              />
            )}

            {/* Selector condicional de sucursal */}
            {formInst.alcance_codigo === "SUCURSAL" && (
              <Selector
                id="inst-sucursal"
                etiqueta="Sucursal de destino"
                opciones={opcionesSucursales}
                textoVacio="Seleccione una sucursal…"
                value={formInst.id_sucursal_destino}
                onChange={(e) => setFormInst((p) => ({ ...p, id_sucursal_destino: e.target.value }))}
                error={erroresInst.id_sucursal_destino}
                requerido
              />
            )}

            {/* Previsualización del alcance (RF-65 AC 2 & 3) */}
            <div className="form-comunicado__previsualizacion">
              <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <Users className="ds-icono" aria-hidden="true" />
                Destinatarios estimados para este alcance:
              </span>
              {estimacionDestinatarios.noSeleccionado ? (
                <span style={{ color: "var(--color-text-subtle)" }}>Seleccione un grupo para estimar</span>
              ) : estimacionDestinatarios.esCero ? (
                <Etiqueta tono="peligro" icono={AlertCircle}>
                  0 empleados activos (Sin destinatarios)
                </Etiqueta>
              ) : (
                <Etiqueta tono="info" icono={CheckCircle2}>
                  {estimacionDestinatarios.total} empleados activos
                </Etiqueta>
              )}
            </div>

            <CampoTexto
              id="inst-asunto"
              etiqueta="Asunto del comunicado"
              placeholder="Ej.: Nuevas políticas de seguridad y confidencialidad 2026"
              value={formInst.asunto}
              onChange={(e) => setFormInst((p) => ({ ...p, asunto: e.target.value }))}
              error={erroresInst.asunto}
              requerido
              maxLength={150}
              ayuda={`${formInst.asunto.length}/150 caracteres`}
            />

            <CampoAreaTexto
              id="inst-contenido"
              etiqueta="Contenido del mensaje"
              placeholder="Redacte las instrucciones, circular o anuncio para el personal…"
              value={formInst.contenido}
              onChange={(e) => setFormInst((p) => ({ ...p, contenido: e.target.value }))}
              error={erroresInst.contenido}
              requerido
              filas={6}
            />

            {/* Checkbox de confirmación obligatoria (RF-67) */}
            <Casilla
              id="inst-requiere-conf"
              etiqueta="Exigir confirmación obligatoria de recepción y lectura"
              ayuda="Los empleados receptores deberán confirmar explícitamente haber leído el documento. Podrá auditar quiénes ya lo confirmaron y quiénes están pendientes."
              checked={formInst.requiere_confirmacion}
              onChange={(e) => setFormInst((p) => ({ ...p, requiere_confirmacion: e.target.checked }))}
            />

            <div className="form-comunicado__acciones">
              <Boton
                type="submit"
                variante="primario"
                icono={Megaphone}
                cargando={enviandoInst}
                disabled={enviandoInst || estimacionDestinatarios.esCero}
              >
                Emitir comunicado a {estimacionDestinatarios.total || 0} destinatario(s)
              </Boton>
            </div>
          </form>
        </Tarjeta>
      )}

      {/* ==================================================== */}
      {/* PESTAÑA 2: MENSAJE DIRECTO (RF-64)                 */}
      {/* ==================================================== */}
      {pestanaActiva === "directo" && (
        <Tarjeta>
          {alertaDir && (
            <Alerta
              tono="peligro"
              role="alert"
              titulo={alertaDir.titulo}
              onCerrar={() => setAlertaDir(null)}
              style={{ marginBottom: "var(--space-3)" }}
            >
              {alertaDir.mensaje}
            </Alerta>
          )}

          <form onSubmit={handleEnviarDirecto} className="form-comunicado" noValidate>
            <Selector
              id="dir-destinatario"
              etiqueta="Empleado destinatario"
              opciones={opcionesEmpleados}
              textoVacio="Seleccione un empleado…"
              value={formDir.id_empleado_destinatario}
              onChange={(e) => setFormDir((p) => ({ ...p, id_empleado_destinatario: e.target.value }))}
              error={erroresDir.id_empleado_destinatario}
              ayuda="Seleccione un funcionario activo. Si selecciona un inactivo, el sistema rechazará la entrega (RF-64 Criterio 4)."
              requerido
            />

            {/* Aviso si se selecciona un empleado inactivo para pruebas */}
            {empleadoDirectoSeleccionado && !empleadoDirectoSeleccionado.activo && (
              <Alerta tono="peligro" titulo="Empleado inactivo seleccionado">
                «{empleadoDirectoSeleccionado.nombres} {empleadoDirectoSeleccionado.apellidos}» no es un empleado activo.
                Al intentar enviar, el sistema rechazará formalmente el mensaje indicando el motivo exacto.
              </Alerta>
            )}

            <CampoTexto
              id="dir-asunto"
              etiqueta="Asunto del mensaje"
              placeholder="Ej.: Coordinación sobre cronograma de inventario"
              value={formDir.asunto}
              onChange={(e) => setFormDir((p) => ({ ...p, asunto: e.target.value }))}
              error={erroresDir.asunto}
              requerido
              maxLength={150}
              ayuda={`${formDir.asunto.length}/150 caracteres`}
            />

            <CampoAreaTexto
              id="dir-contenido"
              etiqueta="Contenido del mensaje"
              placeholder="Escriba la comunicación formal o instrucción directa para el empleado…"
              value={formDir.contenido}
              onChange={(e) => setFormDir((p) => ({ ...p, contenido: e.target.value }))}
              error={erroresDir.contenido}
              requerido
              filas={6}
            />

            <Casilla
              id="dir-requiere-conf"
              etiqueta="Exigir confirmación explícita de recepción"
              ayuda="El empleado recibirá una solicitud para confirmar la recepción formal del mensaje."
              checked={formDir.requiere_confirmacion}
              onChange={(e) => setFormDir((p) => ({ ...p, requiere_confirmacion: e.target.checked }))}
            />

            <div className="form-comunicado__acciones">
              <Boton type="submit" variante="primario" icono={Send} cargando={enviandoDir} disabled={enviandoDir}>
                Enviar comunicación directa
              </Boton>
            </div>
          </form>
        </Tarjeta>
      )}

      {/* ==================================================== */}
      {/* PESTAÑA 3: ENVIADOS Y AUDITORÍA (RF-64 AC 3, RF-67) */}
      {/* ==================================================== */}
      {pestanaActiva === "enviados" && (
        <Tarjeta>
          {errorEnviados && (
            <Alerta
              tono="peligro"
              role="alert"
              titulo="No se pudieron cargar los enviados"
              acciones={
                <Boton tamano="sm" onClick={recargarEnviados}>
                  Reintentar
                </Boton>
              }
            >
              {errorEnviados}
            </Alerta>
          )}

          <Tabla
            columnas={columnasEnviados}
            filas={enviados}
            cargando={cargandoEnviados}
            vacio={
              <EstadoVacio
                icono={FileText}
                titulo="Sin comunicaciones enviadas"
                mensaje="Aún no ha emitido comunicados ni mensajes directos."
                accion={
                  <Boton tamano="sm" onClick={() => setPestanaSeleccionada(esAdminOGerente ? "institucional" : "directo")}>
                    {esAdminOGerente ? "Emitir comunicado" : "Enviar mensaje directo"}
                  </Boton>
                }
              />
            }
          />
        </Tarjeta>
      )}

      {/* ==================================================== */}
      {/* MODAL DE AUDITORÍA Y CONFIRMACIONES (RF-67 AC 2 & 3) */}
      {/* ==================================================== */}
      <Modal
        abierto={Boolean(auditoriaSeleccionada || cargandoAuditoria)}
        titulo="Auditoría de recepción y lectura"
        onCerrar={() => setAuditoriaSeleccionada(null)}
        tamano="lg"
        pie={
          <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
            <Boton onClick={() => setAuditoriaSeleccionada(null)}>Cerrar auditoría</Boton>
          </div>
        }
      >
        {cargandoAuditoria ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <Esqueleto alto="40px" />
            <Esqueleto alto="120px" />
          </div>
        ) : auditoriaSeleccionada ? (
          <div>
            <div style={{ marginBottom: "var(--space-3)" }}>
              <h3 style={{ margin: 0, fontSize: "var(--font-size-section)", color: "var(--color-text)" }}>
                {auditoriaSeleccionada.comunicacion.asunto}
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "var(--font-size-small)", color: "var(--color-text-subtle)" }}>
                Emitido el {formatearFechaLarga(auditoriaSeleccionada.comunicacion.fecha_envio)}
              </p>
            </div>

            {/* Tarjetas con métricas cuantitativas */}
            <div className="auditoria-metricas">
              <div className="auditoria-metrica-card">
                <p className="auditoria-metrica-card__titulo">Destinatarios totales</p>
                <p className="auditoria-metrica-card__valor">{auditoriaSeleccionada.metricas.total}</p>
              </div>

              <div className="auditoria-metrica-card auditoria-metrica-card--destacada">
                <p className="auditoria-metrica-card__titulo">Confirmaron recepción</p>
                <p className="auditoria-metrica-card__valor" style={{ color: "var(--color-success-text)" }}>
                  {auditoriaSeleccionada.metricas.confirmados}
                </p>
              </div>

              <div className="auditoria-metrica-card">
                <p className="auditoria-metrica-card__titulo">Pendientes de confirmar</p>
                <p className="auditoria-metrica-card__valor" style={{ color: "var(--color-warning-text)" }}>
                  {auditoriaSeleccionada.metricas.pendientes}
                </p>
              </div>

              <div className="auditoria-metrica-card">
                <p className="auditoria-metrica-card__titulo">Sin abrir (No leídos)</p>
                <p className="auditoria-metrica-card__valor" style={{ color: "var(--color-danger-text)" }}>
                  {auditoriaSeleccionada.metricas.no_leidos}
                </p>
              </div>
            </div>

            <div className="auditoria-listas">
              {/* RF-67 AC 2: Empleados que confirmaron recepción con fecha */}
              <div>
                <h4 style={{ margin: "0 0 var(--space-2) 0", fontSize: "var(--font-size-body)", color: "var(--color-text)" }}>
                  <CheckCircle2
                    className="ds-icono"
                    style={{ color: "var(--color-success)", verticalAlign: "middle", marginRight: 6 }}
                  />
                  Confirmados ({auditoriaSeleccionada.confirmados.length})
                </h4>

                {auditoriaSeleccionada.confirmados.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "var(--font-size-small)", color: "var(--color-text-subtle)" }}>
                    Ningún destinatario ha confirmado la recepción todavía.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    {auditoriaSeleccionada.confirmados.map((item) => (
                      <div
                        key={item.id_destinatario}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "var(--space-2)",
                          background: "var(--color-bg-page)",
                          borderRadius: "var(--radius-control)",
                          border: "var(--border-width) solid var(--color-border)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                          <Avatar nombre={item.nombre_empleado} tamano="sm" decorativo />
                          <div>
                            <span style={{ fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }}>
                              {item.nombre_empleado}
                            </span>
                            <span style={{ fontSize: "var(--font-size-small)", color: "var(--color-text-subtle)", marginLeft: 6 }}>
                              ({item.cargo})
                            </span>
                          </div>
                        </div>

                        <Etiqueta tono="exito" icono={Clock}>
                          {formatearFechaLarga(item.fecha_confirmacion)}
                        </Etiqueta>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* RF-67 AC 3: Destinatarios pendientes */}
              <div>
                <h4 style={{ margin: "0 0 var(--space-2) 0", fontSize: "var(--font-size-body)", color: "var(--color-text)" }}>
                  <Clock
                    className="ds-icono"
                    style={{ color: "var(--color-warning)", verticalAlign: "middle", marginRight: 6 }}
                  />
                  Pendientes ({auditoriaSeleccionada.pendientes.length})
                </h4>

                {auditoriaSeleccionada.pendientes.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "var(--font-size-small)", color: "var(--color-success-text)" }}>
                    ¡Todos los destinatarios han confirmado la recepción!
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    {auditoriaSeleccionada.pendientes.map((item) => {
                      const esLeido = item.id_estado === 2 || item.estado_codigo === "LEIDO";
                      return (
                        <div
                          key={item.id_destinatario}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "var(--space-2)",
                            background: "var(--color-bg-surface)",
                            borderRadius: "var(--radius-control)",
                            border: "var(--border-width) solid var(--color-border)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                            <Avatar nombre={item.nombre_empleado} tamano="sm" decorativo />
                            <div>
                              <span style={{ color: "var(--color-text)" }}>{item.nombre_empleado}</span>
                              <span style={{ fontSize: "var(--font-size-small)", color: "var(--color-text-subtle)", marginLeft: 6 }}>
                                ({item.cargo})
                              </span>
                            </div>
                          </div>

                          <Etiqueta tono={esLeido ? "aviso" : "peligro"}>
                            {esLeido ? "Leído (Pendiente de confirmación)" : "No leído aún"}
                          </Etiqueta>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
