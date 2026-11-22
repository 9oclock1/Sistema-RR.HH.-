# Aclaracion

Dentro de la base de datos se encuentra las siguientes observaciones que deben ser tomadas a consideración al momento de llenar los datos, ya que algunas cosas son unicas:

## Convocatorias de ascenso (KAN-80, RF-60)

- `CONVOCATORIAS_ASCENSO` publica un cargo del catálogo (`id_cargo`) en una sucursal, con sus requisitos (`descripcion_requisitos`, `meses_antiguedad_minima`, `nota_minima_desempeno` de 0 a 100) y el periodo de postulación. `id_empleado_publicador` guarda quién la publicó (queda en NULL si la petición no identificó al empleado).
- La fecha de cierre no puede ser anterior a la de inicio (`chk_convocatoria_fechas`). `esta_abierta` y `cerrada_en` van juntas: una convocatoria cerrada siempre tiene su fecha de cierre y una abierta nunca (`chk_convocatoria_cierre`).
- Backend: una convocatoria acepta postulaciones solo si `esta_abierta` y la fecha de hoy (America/La_Paz) está entre el inicio y el cierre, ambos inclusive. Aunque el job diario aún no la haya cerrado, una convocatoria con la fecha de cierre vencida se informa como cerrada.
- Backend: al llegar la fecha de cierre, el job diario pone `esta_abierta` en FALSE y llena `cerrada_en`, así que deja de aceptar postulaciones sin intervención de RRHH.
- Backend: solo los empleados activos (`ESTADOS_EMPLEADO.permite_acceso`) ven las convocatorias. RRHH (admin y gerente) ve todas, también las cerradas.
- Backend: al publicar, solo se aceptan cargos activos del catálogo y sucursales existentes, con la fecha de cierre desde hoy en adelante.
- La notificación a los empleados activos va por el comunicado institucional de NotificationService. `estado_notificacion` es `PENDIENTE` (todavía no se intentó), `ENTREGADA` (con `notificada_en` y `destinatarios_notificados`) o `FALLIDA` (con `ultimo_error_notificacion`). Publicar no falla si la notificación falla: RRHH la reintenta.
- Si ya tiene una base creada con la tabla anterior, vuelva a crear `POSTULACIONES_ASCENSO` y `CONVOCATORIAS_ASCENSO` desde `init.sql` (estaban vacías) o recree el volumen de la base.

## Postulaciones de ascenso

- Los campos id_convocatoria e id_empleado en su conjunto son unicos ya que no deben haber postulaciones duplicadas a la misma vacante.

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
- es_adenda debe coincidir con el tipo: 'CONTRATO_INICIAL' y 'RENOVACION' no son adendas; 'CAMBIO_JORNADA', 'AJUSTE_SALARIAL' y 'AJUSTE_CONDICIONES' si lo son.
- El inicio de periodo_vigencia es la fecha de vigencia de la version y es obligatorio. Las condiciones vigentes en una fecha son las de la ultima version que empezo hasta esa fecha.
- motivo_adenda guarda la justificacion del cambio.
- Los datos del documento firmado (url, nombre, tipo, tamano y hash SHA-256) se llenan todos o ninguno.
- numero_contrato es unico.
- El backend valida que la fecha de vigencia no sea anterior al inicio de la version vigente, que no se solape con otros contratos, que exista justificacion y documento firmado, y quien registro el cambio (registrado_por, registrado_rol).
