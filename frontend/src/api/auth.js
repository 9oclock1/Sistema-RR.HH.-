import { solicitar } from "./cliente";

// La sesión viaja en la cookie HttpOnly rrhh_sesion que deja AuthService; el navegador la envía sola.
export const iniciarSesion = (correo, contrasena) =>
  solicitar("/auth/login", { metodo: "POST", cuerpo: { correo, contrasena } });

export const cerrarSesion = () => solicitar("/auth/logout", { metodo: "POST" });

export const obtenerSesion = () => solicitar("/auth/sesion");
