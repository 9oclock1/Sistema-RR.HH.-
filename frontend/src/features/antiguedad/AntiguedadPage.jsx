import { useState } from "react";
import { Link } from "react-router";
import { EncabezadoPagina, Pestanas } from "../../components/ui";
import BonoColaboradorTab from "./BonoColaboradorTab";
import EscalasTab from "./EscalasTab";
import "./antiguedad.css";

const PESTANAS = [
  { id: "bono", etiqueta: "Bono por colaborador", contenido: <BonoColaboradorTab /> },
  { id: "escalas", etiqueta: "Escalas de antigüedad", contenido: <EscalasTab /> },
];

export default function AntiguedadPage() {
  const [pestana, setPestana] = useState("bono");

  return (
    <section className="antiguedad" aria-labelledby="antiguedad-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Planillas" }]}
        enlace={Link}
        titulo="Bono de antigüedad"
        idTitulo="antiguedad-titulo"
        descripcion="Cálculo automático del bono según los años de servicio y la escala legal vigente."
      />

      <Pestanas etiqueta="Bono de antigüedad" pestanas={PESTANAS} activa={pestana} onCambiar={setPestana} />
    </section>
  );
}
