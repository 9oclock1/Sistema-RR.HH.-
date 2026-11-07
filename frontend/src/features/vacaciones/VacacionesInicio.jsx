import { useState } from "react";
import { Link } from "react-router";
import { consultarMiSaldo } from "../../api/vacaciones";
import { leerEmpleado } from "../marcaje/sesionEmpleado";
import SaldoVacaciones from "./SaldoVacaciones";
import { useSaldoVacaciones } from "./useSaldoVacaciones";

// Widget del inicio: solo aparece si ya hay un empleado identificado y se pudo leer su saldo.
export default function VacacionesInicio() {
  const [idEmpleado] = useState(leerEmpleado);
  const { saldo, error, cargando } = useSaldoVacaciones(idEmpleado, consultarMiSaldo);

  if (!idEmpleado || error) return null;

  return (
    <section className="vacaciones-inicio" aria-label="Mis vacaciones">
      <SaldoVacaciones saldo={saldo} cargando={cargando} titulo="Mis vacaciones" compacto />
      <Link to="/asistencia/vacaciones">Ver detalle e historial</Link>
    </section>
  );
}
