import { useParams } from "react-router";
import AsistenteCiclo from "./AsistenteCiclo";
import DetalleCicloPage from "./DetalleCicloPage";
import ListaCiclosPage from "./ListaCiclosPage";
import { ID_NUEVO_CICLO } from "./ciclo";

export default function CiclosEvaluacionPage() {
  const { idCiclo } = useParams();
  if (idCiclo === ID_NUEVO_CICLO) return <AsistenteCiclo />;
  return idCiclo ? <DetalleCicloPage key={idCiclo} idCiclo={idCiclo} /> : <ListaCiclosPage />;
}
