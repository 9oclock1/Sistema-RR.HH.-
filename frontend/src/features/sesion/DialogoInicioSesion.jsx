import { useId, useRef, useState } from "react";
import { LogIn } from "lucide-react";
import { iniciarSesion } from "../../api/auth";
import { Alerta, Boton, CampoTexto, Modal, useAvisos } from "../../components/ui";
import { fijarSesion } from "../../context/sesion";
import "./sesion.css";

const VACIO = { correo: "", contrasena: "" };

function validar({ correo, contrasena }) {
  const errores = {};
  if (!correo.trim()) errores.correo = "Ingrese su correo.";
  if (!contrasena) errores.contrasena = "Ingrese su contraseña.";
  return errores;
}

// Inicio de sesión real con la cuenta de AuthService. Lo que exige sesión (Mis boletas de pago) usa esta cuenta.
export default function DialogoInicioSesion({ abierto, onCerrar }) {
  const idFormulario = useId();
  const avisar = useAvisos();
  const refResumen = useRef(null);
  const [datos, setDatos] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [rechazo, setRechazo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cerrar = () => {
    setDatos(VACIO);
    setErrores({});
    setRechazo(null);
    onCerrar();
  };

  const cambiar = (campo) => (evento) => {
    setDatos((previos) => ({ ...previos, [campo]: evento.target.value }));
    if (errores[campo]) setErrores((previos) => ({ ...previos, [campo]: undefined }));
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    const encontrados = validar(datos);
    setErrores(encontrados);
    setRechazo(null);
    if (Object.keys(encontrados).length > 0) {
      requestAnimationFrame(() => refResumen.current?.focus());
      return;
    }
    setEnviando(true);
    try {
      const { usuario } = await iniciarSesion(datos.correo.trim(), datos.contrasena);
      fijarSesion(usuario);
      avisar({ tono: "exito", titulo: "Sesión iniciada", mensaje: usuario.correo });
      cerrar();
    } catch (error) {
      setDatos((previos) => ({ ...previos, contrasena: "" }));
      setRechazo(error.message);
      requestAnimationFrame(() => refResumen.current?.focus());
    } finally {
      setEnviando(false);
    }
  };

  const cantidad = Object.values(errores).filter(Boolean).length;

  return (
    <Modal
      abierto={abierto}
      titulo="Iniciar sesión"
      tamano="sm"
      onCerrar={cerrar}
      bloqueado={enviando}
      pie={
        <>
          <Boton variante="sutil" onClick={cerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form={idFormulario} icono={LogIn} cargando={enviando}>
            Iniciar sesión
          </Boton>
        </>
      }
    >
      <form id={idFormulario} className="sesion-formulario" onSubmit={enviar} noValidate>
        {(rechazo || cantidad > 0) && (
          <Alerta tono="peligro" role="alert" ref={refResumen} tabIndex={-1} titulo="No se pudo iniciar sesión">
            {rechazo ?? (cantidad === 1 ? "Revise el campo marcado." : "Revise los campos marcados.")}
          </Alerta>
        )}
        <CampoTexto
          etiqueta="Correo"
          type="email"
          autoComplete="username"
          requerido
          value={datos.correo}
          onChange={cambiar("correo")}
          error={errores.correo}
          data-autofocus
        />
        <CampoTexto
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          requerido
          value={datos.contrasena}
          onChange={cambiar("contrasena")}
          error={errores.contrasena}
        />
      </form>
    </Modal>
  );
}
