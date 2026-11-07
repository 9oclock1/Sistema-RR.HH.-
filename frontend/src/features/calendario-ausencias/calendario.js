// KAN-55 (RF-35): lógica del calendario sin React, para poder probarla y medirla aparte.
// Las fechas son siempre texto AAAA-MM-DD; se calcula en UTC para que ninguna zona horaria corra un día.

export const VISTAS = {
  mes: { id: "mes", etiqueta: "Mes" },
  semana: { id: "semana", etiqueta: "Semana" },
  dia: { id: "dia", etiqueta: "Día" },
};

const DIA_MS = 24 * 60 * 60 * 1000;
const aFecha = (texto) => new Date(`${texto}T00:00:00Z`);
const aTexto = (fecha) => fecha.toISOString().slice(0, 10);

export function sumarDias(texto, dias) {
  return aTexto(new Date(aFecha(texto).getTime() + dias * DIA_MS));
}

// Lunes = 0 … domingo = 6.
export const diaDeSemana = (texto) => (aFecha(texto).getUTCDay() + 6) % 7;
export const inicioDeSemana = (texto) => sumarDias(texto, -diaDeSemana(texto));
export const ultimoDiaDelMes = (texto) => {
  const fecha = aFecha(texto);
  return aTexto(new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0)));
};
export const primerDiaDelMes = (texto) => `${texto.slice(0, 8)}01`;

// Hoy en Bolivia, que es la hora que importa para las ausencias.
export const hoyEnBolivia = (ahora = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(ahora);

// Rango que se pide al servidor para una vista. El mes se pide completo con las semanas que lo cubren (hasta 42 días),
// para que los días de relleno del primer y último renglón también muestren sus ausencias.
export function rangoDeVista(vista, ancla) {
  if (vista === "dia") return { desde: ancla, hasta: ancla };
  if (vista === "semana") {
    const desde = inicioDeSemana(ancla);
    return { desde, hasta: sumarDias(desde, 6) };
  }
  return {
    desde: inicioDeSemana(primerDiaDelMes(ancla)),
    hasta: sumarDias(inicioDeSemana(ultimoDiaDelMes(ancla)), 6),
  };
}

// Anterior (-1) o siguiente (1) periodo de la vista. Al cambiar de mes se conserva el día hasta donde el mes lo permite.
export function moverAncla(vista, ancla, paso) {
  if (vista === "dia") return sumarDias(ancla, paso);
  if (vista === "semana") return sumarDias(ancla, paso * 7);
  const fecha = aFecha(ancla);
  const destino = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + paso, 1));
  const ultimo = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
  destino.setUTCDate(Math.min(fecha.getUTCDate(), ultimo));
  return aTexto(destino);
}

export function diasDelRango(desde, hasta) {
  const dias = [];
  for (let dia = desde; dia <= hasta; dia = sumarDias(dia, 1)) dias.push(dia);
  return dias;
}

const mesAnio = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", month: "long", year: "numeric" });
const diaLargo = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const diaCorto = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", day: "numeric", month: "short" });

const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

export function tituloDeVista(vista, ancla) {
  if (vista === "dia") return capitalizar(diaLargo.format(aFecha(ancla)));
  if (vista === "semana") {
    const { desde, hasta } = rangoDeVista("semana", ancla);
    return `${diaCorto.format(aFecha(desde))} – ${diaCorto.format(aFecha(hasta))} de ${aFecha(hasta).getUTCFullYear()}`;
  }
  return capitalizar(mesAnio.format(aFecha(ancla)));
}

export const nombreDeDia = (texto) => capitalizar(diaLargo.format(aFecha(texto)));
export const numeroDeDia = (texto) => Number(texto.slice(8));

// Color y abreviatura de cada tipo de ausencia (criterio 2). El color nunca va solo: cada bloque lleva el tipo escrito.
export const TIPOS_VISUALES = {
  VACACIONES: { clase: "vacaciones", abreviatura: "Vac." },
  MEDICA: { clase: "medica", abreviatura: "Méd." },
  MATERNIDAD: { clase: "maternidad", abreviatura: "Mat." },
  PATERNIDAD: { clase: "paternidad", abreviatura: "Pat." },
  DUELO: { clase: "duelo", abreviatura: "Duelo" },
  ACADEMICA: { clase: "academica", abreviatura: "Acad." },
  PERSONAL: { clase: "personal", abreviatura: "Pers." },
};
const OTRO_TIPO = { clase: "otro", abreviatura: "Aus." };

export const visualDeTipo = (codigo) => TIPOS_VISUALES[codigo] ?? OTRO_TIPO;

// Ausencias de cada día del rango, indexadas una sola vez: recorrerlas por día sería cuadrático con ausencias masivas.
export function indexarPorDia(ausencias, desde, hasta) {
  const porDia = new Map();
  for (const ausencia of ausencias) {
    const inicio = ausencia.fecha_inicio < desde ? desde : ausencia.fecha_inicio;
    const fin = ausencia.fecha_fin > hasta ? hasta : ausencia.fecha_fin;
    for (let dia = inicio; dia <= fin; dia = sumarDias(dia, 1)) {
      if (!porDia.has(dia)) porDia.set(dia, []);
      porDia.get(dia).push(ausencia);
    }
  }
  const comparar = (a, b) =>
    a.tipo.codigo.localeCompare(b.tipo.codigo) || a.empleado.nombre_completo.localeCompare(b.empleado.nombre_completo, "es");
  for (const lista of porDia.values()) lista.sort(comparar);
  return porDia;
}

export const indexarDias = (dias) => new Map(dias.map((dia) => [dia.fecha, dia]));

// Quitar los tipos que la persona apagó en la leyenda.
export const filtrarTipos = (ausencias, ocultos) => (ocultos.size === 0 ? ausencias : ausencias.filter((a) => !ocultos.has(a.tipo.codigo)));

export function textoDeAlerta(alerta) {
  const motivos = [];
  if (alerta.motivos.includes("PORCENTAJE")) {
    motivos.push(`falta el ${alerta.porcentaje_ausentes} % (tolera ${alerta.max_ausentes_porcentaje} %)`);
  }
  if (alerta.motivos.includes("MINIMO_PRESENTES")) {
    motivos.push(`quedan ${alerta.presentes} presentes (mínimo ${alerta.min_presentes})`);
  }
  return `${alerta.area}: ${alerta.ausentes} de ${alerta.programados} ausentes; ${motivos.join(" y ")}`;
}

export const plural = (cantidad, singular, varios) => `${cantidad} ${cantidad === 1 ? singular : varios}`;
