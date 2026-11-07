import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { consultarMiSaldo } from "../../api/vacaciones";
import { Boton } from "../../components/ui";
import IdentificacionEmpleado from "../marcaje/IdentificacionEmpleado";
import { guardarEmpleado, leerEmpleado, olvidarEmpleado } from "../marcaje/sesionEmpleado";
import HistorialVacaciones from "./HistorialVacaciones";
import SaldoVacaciones from "./SaldoVacaciones";
import { useSaldoVacaciones } from "./useSaldoVacaciones";

// El servidor responde 401 sin identificador y 403 si no corresponde a un empleado: en ambos se vuelve a pedirlo.
const esRechazoDeIdentidad = (error) => error?.estado === 401 || error?.estado === 403;

export default function MiSaldo() {
  const [idEmpleado, setIdEmpleado] = useState(leerEmpleado);
  const [errorIdentificacion, setErrorIdentificacion] = useState(null);
  const [enfocar, setEnfocar] = useState(false);
  const { saldo, error, cargando, recargar } = useSaldoVacaciones(idEmpleado, consultarMiSaldo);

  const rechazado = Boolean(idEmpleado) && esRechazoDeIdentidad(error);

  // El almacenamiento local es un sistema externo: un identificador rechazado se olvida y uno válido se recuerda.
  useEffect(() => {
    if (rechazado) olvidarEmpleado();
    else if (idEmpleado && saldo) guardarEmpleado(idEmpleado);
  }, [idEmpleado, rechazado, saldo]);

  const identificar = (id) => {
    setErrorIdentificacion(null);
    setIdEmpleado(id);
  };

  const cambiarEmpleado = () => {
    olvidarEmpleado();
    setIdEmpleado(null);
    setEnfocar(true);
  };

  if (!idEmpleado || rechazado) {
    return (
      <IdentificacionEmpleado
        error={rechazado ? error.message : errorIdentificacion}
        procesando={false}
        enfocar={enfocar}
        onIdentificar={identificar}
        onEditar={() => setErrorIdentificacion(null)}
      />
    );
  }

  return (
    <div className="vacaciones-columna">
      <div>
        <Boton variante="sutil" icono={ArrowLeftRight} onClick={cambiarEmpleado}>
          Cambiar empleado
        </Boton>
      </div>
      <SaldoVacaciones saldo={saldo} cargando={cargando} error={error} onReintentar={recargar} />
      {!error && <HistorialVacaciones saldo={saldo} cargando={cargando} />}
    </div>
  );
}
