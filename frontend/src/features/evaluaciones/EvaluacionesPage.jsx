import { useParams } from "react-router";
import BandejaEvaluacionesPage from "./BandejaEvaluacionesPage";
import FormularioEvaluacionPage from "./FormularioEvaluacionPage";

export default function EvaluacionesPage() {
  const { idEvaluacion } = useParams();
  return idEvaluacion ? <FormularioEvaluacionPage idEvaluacion={idEvaluacion} /> : <BandejaEvaluacionesPage />;
}
