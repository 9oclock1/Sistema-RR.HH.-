import { useParams } from "react-router";
import BandejaHistorialQuejasPage from "./BandejaHistorialQuejasPage";
import DetalleHistorialQuejaPage from "./DetalleHistorialQuejaPage";

export default function HistorialQuejasPage() {
  const { idQueja } = useParams();
  return idQueja ? <DetalleHistorialQuejaPage key={idQueja} idQueja={idQueja} /> : <BandejaHistorialQuejasPage />;
}
