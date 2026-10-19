# Aclaracion

## Turnos

- Las horas están en hora de Bolivia (UTC-4).
- Si `hora_fin` < `hora_inicio`, el turno cruza la medianoche; la jornada es la del día de inicio.
- Horas efectivas = duración del turno - `minutos_refrigerio`.
- Un marcaje es puntual si ocurre hasta `hora_inicio` + `minutos_tolerancia` (inclusive).

## Asignaciones de turno

- El campo id_empleado debería hacer referencia a id_empleado de EmployeeDB.
- No se puede eliminar un turno con asignaciones (`ON DELETE RESTRICT`); se lo puede desactivar con `esta_activo`.

## Marcajes

- El campo id_empleado debería hacer referencia a id_empleado de EmployeeDB.
- `fecha_hora_marcaje` la pone el servidor de base de datos, nunca el cliente.
- `fecha_jornada` de una entrada es la del turno programado (de ayer, hoy o mañana) cuya ventana de entrada la contiene: desde 4 horas antes del inicio hasta el fin. Quien llega pasada la medianoche a un turno nocturno marca en la jornada del día en que empezó el turno. Sin turno en la ventana, es la fecha en hora de Bolivia al momento del marcaje. La salida toma la de su entrada.
- Un empleado tiene como máximo un marcaje por tipo (entrada o salida) en cada jornada (`uq_marcaje_empleado_tipo_jornada`).
- El origen indica cómo se tomó la marca: portal o biométrico. `codigo_dispositivo` solo se llena en marcajes biométricos.
- La salida cierra la entrada de la jornada en curso: la de la última entrada si sigue abierta y tiene menos de 16 horas (turnos que cruzan la medianoche) o, si no, la de hoy.
- Sin entrada abierta, una salida marcada hace menos de 8 horas cuenta como ya registrada y no se guarda otra.
- Horas trabajadas = salida - entrada en minutos completos, sin descontar el refrigerio.
- Estado del marcaje (`CATALOGOS_ESTADO_MARCAJE`): `REGISTRADO` o `PENDIENTE_JUSTIFICACION`. Una salida sin entrada en la jornada se guarda como pendiente de justificación, no tiene horas trabajadas y cierra la jornada: no se acepta una entrada posterior.

## Verificación del empleado

- Antes de marcar se consulta `GET /empleados/:id` en EmployeeService (`EMPLOYEE_SERVICE_URL`). Se espera `{ id_empleado, nombres, apellidos, activo }` y 404 si el empleado no existe.
- Solo se permite marcar si `activo` es `true`. Si EmployeeService no responde, el marcaje se rechaza (503) y no se guarda nada.
- EmployeeService ya expone ese endpoint (KAN-39), así que el valor por defecto es `EMPLEADOS_SIMULADOS=false`. Con `true` se usa la lista fija de `src/config/empleadosSimulados.js` (solo para pruebas sin EmployeeService).

## Roles de turnos rotativos

- `ROLES_TURNO.id_sucursal` e `id_departamento` deberían hacer referencia a `SUCURSALES` y `DEPARTAMENTOS` de EmployeeDB (el área operativa).
- Un rol es semanal (lunes a domingo) o mensual (del 1 al último día del mes). Un área de una sucursal no puede tener dos roles con días en común (`ex_rol_sin_solapamiento`, requiere la extensión `btree_gist`).
- `ASIGNACIONES_ROL_TURNO` es el borrador que edita el supervisor: por empleado y día, un turno o un descanso (`id_turno` NULL y `es_descanso` TRUE). Una celda sin fila está vacía.
- Al publicar, el borrador se copia a `TURNOS_PUBLICADOS` con el nombre, el horario, el refrigerio y la tolerancia del turno de ese momento. Es lo que ve el colaborador; los cambios posteriores al borrador no se ven hasta publicar de nuevo (`tiene_cambios_sin_publicar`, `version_publicada`).
- Un empleado tiene un solo turno publicado por día (`uq_turno_publicado_empleado_fecha`), aunque figure en roles de dos áreas.

## Novedades de asistencia

- `NOVEDADES_ASISTENCIA` guarda lo que se detecta al contrastar el turno programado con los marcajes. Tipos (`CATALOGOS_TIPO_NOVEDAD`): `ATRASO`, `INASISTENCIA` (falta injustificada), `SALIDA_ANTICIPADA` y `OMISION_SALIDA`.
- `fecha_jornada` es el día en que empieza el turno. Cada tipo se registra una sola vez por empleado y jornada (`uq_novedad_empleado_jornada_tipo`).
- La novedad copia el turno de ese día (`nombre_turno`, `inicio_programado`, `fin_programado`, `minutos_tolerancia`) para que no cambie si después se edita el turno o el rol; si el turno se elimina, `id_turno` queda en NULL y la copia se conserva. `id_rol` se llena si el turno vino de un rol publicado.
- `id_marcaje` apunta a la entrada del atraso o a la salida anticipada; la omisión apunta a la entrada que quedó sin salida y la inasistencia no tiene marcaje.
- `minutos` son los minutos de atraso, los que faltaron por la salida anticipada o los de la jornada no trabajada. `minutos_penalizacion` es el tiempo que se descuenta en compensaciones. `minutos_programados` son las horas efectivas del turno (duración - refrigerio).
- Estado (`CATALOGOS_ESTADO_NOVEDAD`): `REGISTRADA` o `JUSTIFICADA`. Una novedad justificada no suma penalización.
- `consolidada_en` se llena cuando la jornada se cierra y se avisa a compensaciones.
- `id_empleado` debería hacer referencia a `id_empleado` de EmployeeDB.

### Contraste de turnos y marcajes

- El turno de un día es el del rol publicado (`TURNOS_PUBLICADOS`); si no hay, la asignación fija vigente (`ASIGNACIONES_TURNO`) con un turno activo. Un descanso o un día sin turno no genera novedades.
- La entrada del turno es la primera marcada desde 4 horas antes del inicio y antes del fin; la salida es la de la misma jornada de marcaje. Así una entrada pasada la medianoche cuenta para el turno nocturno de la víspera.
- **Atraso:** entrada después de `hora_inicio` + tolerancia. Los minutos se cuentan desde `hora_inicio` (minuto iniciado = minuto completo) y son la penalización.
- **Salida anticipada:** salida antes del fin del turno. Los minutos que faltaban son tiempo no laborado y son la penalización.
- **Inasistencia:** sin entrada al terminar el turno. La penalización son las horas efectivas del turno (duración - refrigerio). Solo se registra a empleados activos en EmployeeService; si no responde, espera al siguiente contraste.
- **Omisión de salida:** entrada sin salida al cerrar la jornada. Es una alerta, sin penalización.
- La jornada se cierra `MINUTOS_CIERRE_JORNADA` minutos después del fin del turno (por defecto 120).
- El atraso y la salida anticipada se registran al marcar; la respuesta del marcaje los incluye. Además, un proceso del servicio contrasta cada `INTERVALO_CONTRASTE_MS` (por defecto 5 minutos) los últimos 7 días, así que lo que no se registró al marcar (o mientras el servicio estuvo detenido) se recupera. Repetir el contraste no duplica novedades.
- `GET /panel-asistencia?id_sucursal=&id_departamento=&fecha=` contrasta el día y devuelve el estado de cada colaborador activo: por llegar, sin marcar (pasó la tolerancia), puntual, atraso, falta injustificada, descanso o sin turno.

### Aviso a compensaciones

- Al cerrar la jornada, sus novedades se consolidan y se registra un evento `JORNADA_CONSOLIDADA` con tópico `compensaciones` en `EVENTOS_SALIENTES`: empleado, fecha, turno, horas efectivas del turno (`minutos_programados`), minutos de penalización (de las novedades registradas, no justificadas), minutos justificados, horas efectivas reconocidas (`minutos_efectivos`) y el detalle de cada novedad.
- Se envía por REST (Compensaciones es del mismo proyecto): con `URL_COMPENSACIONES` el despachador hace `POST`; sin URL, CompensationService lo lee con `GET /eventos?topico=compensaciones`.
- Cada novedad se consolida una sola vez. Si una novedad aparece después del cierre, llega en otro evento de la misma jornada: el consumidor debe sumar por `id_novedad`.

## Justificaciones

- `SOLICITUDES_JUSTIFICACION` guarda el justificativo que el colaborador presenta para una novedad: motivo (`CATALOGOS_MOTIVO_JUSTIFICACION`), descripción opcional y estado (`CATALOGOS_ESTADO_JUSTIFICACION`): `PENDIENTE`, `APROBADA` o `RECHAZADA`.
- Solo se justifican los tipos con `es_justificable` en `CATALOGOS_TIPO_NOVEDAD`: atraso, inasistencia y salida anticipada. La omisión de salida no descuenta tiempo.
- Una novedad tiene a lo sumo una solicitud pendiente o aprobada (`uq_justificacion_novedad_vigente`). Las rechazadas quedan como historial y se puede presentar otra dentro del plazo.
- La revisión guarda `id_revisor` (y su nombre en ese momento), `revisada_en` y `comentario_revision` (obligatorio al rechazar).
- `ADJUNTOS_JUSTIFICACION` registra cada comprobante (PDF, JPG o PNG). El archivo se guarda en disco (`uploads/justificaciones`) con `clave_almacenamiento`; el nombre original solo se muestra.
- `id_empleado` e `id_revisor` deberían hacer referencia a `id_empleado` de EmployeeDB.

### Presentación y revisión

- El colaborador ve sus novedades justificables en `GET /mis-novedades` (últimos 30 días) con el plazo y su última solicitud, y presenta el justificativo con `POST /justificaciones` (multipart: `id_novedad`, `id_motivo`, `descripcion` y de 1 a 3 `archivos` de hasta 5 MB). El contenido de cada archivo debe coincidir con su tipo.
- El plazo es `HORAS_PLAZO_JUSTIFICACION` (por defecto 48) desde la incidencia: la marca del atraso o de la salida anticipada; en una inasistencia, el fin del turno. Vencido, el envío se rechaza con la fecha de vencimiento.
- La jefatura o RRHH revisa en `GET /justificaciones?id_sucursal=&id_departamento=&estado=` y decide con `PATCH /justificaciones/:id` (`decision`: `APROBADA` o `RECHAZADA`, `comentario`). Nadie revisa su propia solicitud.
- Al aprobar, la novedad pasa a `JUSTIFICADA` y deja de sumar penalización. Si la jornada ya se había consolidado, se registra un evento `JORNADA_RECALCULADA` para `compensaciones` con todas las novedades de la jornada.

## Horas extra y recargo nocturno

- `HORAS_JORNADA` guarda una fila por empleado y jornada con entrada y salida: la copia del turno programado (NULL si se trabajó en descanso o sin turno), las horas marcadas y su separación, en minutos completos.
  - **Ordinarias:** tiempo dentro del turno menos el refrigerio.
  - **Nocturnas:** las que caen entre las 20:00 y las 06:00 (hora de Bolivia). El refrigerio se descuenta primero del tiempo diurno.
  - **Extra:** tiempo después del fin del turno. Sin turno, todo lo trabajado queda por aprobar.
  - **Anticipadas:** tiempo antes del inicio del turno. No se paga salvo que el supervisor lo apruebe.
  - Un tramo fuera del turno menor a `MINUTOS_MINIMOS_EXTRA` (por defecto 15) no cuenta.
- Estado (`CATALOGOS_ESTADO_HORAS_EXTRA`): `SIN_EXTRA`, `PENDIENTE` (hay tiempo fuera del turno por revisar), `APROBADA`, `AJUSTADA` (aprobada con otros minutos) o `RECHAZADA`. Solo se pagan las extra aprobadas (`minutos_extra_aprobados`).
- **Tope legal** (Ley General del Trabajo, art. 50): hasta 2 horas extra por día. Con turno se aprueban como máximo 120 minutos; lo marcado de más queda registrado pero no se paga. Sin turno (descanso), como máximo la jornada de 8 horas (art. 46) y 2 horas extra.
- **Tipo de día** (`tipo_dia`): `HABIL`, `DOMINGO` o `FERIADO` (`FERIADOS`, nacionales de Bolivia 2026 y 2027). Un feriado que cae en domingo cuenta como domingo.
- Pago de la jornada, separado para planillas (columnas `minutos_extra_*`, `minutos_domingo`, `minutos_feriado`, `minutos_descanso`, `minutos_nocturnos`):

  | Columna | Qué guarda | Recargo |
  |---|---|---|
  | `minutos_extra_habil` | Extra aprobadas en día hábil | 100% (art. 55) |
  | `minutos_domingo` | Tiempo ordinario trabajado en domingo | 200% |
  | `minutos_extra_domingo` | Extra aprobadas en domingo | lo define planillas |
  | `minutos_feriado` | Tiempo ordinario trabajado en feriado | 100% (art. 55) |
  | `minutos_extra_feriado` | Extra aprobadas en feriado | lo define planillas |
  | `minutos_descanso` | Sin turno en día hábil: las primeras 8 horas aprobadas | lo define planillas |
  | `minutos_nocturnos` | Ordinarios nocturnos más los aprobados que caen en la franja (`minutos_extra_nocturnos`, las extra) | recargo nocturno |

  - Sin turno, las primeras 8 horas aprobadas son la jornada del día (`minutos_descanso`, `minutos_domingo` o `minutos_feriado`) y lo que sigue, hasta 2 horas, es extra.
  - Los minutos aprobados se toman primero después del turno y luego del tiempo anticipado.
  - Las tasas las aplica planillas (CompensationService); aquí solo se entregan los minutos.
- El cálculo corre en el mismo proceso del contraste (últimos 7 días) y antes de cada consulta. Repetirlo no duplica filas; una jornada ya consolidada no cambia.
- `GET /horas-extra?id_sucursal=&id_departamento=&desde=&hasta=&estado=` devuelve el desglose por jornada del personal (por defecto, desde el primer día del mes hasta hoy; máximo 92 días).
- `GET /horas-extra/resumen?desde=&hasta=&id_sucursal=` totaliza por empleado (sin sucursal, toda la empresa); con `formato=csv` se descarga para hojas de cálculo (separador `;`, decimales con coma).
- **Autorización previa** (`AUTORIZACIONES_HORAS_EXTRA`): el supervisor autoriza con `POST /horas-extra/autorizaciones` (`id_empleado`, `fecha_jornada` de hoy en adelante, `minutos_autorizados`, `motivo`) cuántos minutos extra puede quedarse un colaborador un día: hasta 120 si ese día tiene turno, hasta 600 si no; una por colaborador y día (autorizar de nuevo la reemplaza). Al calcular la jornada se aprueba sola hasta lo autorizado y el tope legal (`APROBADA` si coincide con lo marcado después del turno dentro del tope, `AJUSTADA` si no) y queda enlazada en `id_autorizacion`. Se consulta con `GET /horas-extra/autorizaciones?id_sucursal=&desde=&hasta=` y se anula con `DELETE /horas-extra/autorizaciones/:id` mientras el día no haya pasado.
- **Conciliación** (`PATCH /horas-extra/:id`, `decision`: `APROBADA` o `RECHAZADA`, `minutos_aprobados`, `comentario`): el supervisor compara lo marcado en reloj con lo autorizado y aprueba lo marcado después del turno, ajusta los minutos (hasta lo marcado fuera del turno, anticipado incluido, y el tope legal) o rechaza. La respuesta trae `maximo_aprobable`. Ajustar o rechazar exige comentario. Se guarda `id_revisor`, su nombre, `comentario_revision` y `revisada_en`; nadie revisa sus propias horas. Se puede corregir hasta que el periodo se consolide, y una jornada revisada ya no cambia al recalcular.
- `id_autorizador` e `id_revisor` deberían hacer referencia a `id_empleado` de EmployeeDB.
- `PERIODOS_HORAS_EXTRA`: `POST /horas-extra/periodos` (`desde`, `hasta`, hasta 62 días ya terminados) cierra el periodo para planillas. Se rechaza si quedan jornadas pendientes de revisión o si se superpone con otro periodo. Al cerrar se registra un evento `HORAS_EXTRA_CONSOLIDADAS` con tópico `compensaciones` y los totales por empleado.
- `id_empleado` e `id_responsable` deberían hacer referencia a `id_empleado` de EmployeeDB.

## Eventos salientes

- `EVENTOS_SALIENTES` guarda, en la misma transacción que la publicación, los avisos para otros módulos (patrón outbox). Un proceso los envía después y reintenta si fallan.
- `topico` indica el destino; `carga` es el cuerpo JSON que se envía. Estados: `PENDIENTE`, `ENTREGADO`, `FALLIDO` (agotó los reintentos).
- Al publicar un rol de un área de producción o de reparto se registra un evento `ROL_TURNOS_PUBLICADO` por tópico. El área se reconoce por su código en EmployeeDB:
  - `AREAS_PRODUCCION` (panadería, fraccionamiento…) → tópico `produccion-logistica` (Producción y Logística).
  - `AREAS_REPARTO` (choferes de reparto) → tópico `entregas-despachos` (Gestión de Entregas y Despachos).
- La carga trae el periodo, la sucursal, el área, la disponibilidad por día (cuántos en mañana, tarde, noche y descanso) y el turno de cada colaborador. Cada nueva publicación del rol genera eventos nuevos con la versión.
- Producción y Logística y Entregas y Despachos son módulos externos: sus eventos salen por Google Pub/Sub. Todo lo que sale de RRHH se publica en el tópico de RRHH (`PUBSUB_PREFIJO_TOPICO` + la letra del grupo, `f`); a qué módulo va cada mensaje se indica en el `encabezado` (`origen` y `destino`), y el cuerpo va en `datos`. El `id_mensaje` del encabezado es el `id_evento` guardado, y se conserva en los reintentos. Sin credenciales (`GOOGLE_APPLICATION_CREDENTIALS`) o emulador (`PUBSUB_EMULATOR_HOST`), los eventos quedan `PENDIENTE` hasta que haya. Si Pub/Sub falla, reintenta con espera creciente (30 s, 1 min, 2 min… hasta 1 h); solo un tópico inexistente o un mensaje inválido lo dejan `FALLIDO`.
- Compensaciones es del mismo proyecto y va por REST. Con `URL_COMPENSACIONES`, el despachador hace `POST` con la carga y las cabeceras `X-Evento-Id` y `X-Topico`; una respuesta 2xx lo marca como entregado. Reintenta con la misma espera creciente y tras 8 intentos queda fallido. Sin URL, CompensationService puede leer los eventos con `GET /eventos?topico=compensaciones&estado=PENDIENTE` y confirmarlos con `POST /eventos/:id/confirmar`. Los consumidores deben ignorar un `X-Evento-Id` ya procesado (un evento puede llegar más de una vez).
## Vacaciones (RF-30)

- El campo id_empleado e id_supervisor deberían hacer referencia a id_empleado de EmployeeDB.
- Días hábiles: sin los feriados de la tabla `FERIADOS`. Si el colaborador tiene turno publicado ese día (`TURNOS_PUBLICADOS`), el día es hábil cuando es de trabajo y de descanso cuando es descanso; sin turno publicado, el sábado y el domingo son descansos obligatorios.
- Antigüedad suficiente: un año cumplido desde `fecha_ingreso` (EmployeeService). Antes de eso no se puede solicitar.
- Los días ganados y el saldo los calcula KAN-52 (`utils/vacaciones.js`, 15 días hábiles por año del 1.º al 5.º, 20 del 6.º al 10.º y 30 desde el 11.º), a partir de `MOVIMIENTOS_VACACION`. Al registrar una solicitud se crea en la misma sentencia su movimiento `EN_PROCESO`, que es lo que descuenta el saldo; aprobarla o cancelarla (KAN-53) cambia el estado de ese movimiento.
- Saldo disponible = días ganados − días gozados − días en proceso.
- Anticipación mínima: la fecha de inicio debe ser al menos 7 días calendario después de hoy (hora de Bolivia). Un periodo no puede superar 90 días calendario.
- No se aceptan fechas que se crucen con otra solicitud `PENDIENTE` o `APROBADA` del mismo empleado. El registro bloquea al empleado (`pg_advisory_xact_lock`) para que dos envíos simultáneos no superen el saldo ni se solapen.
- `dias_habiles` lo calcula el servidor; no se acepta el valor del cliente.
- El estado de la solicitud usa `CATALOGOS_ESTADO_SOLICITUD`, el mismo catálogo de las licencias.
- Endpoints: `GET /vacaciones/solicitudes/resumen` (saldo y datos para el formulario), `GET /vacaciones/solicitudes/calculo`, `GET` y `POST /vacaciones/solicitudes`. `GET /vacaciones/saldo` es el saldo con historial de KAN-52.
- Supervisor directo: quien ocupa el cargo `id_cargo_jefe_directo` del cargo del colaborador (EmployeeService lo devuelve en `GET /empleados/:id/supervisor`). Si hay varios, el de mayor antigüedad. La fecha de ingreso sale de `GET /empleados/:id`.
- Al registrar, se envía un mensaje directo al supervisor por NotificationService (`NOTIFICATION_SERVICE_URL`, `POST /comunicaciones/directa`). Si falla o no hay supervisor, la solicitud igual queda guardada con `supervisor_notificado = false` y se avisa al colaborador.
