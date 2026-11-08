async function conLimite(elementos, limite, tarea) {
  const resultados = new Array(elementos.length);
  let siguiente = 0;
  const trabajadores = Array.from(
    { length: Math.min(limite, elementos.length) },
    async () => {
      while (siguiente < elementos.length) {
        const posicion = siguiente++;
        resultados[posicion] = await tarea(elementos[posicion]);
      }
    },
  );
  await Promise.all(trabajadores);
  return resultados;
}

module.exports = { conLimite };
