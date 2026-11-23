const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const PREFIJO_ID = "f0000000-0000-4000-8000-";
const BASE_ID = 400;
const OFFSET_BOLIVIA_HORAS = 4;
const DIA_MS = 24 * 60 * 60 * 1000;

const AREA = { ATENCION: "f0000000-0000-4000-8000-000000000001", RRHH: "f0000000-0000-4000-8000-000000000002" };
const SUCURSAL = { SOPOCACHI: "f0000000-0000-4000-8000-000000000011", MIRAFLORES: "f0000000-0000-4000-8000-000000000012" };
const DENUNCIANTES = [31, 32, 33, 34, 35, 36].map((n) => `f0000000-0000-4000-8000-0000000000${n}`);
const RESPONSABLES = [21, 22].map((n) => `f0000000-0000-4000-8000-0000000000${n}`);
const ASIGNADOR = "f0000000-0000-4000-8000-000000000023";

const ESTADO = { REGISTRADA: 1, ASIGNADA: 2, EN_ANALISIS: 3, EN_ACCION: 4, RESUELTA: 5, DESESTIMADA: 6 };
const CATEGORIA = { CLIMA: 1, ACOSO: 2, CONDICIONES: 3, OTRO: 4 };

const MESES = [
  { atras: 5, cantidad: 10, tasaResueltas: 0.9, diasMedios: 6 },
  { atras: 4, cantidad: 11, tasaResueltas: 0.82, diasMedios: 8 },
  { atras: 3, cantidad: 10, tasaResueltas: 0.8, diasMedios: 7 },
  { atras: 2, cantidad: 12, tasaResueltas: 0.75, diasMedios: 12 },
  { atras: 1, cantidad: 11, tasaResueltas: 0.6, diasMedios: 11 },
  { atras: 0, cantidad: 8, tasaResueltas: 0.5, diasMedios: 4 },
];

const TEXTOS = {
  [CATEGORIA.CLIMA]: [
    ["Mal trato en el turno de la tarde", "Un supervisor levanta la voz al equipo y desautoriza a los cajeros frente a los clientes."],
    ["Falta de comunicación entre áreas", "Los cambios de turno se avisan con menos de un día de anticipación y no hay respuesta a los reclamos."],
    ["Favoritismo en la asignación de tareas", "Las tareas más pesadas se reparten siempre entre las mismas personas del equipo."],
  ],
  [CATEGORIA.ACOSO]: [
    ["Comentarios inapropiados de un compañero", "Un compañero hace comentarios incómodos de manera reiterada durante el cierre de caja."],
    ["Presión indebida de un superior", "Se presiona a una persona del equipo para aceptar horas adicionales bajo amenaza de sanción."],
  ],
  [CATEGORIA.CONDICIONES]: [
    ["Equipos de frío en mal estado", "El área de descanso no tiene ventilación y los casilleros no cierran."],
    ["Falta de insumos de seguridad", "No se reponen guantes ni calzado antideslizante en la sección de perecederos."],
    ["Horario de descanso insuficiente", "El descanso del medio día se reduce a veinte minutos en días de alta afluencia."],
  ],
  [CATEGORIA.OTRO]: [["Consulta sobre el proceso de ascensos", "No está claro cómo se publican las convocatorias internas ni los requisitos para postular."]],
};

const RESOLUCIONES = [
  "Se conversó con las partes y se acordó un plan de mejora con seguimiento mensual.",
  "Se corrigió la situación y se capacitó al equipo sobre las normas de convivencia.",
  "Se repuso el material faltante y se programó una revisión trimestral.",
  "Se reorganizaron los turnos y se comunicó el nuevo calendario al personal.",
];

function generador(semilla) {
  let estado = semilla >>> 0;
  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 4294967296;
  };
}

const elegir = (azar, opciones) => {
  const sorteo = azar();
  let acumulado = 0;
  for (const [valor, peso] of opciones) {
    acumulado += peso;
    if (sorteo < acumulado) return valor;
  }
  return opciones[opciones.length - 1][0];
};

function inicioDeMes(ahora, mesesAtras) {
  const local = new Date(ahora.getTime() - OFFSET_BOLIVIA_HORAS * 3600 * 1000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - mesesAtras, 1, OFFSET_BOLIVIA_HORAS));
}

const sumarDias = (fecha, dias) => new Date(fecha.getTime() + dias * DIA_MS);

function pasosDeEstado(estadoFinal, creada, resuelta, ahora) {
  const duracion = resuelta ? resuelta.getTime() - creada.getTime() : 0;
  const en = (fraccion) => new Date(creada.getTime() + duracion * fraccion);
  if (estadoFinal === ESTADO.RESUELTA) {
    return [
      [ESTADO.REGISTRADA, creada],
      [ESTADO.ASIGNADA, en(0.1)],
      [ESTADO.EN_ANALISIS, en(0.35)],
      [ESTADO.EN_ACCION, en(0.65)],
      [ESTADO.RESUELTA, resuelta],
    ];
  }
  if (estadoFinal === ESTADO.DESESTIMADA) {
    return [
      [ESTADO.REGISTRADA, creada],
      [ESTADO.ASIGNADA, en(0.3)],
      [ESTADO.DESESTIMADA, resuelta],
    ];
  }
  const camino = [ESTADO.REGISTRADA, ESTADO.ASIGNADA, ESTADO.EN_ANALISIS, ESTADO.EN_ACCION].slice(0, estadoFinal);
  return camino.map((paso, indice) => [paso, new Date(Math.min(sumarDias(creada, indice).getTime(), ahora.getTime()))]);
}

function datosQuejasEjemplo(ahora = new Date()) {
  const azar = generador(94092);
  const quejas = [];
  let numero = 0;

  for (const mes of MESES) {
    const inicio = inicioDeMes(ahora, mes.atras);
    const diasDelMes = Math.round((inicioDeMes(ahora, mes.atras - 1).getTime() - inicio.getTime()) / DIA_MS);
    const diasDisponibles = mes.atras === 0 ? Math.max(1, Math.floor((ahora.getTime() - inicio.getTime()) / DIA_MS) - 1) : Math.min(diasDelMes, 28);
    const resueltas = Math.round(mes.cantidad * mes.tasaResueltas);

    for (let i = 0; i < mes.cantidad; i += 1) {
      const categoria = elegir(azar, [
        [CATEGORIA.CLIMA, 0.35],
        [CATEGORIA.CONDICIONES, 0.3],
        [CATEGORIA.ACOSO, 0.2],
        [CATEGORIA.OTRO, 0.15],
      ]);
      const sucursal = elegir(azar, [
        [SUCURSAL.MIRAFLORES, 0.5],
        [SUCURSAL.SOPOCACHI, 0.38],
        [null, 0.12],
      ]);
      const area = elegir(azar, [
        [AREA.ATENCION, 0.6],
        [AREA.RRHH, 0.25],
        [null, 0.15],
      ]);
      const esAnonima = azar() < 0.3;
      const creada = new Date(inicio.getTime() + (Math.floor(azar() * diasDisponibles) + 8 / 24) * DIA_MS);
      const desestimada = i === mes.cantidad - 1 && mes.atras % 2 === 1;
      const resuelve = i < resueltas;
      const dias = Math.max(1, Math.round(mes.diasMedios + (azar() - 0.5) * mes.diasMedios));

      let estadoFinal = ESTADO.REGISTRADA + 1 + (i % 3);
      let cierre = null;
      if (resuelve || desestimada) {
        cierre = sumarDias(creada, dias);
        if (cierre.getTime() > ahora.getTime()) cierre = new Date(Math.max(creada.getTime() + 3600 * 1000, ahora.getTime() - 3600 * 1000));
        estadoFinal = desestimada ? ESTADO.DESESTIMADA : ESTADO.RESUELTA;
      }
      if (!resuelve && !desestimada && i % 4 === 0) estadoFinal = ESTADO.REGISTRADA;

      const [asunto, descripcion] = TEXTOS[categoria][Math.floor(azar() * TEXTOS[categoria].length)];
      const pasos = pasosDeEstado(estadoFinal, creada, cierre, ahora);
      quejas.push({
        id: `${PREFIJO_ID}${String(BASE_ID + numero).padStart(12, "0")}`,
        codigo: codigoDeEjemplo(numero),
        idCategoria: categoria,
        idSucursal: sucursal,
        idDepartamento: area,
        esAnonima,
        idDenunciante: esAnonima ? null : DENUNCIANTES[numero % DENUNCIANTES.length],
        asunto,
        descripcion,
        resolucion: estadoFinal === ESTADO.RESUELTA ? RESOLUCIONES[numero % RESOLUCIONES.length] : null,
        idPrioridad: estadoFinal === ESTADO.REGISTRADA ? null : 1 + (numero % 4),
        idEstado: estadoFinal,
        creadaEn: creada,
        actualizadaEn: pasos[pasos.length - 1][1],
        pasos,
        responsable: estadoFinal === ESTADO.REGISTRADA ? null : RESPONSABLES[numero % RESPONSABLES.length],
      });
      numero += 1;
    }
  }
  return quejas;
}

const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function codigoDeEjemplo(numero) {
  const letras = (valor) =>
    Array.from({ length: 4 }, (_, posicion) => ALFABETO[Math.floor(valor / ALFABETO.length ** (3 - posicion)) % ALFABETO.length]).join("");
  return `QJ-${letras(1000 + numero)}-${letras(7700 + numero * 13)}`;
}

async function sembrar({ reiniciar = false } = {}) {
  const pool = require("../src/config/db");
  const { cifrarTexto } = require("../src/utils/cifrado");
  const quejas = datosQuejasEjemplo();
  const cliente = await pool.connect();
  let nuevas = 0;
  try {
    await cliente.query("BEGIN");
    if (reiniciar) {
      const ids = quejas.map((queja) => queja.id);
      await cliente.query("DELETE FROM historiales_estado_queja WHERE id_queja = ANY($1)", [ids]);
      await cliente.query("DELETE FROM asignaciones_queja WHERE id_queja = ANY($1)", [ids]);
      await cliente.query("DELETE FROM quejas WHERE id_queja = ANY($1)", [ids]);
    }
    for (const queja of quejas) {
      const { rowCount } = await cliente.query(
        `INSERT INTO quejas (id_queja, id_empleado_denunciante, id_categoria_queja, id_prioridad_queja, id_estado_queja,
                             id_departamento, id_sucursal, es_anonima, codigo_seguimiento, asunto, descripcion, resolucion,
                             creado_en, actualizado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT DO NOTHING`,
        [
          queja.id,
          queja.idDenunciante,
          queja.idCategoria,
          queja.idPrioridad,
          queja.idEstado,
          queja.idDepartamento,
          queja.idSucursal,
          queja.esAnonima,
          queja.codigo,
          cifrarTexto(queja.asunto),
          cifrarTexto(queja.descripcion),
          queja.resolucion ? cifrarTexto(queja.resolucion) : null,
          queja.creadaEn,
          queja.actualizadaEn,
        ],
      );
      if (rowCount === 0) continue;
      nuevas += 1;
      let anterior = null;
      for (const [idEstado, fecha] of queja.pasos) {
        await cliente.query(
          `INSERT INTO historiales_estado_queja (id_queja, id_estado_anterior, id_estado_queja, id_empleado_responsable, fecha_cambio)
           VALUES ($1, $2, $3, $4, $5)`,
          [queja.id, anterior, idEstado, idEstado === ESTADO.REGISTRADA ? null : queja.responsable, fecha],
        );
        anterior = idEstado;
      }
      if (queja.responsable) {
        await cliente.query(
          `INSERT INTO asignaciones_queja (id_queja, id_empleado_responsable, id_empleado_asignador, asignada_en)
           VALUES ($1, $2, $3, $4)`,
          [queja.id, queja.responsable, ASIGNADOR, queja.pasos[1][1]],
        );
      }
    }
    await cliente.query("COMMIT");
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
    await pool.end();
  }
  return { total: quejas.length, nuevas };
}

if (require.main === module) {
  sembrar({ reiniciar: process.argv.includes("--reiniciar") })
    .then(({ total, nuevas }) => {
      console.log(`Quejas de ejemplo: ${nuevas} nuevas de ${total}${nuevas === 0 ? " (ya estaban cargadas; use --reiniciar para renovar las fechas)" : ""}.`);
    })
    .catch((error) => {
      console.error(`No se pudieron cargar las quejas de ejemplo: ${error.message}`);
      console.error("Cargue primero db/seed.sql y revise QUEJAS_CLAVE_CIFRADO en el .env.");
      process.exit(1);
    });
}

module.exports = { datosQuejasEjemplo, ESTADO, CATEGORIA, AREA, SUCURSAL };
