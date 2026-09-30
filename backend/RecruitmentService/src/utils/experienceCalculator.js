function calcularAniosExperiencia(experiencias = []) {
  if (!Array.isArray(experiencias) || experiencias.length === 0) {
    return 0;
  }

  const intervalos = [];

  for (const exp of experiencias) {
    let inicio = parseInt(exp.anioInicio, 10);
    let fin = parseInt(exp.anioFin, 10);

    if (exp.esActual && isNaN(fin)) {
      fin = new Date().getFullYear();
    }

    if (isNaN(inicio) && isNaN(fin)) continue;
    if (isNaN(inicio) && !isNaN(fin)) inicio = fin;
    if (isNaN(fin) && !isNaN(inicio)) fin = inicio;

    if (fin >= inicio) {
      intervalos.push([inicio, fin]);
    }
  }

  if (intervalos.length === 0) return 0;

  intervalos.sort((a, b) => a[0] - b[0]);

  const fusionados = [intervalos[0]];

  for (let i = 1; i < intervalos.length; i++) {
    const anterior = fusionados[fusionados.length - 1];
    const actual = intervalos[i];

    if (actual[0] <= anterior[1]) {
      anterior[1] = Math.max(anterior[1], actual[1]);
    } else {
      fusionados.push(actual);
    }
  }

  const total = fusionados.reduce((acc, [ini, fin]) => {
    const duracion = fin - ini === 0 ? 1 : fin - ini;
    return acc + duracion;
  }, 0);

  return total;
}

module.exports = { calcularAniosExperiencia };
