import { useState } from "react";
import { UserSearch } from "lucide-react";
import { consultarSaldoDeEmpleado } from "../../api/vacaciones";
import { EstadoVacio, Selector, Tarjeta } from "../../components/ui";
import { useEmpleados } from "../Asignaciones/hooks/useEmpleados";
import HistorialVacaciones from "./HistorialVacaciones";
import SaldoVacaciones from "./SaldoVacaciones";
import { useSaldoVacaciones } from "./useSaldoVacaciones";

// Criterio 4: RRHH revisa el expediente de cualquier empleado.
export default function ConsultaRRHH() {
  const [idEmpleado, setIdEmpleado] = useState("");
  const empleados = useEmpleados();
  const { saldo, error, cargando, recargar } = useSaldoVacaciones(idEmpleado, consultarSaldoDeEmpleado);

  return (
    <div className="vacaciones-columna">
      <Selector
        className="vacaciones-selector"
        etiqueta="Empleado"
        value={idEmpleado}
        onChange={(evento) => setIdEmpleado(evento.target.value)}
        disabled={empleados.cargando || Boolean(empleados.error)}
        error={empleados.error ? "No se pudieron cargar los empleados." : undefined}
        textoVacio={empleados.cargando ? "Cargando…" : "Seleccione un empleado"}
        opciones={empleados.empleados.map((e) => ({
          valor: e.id_empleado,
          etiqueta: `${e.nombre_completo} · CI ${e.numero_documento}`,
        }))}
      />

      {!idEmpleado && (
        <Tarjeta>
          <EstadoVacio
            icono={UserSearch}
            titulo="Ningún empleado seleccionado"
            mensaje="Elija un empleado para ver su saldo y el historial de sus períodos vacacionales."
          />
        </Tarjeta>
      )}

      {idEmpleado && (
        <>
          <SaldoVacaciones saldo={saldo} cargando={cargando} error={error} onReintentar={recargar} titulo="Saldo del empleado" />
          {!error && <HistorialVacaciones saldo={saldo} cargando={cargando} />}
        </>
      )}
    </div>
  );
}
