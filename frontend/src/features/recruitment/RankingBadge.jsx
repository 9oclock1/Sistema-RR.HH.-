import { Award, Medal, Trophy } from "lucide-react";
import "./CandidateRankingTable.css";

export default function RankingBadge({ posicion = 1 }) {
  if (posicion === 1) {
    return (
      <span className="ranking-badge ranking-badge--oro" title="1° Puesto: Mayor afinidad">
        <Trophy className="ranking-badge__icono" aria-hidden="true" />
        <span className="ranking-badge__texto">#1</span>
      </span>
    );
  }

  if (posicion === 2) {
    return (
      <span className="ranking-badge ranking-badge--plata" title="2° Puesto">
        <Medal className="ranking-badge__icono" aria-hidden="true" />
        <span className="ranking-badge__texto">#2</span>
      </span>
    );
  }

  if (posicion === 3) {
    return (
      <span className="ranking-badge ranking-badge--bronce" title="3° Puesto">
        <Award className="ranking-badge__icono" aria-hidden="true" />
        <span className="ranking-badge__texto">#3</span>
      </span>
    );
  }

  return (
    <span className="ranking-badge ranking-badge--estandar" title={`Posición #${posicion}`}>
      <span className="ranking-badge__texto">#{posicion}</span>
    </span>
  );
}