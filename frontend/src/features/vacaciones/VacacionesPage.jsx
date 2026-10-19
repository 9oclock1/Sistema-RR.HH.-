import { useState } from "react";
import { Link } from "react-router";
import { EncabezadoPagina, Pestanas } from "../../components/ui";
import { useRol } from "../../context/sesion";
import { puedeAcceder } from "../../utils/permisos";
import ConsultaRRHH from "./ConsultaRRHH";
import MiSaldo from "./MiSaldo";

export default function VacacionesPage() {
  const rol = useRol();
  const [pestana, setPestana] = useState("mi-saldo");
  const esRrhh = puedeAcceder(rol, ["admin"]);

  return (
    <section aria-labelledby="vacaciones-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Asistencia" }]}
        enlace={Link}
        titulo="Saldo de vacaciones"
        idTitulo="vacaciones-titulo"
        descripcion="Días ganados según su antigüedad, gozados y disponibles, con el historial de sus períodos."
      />

      {esRrhh ? (
        <Pestanas
          etiqueta="Saldo de vacaciones"
          activa={pestana}
          onCambiar={setPestana}
          pestanas={[
            { id: "mi-saldo", etiqueta: "Mi saldo", contenido: <MiSaldo /> },
            { id: "rrhh", etiqueta: "Consulta de RRHH", contenido: <ConsultaRRHH /> },
          ]}
        />
      ) : (
        <MiSaldo />
      )}
    </section>
  );
}
