export default function FilasCargando({ columnas, filas = 3 }) {
  return Array.from({ length: filas }, (_, i) => (
    <tr key={i} className="ui-table__skeleton" aria-hidden="true">
      {Array.from({ length: columnas }, (_, j) => (
        <td key={j}>
          <span className="ui-skeleton" />
        </td>
      ))}
    </tr>
  ));
}
