import { useParams } from "react-router";
import BandejaCasosQuejaPage from "./BandejaCasosQuejaPage";
import DetalleCasoQuejaPage from "./DetalleCasoQuejaPage";

export default function MisCasosQuejaPage() {
  const { idQueja } = useParams();
  return idQueja ? (
    <DetalleCasoQuejaPage key={idQueja} idQueja={idQueja} alcance="responsable" />
  ) : (
    <BandejaCasosQuejaPage alcance="responsable" />
  );
}
