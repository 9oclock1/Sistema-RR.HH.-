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
