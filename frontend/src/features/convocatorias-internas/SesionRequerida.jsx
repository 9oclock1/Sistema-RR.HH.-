import { LogIn } from "lucide-react";
import { Boton, EstadoVacio, Esqueleto, Tarjeta } from "../../components/ui";
import { abrirInicioSesion, useSesion } from "../../context/sesion";

export default function SesionRequerida({ mensaje, children }) {
  const usuario = useSesion();

  if (usuario === undefined) return <Esqueleto forma="bloque" alto="12rem" />;
  if (usuario === null) {
    return (
      <Tarjeta>
        <EstadoVacio
          icono={LogIn}
          titulo="Inicie sesión para continuar"
          mensaje={mensaje}
          accion={
            <Boton variante="primario" icono={LogIn} onClick={() => abrirInicioSesion()}>
              Iniciar sesión
            </Boton>
          }
        />
      </Tarjeta>
    );
  }
  return children(usuario);
}
