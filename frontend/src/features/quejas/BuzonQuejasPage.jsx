import { useEffect, useState } from "react";
import { Link } from "react-router";
import { FileSearch } from "lucide-react";
import { listarCategoriasQueja } from "../../api/quejas";
import { Alerta, Boton, EncabezadoPagina, Esqueleto, Tarjeta } from "../../components/ui";
import { useUsuario } from "../../context/sesion";
import ConfirmacionQueja from "./ConfirmacionQueja";
import FormularioQueja from "./FormularioQueja";
import { RUTA_CONSULTAR_QUEJA } from "./reglas";
import "./quejas.css";

export default function BuzonQuejasPage() {
  const idEmpleado = useUsuario();
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [registrada, setRegistrada] = useState(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    listarCategoriasQueja()
      .then((lista) => vigente && setCategorias(lista))
      .catch((error) => vigente && setErrorCarga(error.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [recarga]);

  const reintentar = () => {
    setErrorCarga(null);
    setCargando(true);
    setRecarga((n) => n + 1);
  };

  return (
    <div className="qj-pagina">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Desempeño" }]}
        enlace={Link}
        titulo="Buzón de quejas"
        descripcion="Reporte problemas de clima laboral, acoso o condiciones de trabajo. Puede hacerlo con su nombre o de forma anónima."
        acciones={
          <Boton as={Link} to={RUTA_CONSULTAR_QUEJA} icono={FileSearch}>
            Consultar mi queja
          </Boton>
        }
      />

      <div className="qj-columna">
        {registrada ? (
          <ConfirmacionQueja queja={registrada} onNueva={() => setRegistrada(null)} />
        ) : errorCarga ? (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudo cargar el formulario"
            acciones={<Boton onClick={reintentar}>Reintentar</Boton>}
          >
            <p>{errorCarga}</p>
          </Alerta>
        ) : (
          <Tarjeta className="qj-tarjeta">
            {cargando ? (
              <div className="qj-cargando" aria-busy="true" aria-label="Cargando formulario">
                <Esqueleto forma="bloque" alto="var(--size-touch)" />
                <Esqueleto forma="bloque" alto="var(--size-control)" />
                <Esqueleto forma="bloque" alto="var(--size-control)" />
                <Esqueleto forma="bloque" alto="120px" />
              </div>
            ) : (
              <FormularioQueja categorias={categorias} idEmpleado={idEmpleado} onRegistrada={setRegistrada} />
            )}
          </Tarjeta>
        )}
      </div>
    </div>
  );
}
