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
- `fecha_jornada` es la fecha en hora de Bolivia al momento del marcaje; la salida toma la de su entrada.
- Un empleado tiene como máximo un marcaje por tipo (entrada o salida) en cada jornada (`uq_marcaje_empleado_tipo_jornada`).
- El origen indica cómo se tomó la marca: portal o biométrico. `codigo_dispositivo` solo se llena en marcajes biométricos.
- La salida cierra la entrada de la jornada en curso: la de hoy o, si la del día anterior sigue abierta y tiene menos de 16 horas, esa (turnos que cruzan la medianoche).
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
- `minutos` son los minutos de atraso, los que faltaron por la salida anticipada o los de la jornada no trabajada. `minutos_penalizacion` es el tiempo que se descuenta en compensaciones.
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

- Al cerrar la jornada, sus novedades se consolidan y se registra un evento `JORNADA_CONSOLIDADA` con tópico `compensaciones` en `EVENTOS_SALIENTES`: empleado, fecha, turno, minutos de penalización (de las novedades registradas, no justificadas) y el detalle de cada novedad.
- Se envía igual que los demás eventos: con `URL_COMPENSACIONES` el despachador hace `POST`; sin URL, CompensationService lo lee con `GET /eventos?topico=compensaciones`.
- Cada novedad se consolida una sola vez. Si una novedad aparece después del cierre, llega en otro evento de la misma jornada: el consumidor debe sumar por `id_novedad`.

## Eventos salientes

- `EVENTOS_SALIENTES` guarda, en la misma transacción que la publicación, los avisos para otros módulos (patrón outbox). Un proceso los envía después y reintenta si fallan.
- `topico` indica el destino; `carga` es el cuerpo JSON que se envía. Estados: `PENDIENTE`, `ENTREGADO`, `FALLIDO` (agotó los reintentos).
- Al publicar un rol de un área de producción o de reparto se registra un evento `ROL_TURNOS_PUBLICADO` por tópico. El área se reconoce por su código en EmployeeDB:
  - `AREAS_PRODUCCION` (panadería, fraccionamiento…) → tópico `produccion-logistica` (Producción y Logística).
  - `AREAS_REPARTO` (choferes de reparto) → tópico `entregas-despachos` (Gestión de Entregas y Despachos).
- La carga trae el periodo, la sucursal, el área, la disponibilidad por día (cuántos en mañana, tarde, noche y descanso) y el turno de cada colaborador. Cada nueva publicación del rol genera eventos nuevos con la versión.
- Si el tópico tiene URL (`URL_PRODUCCION_LOGISTICA`, `URL_ENTREGAS_DESPACHOS`), el despachador hace `POST` con la carga y las cabeceras `X-Evento-Id` y `X-Topico`; una respuesta 2xx lo marca como entregado. Reintenta con espera creciente (30 s, 1 min, 2 min… hasta 1 h) y tras 8 intentos queda fallido.
- Sin URL, el módulo puede leer los eventos con `GET /eventos?topico=&estado=PENDIENTE` y confirmarlos con `POST /eventos/:id/confirmar`. Los consumidores deben ignorar un `X-Evento-Id` ya procesado (un evento puede llegar más de una vez).
