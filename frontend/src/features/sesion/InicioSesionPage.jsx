import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { LogIn } from "lucide-react";
import { iniciarSesion, obtenerSesion } from "../../api/auth";
import { Alerta, Boton, CampoTexto, useAvisos } from "../../components/ui";
import { fijarSesion } from "../../context/sesion";
import "./sesion.css";

const VACIO = { correo: "", contrasena: "" };

function validar({ correo, contrasena }) {
  const errores = {};
  if (!correo.trim()) errores.correo = "Ingrese su correo.";
  if (!contrasena) errores.contrasena = "Ingrese su contraseña.";
  return errores;
}

// Al ingresar se va siempre al inicio del portal, con el menú de módulos del rol de la cuenta.
const DESTINO = "/";

// Inicio de sesión con la cuenta de AuthService, en una pantalla propia: es la única entrada al portal.
export default function InicioSesionPage() {
  const navegar = useNavigate();
  const avisar = useAvisos();
  const refResumen = useRef(null);
  const refCorreo = useRef(null);
  const [datos, setDatos] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [rechazo, setRechazo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    document.title = "Iniciar sesión · Sistema RR.HH.";
    refCorreo.current?.focus();
    // Con una sesión ya abierta no hay nada que hacer aquí.
    let vigente = true;
    obtenerSesion()
      .then(({ usuario }) => {
        if (vigente && usuario) {
          fijarSesion(usuario);
          navegar(DESTINO, { replace: true });
        }
      })
      .catch(() => {});
    return () => {
      vigente = false;
      document.title = "Sistema RR.HH.";
    };
  }, [navegar]);

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
      navegar(DESTINO, { replace: true });
    } catch (error) {
      setDatos((previos) => ({ ...previos, contrasena: "" }));
      setRechazo(error.message);
      setEnviando(false);
      requestAnimationFrame(() => refResumen.current?.focus());
    }
  };

  const cantidad = Object.values(errores).filter(Boolean).length;

  return (
    <main className="sesion-pagina">
      <div className="sesion-contenedor">
        <p className="sesion-marca">Sistema RR.HH.</p>

        <section className="sesion-tarjeta" aria-labelledby="sesion-titulo">
          <h1 id="sesion-titulo" className="sesion-titulo">
            Iniciar sesión
          </h1>
          <p className="sesion-intro">Ingrese con el correo y la contraseña de su cuenta del portal.</p>

          <form className="sesion-formulario" onSubmit={enviar} noValidate>
            {(rechazo || cantidad > 0) && (
              <Alerta tono="peligro" role="alert" ref={refResumen} tabIndex={-1} titulo="No se pudo iniciar sesión">
                {rechazo ?? (cantidad === 1 ? "Revise el campo marcado." : "Revise los campos marcados.")}
              </Alerta>
            )}
            <CampoTexto
              ref={refCorreo}
              etiqueta="Correo"
              type="email"
              autoComplete="username"
              requerido
              value={datos.correo}
              onChange={cambiar("correo")}
              error={errores.correo}
              disabled={enviando}
            />
            <CampoTexto
              etiqueta="Contraseña"
              type="password"
              autoComplete="current-password"
              requerido
              value={datos.contrasena}
              onChange={cambiar("contrasena")}
              error={errores.contrasena}
              disabled={enviando}
            />
            <Boton variante="primario" type="submit" icono={LogIn} cargando={enviando} className="sesion-enviar">
              Iniciar sesión
            </Boton>
          </form>
        </section>
      </div>
    </main>
  );
}
