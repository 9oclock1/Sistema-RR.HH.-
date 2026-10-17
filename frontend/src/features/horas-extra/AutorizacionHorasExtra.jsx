import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { autorizarHorasExtra, listarPersonal } from "../../api/horasExtra";
import { Alerta, Boton, CampoAreaTexto, CampoTexto, Esqueleto, Modal, Selector } from "../../components/ui";
import { formatearMinutos, hoyBolivia } from "./formato";

const MAX_MOTIVO = 500;
const MAX_MINUTOS = 24 * 60;
const CAMPOS = { id_empleado: "colaborador", fecha_jornada: "fecha", minutos_autorizados: "minutos", motivo: "motivo" };
const ETIQUETAS = { colaborador: "Colaborador", fecha: "Día", minutos: "Minutos autorizados", motivo: "Motivo" };

const vacio = (hoy) => ({ colaborador: "", fecha: hoy, minutos: "120", motivo: "" });

function validar(datos, hoy) {
  const errores = {};
  const minutos = Number(datos.minutos);
  if (!datos.colaborador) errores.colaborador = "Seleccione al colaborador.";
  if (!datos.fecha) errores.fecha = "Elija el día.";
  else if (datos.fecha < hoy) errores.fecha = "La autorización es previa: elija hoy o un día posterior.";
  if (!Number.isInteger(minutos) || minutos <= 0 || minutos > MAX_MINUTOS) {
    errores.minutos = `Autorice entre 1 y ${MAX_MINUTOS} minutos.`;
  }
  if (!datos.motivo.trim()) errores.motivo = "Indique el motivo de las horas extra.";
  return errores;
}

// Autorización previa: cuántos minutos extra puede quedarse un colaborador un día. Al cerrar la jornada
// se aprueba sola hasta lo autorizado. Se monta al abrir, así el formulario empieza vacío.
export default function AutorizacionHorasExtra({ abierto, sucursal, revisor, onCerrar, onAutorizada }) {
  const hoy = hoyBolivia();
  const [datos, setDatos] = useState(() => vacio(hoy));
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [personal, setPersonal] = useState({ clave: null });
  const refResumen = useRef(null);
  const claveSucursal = abierto && sucursal ? `${sucursal.idSucursal}|${sucursal.idDepartamento}` : null;

  useEffect(() => {
    if (!claveSucursal) return undefined;
    let vigente = true;
    listarPersonal(sucursal)
      .then((lista) => vigente && setPersonal({ clave: claveSucursal, lista: lista.filter((e) => e.activo !== false) }))
      .catch((error) => vigente && setPersonal({ clave: claveSucursal, error: error.message }));
    return () => {
      vigente = false;
    };
    // `sucursal` cambia con la clave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveSucursal]);

  const listaErrores = Object.entries(errores).filter(([, mensaje]) => mensaje);
  useEffect(() => {
    if (listaErrores.length > 1 || errorGeneral) refResumen.current?.focus();
    // Solo al terminar un envío fallido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errores, errorGeneral]);

  const lista = personal.clave === claveSucursal ? personal.lista : null;
  const opciones = (lista ?? [])
    .filter((e) => e.id_empleado !== revisor?.id)
    .map((e) => ({
      valor: e.id_empleado,
      etiqueta: e.cargo ? `${e.nombre_completo} · ${e.cargo}` : e.nombre_completo,
    }));

  const cambiar = (campo) => (evento) => {
    setDatos((actual) => ({ ...actual, [campo]: evento.target.value }));
    if (errores[campo]) setErrores((actual) => ({ ...actual, [campo]: undefined }));
  };

  const cerrar = () => {
    if (!guardando) onCerrar();
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    const nuevos = validar(datos, hoy);
    setErrorGeneral(null);
    setErrores(nuevos);
    const primero = Object.keys(nuevos)[0];
    if (primero) {
      if (Object.keys(nuevos).length === 1) document.getElementById(`he-aut-${primero}`)?.focus();
      return;
    }
    setGuardando(true);
    try {
      const autorizacion = await autorizarHorasExtra(revisor.id, {
        idEmpleado: datos.colaborador,
        fecha: datos.fecha,
        minutos: Number(datos.minutos),
        motivo: datos.motivo.trim(),
      });
      onAutorizada(
        autorizacion,
        lista.find((e) => e.id_empleado === datos.colaborador)
      );
    } catch (error) {
      const deCampo = Object.fromEntries((error.detalles ?? []).map((d) => [CAMPOS[d.campo] ?? d.campo, d.mensaje]));
      if (Object.keys(deCampo).length > 0) setErrores(deCampo);
      else setErrorGeneral(error.message);
    } finally {
      setGuardando(false);
    }
  };

  const minutos = Number(datos.minutos);

  return (
    <Modal
      abierto={abierto}
      titulo="Autorizar horas extra"
      onCerrar={cerrar}
      bloqueado={guardando}
      pie={
        <>
          <Boton variante="sutil" onClick={cerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            icono={ShieldCheck}
            type="submit"
            form="he-autorizacion"
            cargando={guardando}
            disabled={!lista}
          >
            Autorizar
          </Boton>
        </>
      }
    >
      <form id="he-autorizacion" className="he-formulario" onSubmit={enviar} noValidate>
        <p className="he-sutil he-formulario__nota">
          Al cerrar la jornada se aprueban solas hasta los minutos autorizados; lo que pase de ahí queda para revisar.
        </p>
        {(listaErrores.length > 1 || errorGeneral) && (
          <Alerta
            ref={refResumen}
            tabIndex={-1}
            tono="peligro"
            role="alert"
            titulo="No se pudo registrar la autorización"
          >
            {errorGeneral ?? (
              <ul className="he-errores">
                {listaErrores.map(([campo, mensaje]) => (
                  <li key={campo}>
                    <a href={`#he-aut-${campo}`}>
                      {ETIQUETAS[campo] ?? campo}: {mensaje}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Alerta>
        )}
        {personal.error && personal.clave === claveSucursal && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo cargar el personal">
            {personal.error}
          </Alerta>
        )}
        {!lista && !personal.error ? (
          <Esqueleto forma="bloque" />
        ) : (
          <Selector
            id="he-aut-colaborador"
            etiqueta="Colaborador"
            requerido
            value={datos.colaborador}
            onChange={cambiar("colaborador")}
            opciones={opciones}
            textoVacio="Seleccione…"
            error={errores.colaborador}
            disabled={guardando}
            data-autofocus
          />
        )}
        <div className="he-formulario__fila">
          <CampoTexto
            id="he-aut-fecha"
            type="date"
            etiqueta="Día"
            requerido
            min={hoy}
            value={datos.fecha}
            onChange={cambiar("fecha")}
            error={errores.fecha}
            disabled={guardando}
          />
          <CampoTexto
            id="he-aut-minutos"
            type="number"
            inputMode="numeric"
            etiqueta="Minutos autorizados"
            requerido
            min={1}
            max={MAX_MINUTOS}
            step={15}
            value={datos.minutos}
            onChange={cambiar("minutos")}
            error={errores.minutos}
            ayuda={
              Number.isInteger(minutos) && minutos > 0 ? `${formatearMinutos(minutos)} después del turno.` : undefined
            }
            disabled={guardando}
          />
        </div>
        <CampoAreaTexto
          id="he-aut-motivo"
          etiqueta="Motivo"
          requerido
          filas={3}
          maxLength={MAX_MOTIVO}
          value={datos.motivo}
          onChange={cambiar("motivo")}
          error={errores.motivo}
          ayuda={`Por ejemplo: inventario, recepción de mercadería. ${datos.motivo.length} de ${MAX_MOTIVO} caracteres.`}
          disabled={guardando}
        />
      </form>
    </Modal>
  );
}
