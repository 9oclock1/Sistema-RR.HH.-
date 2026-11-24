# Aclaracion

Dentro de la base de datos se encuentra las siguientes observaciones que deben ser tomadas a consideración al momento de llenar los datos, ya que algunas cosas son unicas:

## Convocatorias de ascenso (KAN-80, RF-60)

- `CONVOCATORIAS_ASCENSO` publica un cargo del catálogo (`id_cargo`) en una sucursal, con sus requisitos (`descripcion_requisitos`, `meses_antiguedad_minima`, `nota_minima_desempeno` de 0 a 100) y el periodo de postulación. `id_empleado_publicador` guarda quién la publicó (queda en NULL si la petición no identificó al empleado).
- La fecha de cierre no puede ser anterior a la de inicio (`chk_convocatoria_fechas`). `esta_abierta` y `cerrada_en` van juntas: una convocatoria cerrada siempre tiene su fecha de cierre y una abierta nunca (`chk_convocatoria_cierre`).
- Backend: una convocatoria acepta postulaciones solo si `esta_abierta` y la fecha de hoy (America/La_Paz) está entre el inicio y el cierre, ambos inclusive. Aunque el job diario aún no la haya cerrado, una convocatoria con la fecha de cierre vencida se informa como cerrada.
- Backend: al llegar la fecha de cierre, el job diario pone `esta_abierta` en FALSE y llena `cerrada_en`, así que deja de aceptar postulaciones sin intervención de RRHH.
- Backend: quién consulta y con qué rol sale de la sesión (JWT de la cookie `rrhh_sesion` firmado por AuthService), no de las cabeceras `X-Empleado-Id` y `X-Rol`. Sin sesión válida responde 401.
- Backend: solo los empleados activos (`ESTADOS_EMPLEADO.permite_acceso`) ven las convocatorias. RRHH (admin y gerente) ve todas, también las cerradas.
- Backend: al publicar, solo se aceptan cargos activos del catálogo y sucursales activas, con la fecha de inicio desde hoy y el cierre después del inicio.
- Backend: el cargo debe estar vacante en esa sucursal: si un empleado activo ya lo ocupa (`EMPLEADOS.id_cargo_actual` e `id_sucursal_actual`), la publicación se rechaza con 409. Tampoco se publica una segunda convocatoria abierta o programada para el mismo cargo y sucursal.
- `DESTINATARIOS_CONVOCATORIA` guarda a los empleados elegibles a los que se avisa: activos, que no ocupan ya el cargo ofertado y que a la fecha de cierre cumplen `meses_antiguedad_minima` (meses calendario completos desde `fecha_ingreso`, igual que la validación de la postulación). La nota mínima no se filtra al avisar: se valida al postularse (KAN-81).
- A cada elegible le llega un mensaje directo de NotificationService. `estado_notificacion` es `PENDIENTE` (todavía no se intentó), `ENTREGADA` (todos los avisos llegaron; `notificada_en` y `destinatarios_notificados`) o `FALLIDA` (algún aviso no llegó; `ultimo_error_notificacion`). Publicar no falla si la notificación falla: RRHH la reintenta y solo se reenvía a los que tienen `notificado_en` en NULL. Si nadie cumple la antigüedad, queda `ENTREGADA` con 0 destinatarios.
- Si ya tiene una base creada con la tabla anterior, vuelva a crear `POSTULACIONES_ASCENSO` y `CONVOCATORIAS_ASCENSO` desde `init.sql` (estaban vacías) o recree el volumen de la base.
- Si su base ya existe, cree `DESTINATARIOS_CONVOCATORIA` con su bloque de `init.sql` y vuelva a cargar `seed.sql` (agrega la sucursal El Alto y mueve las convocatorias de ejemplo a cargos vacantes).

## Postulaciones de ascenso

- Los campos id_convocatoria e id_empleado en su conjunto son unicos ya que no deben haber postulaciones duplicadas a la misma vacante.

## Formalización del ascenso (KAN-84)

- El Administrador formaliza el ascenso de un postulante `APTO` con `POST /convocatorias/:id/postulaciones/:idPostulacion/formalizacion` (sesión de admin). Cuerpo opcional: `fecha_vigencia` (hoy por defecto, no puede ser pasada), `haber_mensual_pactado` (por defecto el `salario_base_referencial` del cargo o el haber vigente si es mayor; nunca menor al vigente), `numero_contrato` de la adenda (por defecto `ASC-` + id de la postulación) y `observaciones`.
- En una sola transacción: registra en `CONTRATOS` una adenda con `tipo_modificacion = 'ASCENSO'` (mismo tipo de contrato, jornada y fecha de fin que la versión vigente; nuevo haber desde la fecha de vigencia), guarda la formalización en `POSTULACIONES_ASCENSO` y cierra la convocatoria (`esta_abierta = FALSE`) aunque su fecha de cierre no haya llegado.
- Nivel salarial y nivel jerárquico van con el cargo (`CARGOS.nivel_salarial` y `id_cargo_jefe_directo`): al cambiar el cargo cambian los dos.
- Con vigencia hoy, el cargo y la sucursal (la de la convocatoria) cambian enseguida (`estado_ascenso = 'APLICADO'`). Con vigencia futura queda `PROGRAMADO` y el job diario (`CRON_ASCENSOS`, por defecto 00:10 America/La_Paz; `CRON_ASCENSOS_ACTIVO=false` lo apaga) lo aplica al llegar la fecha. Si no se puede aplicar (p. ej. el cargo se desactivó), queda `PROGRAMADO` con `error_aplicacion_ascenso` y se reintenta en la siguiente corrida.
- La planilla toma el nuevo haber desde la fecha de vigencia sin pasos extra: `/contratos/vigentes` devuelve la adenda como un tramo más del contrato.
- A lo sumo un ascenso formalizado por convocatoria (`uq_postulacion_formalizada_convocatoria`), y un empleado no puede tener dos ascensos `PROGRAMADO` a la vez. Una postulación formalizada ya no se vuelve a validar.
- Los datos de la formalización (`estado_ascenso`, `fecha_formalizacion_ascenso`, `fecha_vigencia_ascenso`, `haber_ascenso`, `id_contrato_ascenso`, `formalizado_en`) se llenan todos o ninguno (`chk_postulacion_formalizada`).
- Al empleado promovido le llega un mensaje directo de NotificationService después de confirmar. Si no llega, el ascenso igual queda formalizado (`error_notificacion_ascenso`) y RRHH lo reintenta con `POST .../formalizacion/notificacion`.
- Si su base ya existe, aplique: `ALTER TABLE contratos DROP CONSTRAINT ck_contrato_tipo_modificacion, ADD CONSTRAINT ck_contrato_tipo_modificacion CHECK (tipo_modificacion IN ('CONTRATO_INICIAL', 'RENOVACION', 'CAMBIO_JORNADA', 'AJUSTE_SALARIAL', 'AJUSTE_CONDICIONES', 'ASCENSO'));` y agregue a `POSTULACIONES_ASCENSO` las columnas, restricciones e índices del bloque KAN-84 de `init.sql` (la tabla puede conservarse: las columnas nuevas admiten NULL).

## Requisitos de capacitacion para un cargo

- Los campos id_cargo e id_curso en su conjunto son unicos ya que no deben haber requisitos de cursos duplicados para el mismo cargo.

## Acuse de recibo de memorándums (RF-39)

- El plazo de acuse (fecha_limite_acuse) corre desde que el aviso llegó al portal del colaborador (fecha_hora_notificacion), no desde la fecha de emisión; si NotificationService no responde al emitir, el memorándum queda con fue_notificado en false y el job de EmployeeService reintenta el aviso.
- Los campos fecha_hora_acuse, ip_acuse e id_usuario_acuse se llenan juntos y una sola vez, cuando el colaborador acusa recibo; el acuse no se puede modificar después.
- El campo estado_acuse vale PENDIENTE, RECIBIDO («Notificado y Recibido») o VENCIDO (venció el plazo sin acuse y ya se alertó a RRHH en fecha_hora_alerta_rrhh). Un memorándum VENCIDO todavía puede recibir el acuse y pasa a RECIBIDO.
- El campo id_usuario_acuse debería hacer referencia a un campo similar a id_usuario proporcionado por AuthDB; mientras no exista inicio de sesión guarda el id del empleado.

## Contratos, renovaciones y adendas

- Cada fila de CONTRATOS es una version del contrato y nunca se modifica ni se elimina; una renovacion o adenda se registra como una fila nueva.
- id_contrato_anterior apunta a la version que se reemplaza y es unico: cada version solo puede ser reemplazada una vez, asi el historial queda como una sola linea por empleado.
- El primer contrato de un empleado es tipo_modificacion = 'CONTRATO_INICIAL' y no tiene id_contrato_anterior; los demas tipos siempre lo tienen.
- es_adenda debe coincidir con el tipo: 'CONTRATO_INICIAL' y 'RENOVACION' no son adendas; 'CAMBIO_JORNADA', 'AJUSTE_SALARIAL', 'AJUSTE_CONDICIONES' y 'ASCENSO' si lo son. 'ASCENSO' solo lo registra el sistema al formalizar un ascenso (KAN-84); no se elige al registrar una modificación a mano.
- El inicio de periodo_vigencia es la fecha de vigencia de la version y es obligatorio. Las condiciones vigentes en una fecha son las de la ultima version que empezo hasta esa fecha.
- motivo_adenda guarda la justificacion del cambio.
- Los datos del documento firmado (url, nombre, tipo, tamano y hash SHA-256) se llenan todos o ninguno.
- numero_contrato es unico.
- El backend valida que la fecha de vigencia no sea anterior al inicio de la version vigente, que no se solape con otros contratos, que exista justificacion y documento firmado, y quien registro el cambio (registrado_por, registrado_rol).
