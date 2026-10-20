import { RotateCcw } from "lucide-react";
import { Boton, Etiqueta } from "../../../components/ui";
import { AVISO } from "./reglasEntrevista";

// Estado del último correo enviado al candidato; si falló, el reclutador puede reintentarlo.
export default function EstadoAviso({ entrevista, reintentando, puedeEditar, onReintentar }) {
  const aviso = AVISO[entrevista.estado_ultimo_aviso];
  if (!aviso) return null;
  return (
    <>
      <Etiqueta tono={aviso.tono}>{aviso.texto}</Etiqueta>
      {entrevista.estado_ultimo_aviso === "FALLIDO" && puedeEditar && (
        <Boton
          tamano="sm"
          variante="sutil"
          icono={RotateCcw}
          cargando={reintentando === entrevista.id_ultimo_aviso}
          onClick={() => onReintentar(entrevista)}
        >
          Reintentar correo
        </Boton>
      )}
    </>
  );
}
