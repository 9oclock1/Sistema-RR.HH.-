import { solicitar } from "./cliente";

const INTERVALO_MS = 3000;

// Cada servicio guarda en memoria lo que publicó en Pub/Sub; el cursor es la última secuencia ya mostrada.
const SERVICIOS = [
  { nombre: "RecruitmentService", ruta: "/recr/mensajes-publicados" },
  { nombre: "AttendanceService", ruta: "/att/mensajes-publicados" },
  { nombre: "EmployeeService", ruta: "/empl/mensajes-publicados" },
  { nombre: "PerformanceService", ruta: "/perf/mensajes-publicados" },
  { nombre: "CompensationService", ruta: "/comp/mensajes-publicados" },
];

const cursores = new Map();
let iniciado = false;

function mostrar(publicado) {
  const atributos = publicado.atributos ?? {};
  const origen = atributos.origen ?? "?";
  const destino = atributos.destino ?? "?";
  const tipo = atributos.tipo ?? "mensaje";

  if (publicado.direccion === "recibido") {
    const origenModulo = atributos.origen_modulo || "sistema externo";
    console.log(`Mensaje recibido exitosamente del sistema de ${origenModulo} (grupo ${origen})`);
    console.groupCollapsed(`[Pub/Sub] Respuesta recibida · ${origen} → ${destino} · ${tipo}`);
    console.log("Recibido en:", publicado.publicado_en);
    console.log("ID Pub/Sub:", publicado.id_pubsub);
    console.log("Atributos:", atributos);
    console.log("Mensaje:", publicado.mensaje);
    console.groupEnd();
    return;
  }

  const destinoModulo = atributos.destino_modulo || "destino";
  console.groupCollapsed(
    `[Pub/Sub] Envío ${origen} → ${destino} (${destinoModulo}) · ${publicado.servicio} → ${publicado.topico} · ${tipo}`
  );
  console.log("Publicado en:", publicado.publicado_en);
  console.log("ID Pub/Sub:", publicado.id_pubsub);
  console.log("Atributos:", atributos);
  console.log("Mensaje:", publicado.mensaje);
  console.groupEnd();
}

async function consultar({ nombre, ruta }) {
  const desde = cursores.get(nombre) ?? 0;
  const { ultimo, mensajes } = await solicitar(`${ruta}?desde=${desde}`);
  // Si el servicio se reinició, su contador volvió a cero: se parte de nuevo.
  if (ultimo < desde) {
    cursores.set(nombre, 0);
    return;
  }
  mensajes.forEach(mostrar);
  cursores.set(nombre, ultimo);
}

async function consultarTodos() {
  if (document.hidden) return;
  // Un servicio caído o sin la ruta no debe impedir ver los mensajes de los demás.
  await Promise.allSettled(SERVICIOS.map(consultar));
}

// Idempotente: se llama desde el layout y solo arranca una vez por pestaña.
export function iniciarConsolaPubSub() {
  if (iniciado) return;
  iniciado = true;
  consultarTodos();
  setInterval(consultarTodos, INTERVALO_MS);
}
