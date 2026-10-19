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

## Vacaciones (KAN-52)

- Los días ganados no se guardan: se calculan en cada consulta con `fecha_ingreso` (EmployeeService, `GET /empleados/:id`) y la escala legal (Ley General del Trabajo, art. 44).
- Cada aniversario cumplido acredita un período: años 1 a 5 = 15 días, 6 a 10 = 20 días, 11 o más = 30 días (hábiles). Antes del primer año no se gana ningún día. Un ingreso el 29 de febrero cumple el 28 en los años no bisiestos.
- `MOVIMIENTOS_VACACION` guarda solo los días consumidos o reservados, en estado `EN_PROCESO`, `GOZADO` o `CANCELADO`. `id_empleado` e `id_solicitud_origen` no tienen FK (otro servicio / historia KAN-50). Una solicitud origina un solo movimiento.
- Saldo disponible = acumulados − gozados − en proceso. Los cancelados no cuentan ni aparecen en el historial. Las historias KAN-50 y KAN-53 crean el movimiento al solicitar y lo pasan a `GOZADO` o `CANCELADO` al resolver; el saldo se actualiza solo porque se calcula al consultar.
- La fecha de consulta es la de Bolivia (UTC-4). No se modela la caducidad de vacaciones no gozadas.
