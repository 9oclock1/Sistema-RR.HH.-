import { useParams } from "react-router";
import EditorPlantillaPage from "./EditorPlantillaPage";
import PlantillasPage from "./PlantillasPage";

// Con identificador en la ruta abre el editor de esa plantilla; sin él, el listado.
export default function PlantillasEvaluacionPage() {
  const { idPlantilla } = useParams();
  return idPlantilla ? <EditorPlantillaPage idPlantilla={idPlantilla} /> : <PlantillasPage />;
}
