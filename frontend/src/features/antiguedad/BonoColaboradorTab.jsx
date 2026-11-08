import { useEffect, useState } from "react";
import { Calculator } from "lucide-react";
import { calcularBono } from "../../api/antiguedad";
import { getEmpleados } from "../../api/empleadosApi";
import { Alerta, Boton, CampoTexto, EstadoVacio, Selector, Tarjeta } from "../../components/ui";
import { formatearMonto, formatearPorcentaje, hoyLaPaz } from "./formato";

export default function BonoColaboradorTab() {
  const [empleados, setEmpleados] = useState([]);
  const [cargandoEmpleados, setCargandoEmpleados] = useState(true);
  const [idEmpleado, setIdEmpleado] = useState("");
  const [periodo, setPeriodo] = useState(hoyLaPaz().slice(0, 7));
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [omitido, setOmitido] = useState(null);
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    getEmpleados()
      .then(setEmpleados)
      .catch((err) => setError(err.message))
      .finally(() => setCargandoEmpleados(false));
  }, []);

  const empleado = empleados.find((e) => e.id_empleado === idEmpleado);

  const calcular = async (evento) => {
    evento.preventDefault();
    setCalculando(true);
    setError(null);
    setOmitido(null);
    setResultado(null);
    try {
      setResultado(await calcularBono(idEmpleado, `${periodo}-01`));
    } catch (err) {
      // Antigüedad por debajo del primer tramo (menos de 2 años): no es una falla del cálculo, es un
      // estado de negocio esperado, así que se muestra aparte de los errores reales.
      if (err.codigo === "ANTIGUEDAD_INSUFICIENTE") setOmitido(err.message);
      else setError(err.message);
    } finally {
      setCalculando(false);
    }
  };

  return (
    <div className="antiguedad-bono">
      <Tarjeta className="antiguedad-bono__tarjeta">
        <form className="antiguedad-bono__formulario" onSubmit={calcular}>
          <Selector
            id="bono-colaborador"
            etiqueta="Colaborador"
            requerido
            textoVacio={cargandoEmpleados ? "Cargando…" : "Seleccione…"}
            value={idEmpleado}
            onChange={(e) => setIdEmpleado(e.target.value)}
            disabled={cargandoEmpleados}
            opciones={empleados.map((e) => ({
              valor: e.id_empleado,
              etiqueta: `${e.nombre_completo} — ${e.numero_documento}`,
            }))}
          />
          <CampoTexto
            id="bono-periodo"
            etiqueta="Periodo"
            type="month"
            requerido
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
          />
          <Boton variante="primario" icono={Calculator} type="submit" cargando={calculando} disabled={!idEmpleado}>
            {calculando ? "Calculando…" : "Calcular bono"}
          </Boton>
        </form>
      </Tarjeta>

      {error && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo calcular el bono">
          {error}
        </Alerta>
      )}

      {omitido && (
        <Alerta tono="aviso" role="status" titulo="Omitido por error">
          {omitido}
        </Alerta>
      )}

      {resultado && (
        <Tarjeta className="antiguedad-bono__resultado">
          <dl className="antiguedad-bono__resumen">
            <div>
              <dt>Colaborador</dt>
              <dd>{empleado?.nombre_completo ?? "—"}</dd>
            </div>
            <div>
              <dt>Años de servicio</dt>
              <dd>{resultado.anios_servicio}</dd>
            </div>
            <div>
              <dt>Porcentaje aplicado</dt>
              <dd>{formatearPorcentaje(resultado.porcentaje)}</dd>
            </div>
            <div>
              <dt>Haber básico</dt>
              <dd>{formatearMonto(resultado.haber_basico)}</dd>
            </div>
            <div>
              <dt>Bono de antigüedad</dt>
              <dd className="antiguedad-bono__monto">{formatearMonto(resultado.monto)}</dd>
            </div>
          </dl>
        </Tarjeta>
      )}

      {!resultado && !error && !omitido && !calculando && (
        <EstadoVacio
          icono={Calculator}
          titulo="Seleccione un colaborador y un periodo"
          mensaje="El bono se calcula según los años de servicio a esa fecha y la escala legal vigente en ese mes."
        />
      )}
    </div>
  );
}
