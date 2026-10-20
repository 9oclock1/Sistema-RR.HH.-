# Épica 5 · Solicitud de vacaciones, permisos y licencias

Documentación UML de la épica 5 del Sistema de RR.HH. del ERP de supermercado (**KAN-307**). Incluye una **vista general** con un diagrama de clases y uno de secuencia para toda la épica, y una **vista detallada** con el modelo de dominio y un diagrama de secuencia por cada historia.

Los diagramas están escritos en **Mermaid**: GitHub, VS Code (con la extensión *Markdown Preview Mermaid Support*) y la mayoría de visores de Markdown los dibujan al abrir este archivo, sin instalar nada. Cada bloque se puede copiar tal cual a <https://mermaid.live> para exportarlo como imagen.

## Contenido

1. [Historias de la épica](#historias-de-la-épica)
2. [Vista general](#1-vista-general)
   - [Diagrama de clases de la épica](#11-diagrama-de-clases-de-la-épica)
   - [Diagrama de secuencia de la épica](#12-diagrama-de-secuencia-de-la-épica)
3. [Diagrama de clases detallado](#2-diagrama-de-clases-detallado)
4. [Diagramas de secuencia por historia](#3-diagramas-de-secuencia-por-historia)
5. [Notación](#notación)
6. [Trazabilidad con el código](#trazabilidad-con-el-código)
7. [Configuración](#configuración)

## Historias de la épica

| Historia | Requerimiento | Qué resuelve |
|---|---|---|
| **KAN-50** | RF-30 · Solicitud formal de vacaciones | Fechas de inicio y fin, días hábiles sin feriados ni descansos, bloqueo por saldo insuficiente o cruce de fechas, aviso al supervisor |
| **KAN-51** | RF-31 · Licencias y permisos especiales | Causal tipificada con o sin goce de haberes, comprobante digital obligatorio según la causal y advertencia al superar el tope de días |
| **KAN-52** | RF-32 · Saldo de vacaciones | Días ganados por antigüedad (15, 20 o 30), gozados y en proceso, siempre calculados al consultar |
| **KAN-53** | RF-33 · Aprobación o rechazo | Bandeja del supervisor con prioridad y cobertura, débito definitivo del saldo, justificación obligatoria al rechazar e indisponibilidad hacia Producción y Entregas |
| **KAN-54** | RF-34 · Notificación del resultado | Alerta en el portal, campana con contador, correo resumen y enlace al detalle de la solicitud |
| **KAN-55** | RF-35 · Calendario de ausencias | Cronograma mensual, semanal y diario de ausencias aprobadas, color por tipo, filtros y aviso de baja cobertura |

## 1. Vista general

### 1.1 Diagrama de clases de la épica

Las entidades agrupadas por historia, con sus atributos clave. El `Empleado` vive en EmployeeService: AttendanceService guarda solo su UUID (línea punteada, sin clave foránea).

```mermaid
classDiagram
  direction LR

  class Empleado {
    <<EmployeeService>>
    +UUID id_empleado
    +date fecha_ingreso
    +cargo, area, sucursal
    +supervisor directo
  }

  namespace KAN_50_52_Vacaciones {
    class SolicitudVacacion {
      +UUID id_solicitud
      +date fecha_inicio
      +date fecha_fin
      +int dias_habiles
      +UUID id_supervisor
      +bool supervisor_notificado
      +UUID id_empleado_resolutor
      +timestamp resuelto_en
      +text motivo_resolucion
      +timestamp resolucion_notificada_en
    }
    class MovimientoVacacion {
      +UUID id_movimiento
      +int dias
      +date fecha_inicio
      +date fecha_fin
      +EstadoMovimiento estado
    }
    class Feriado {
      +date fecha
      +string nombre
    }
  }

  namespace KAN_51_Licencias {
    class SolicitudLicencia {
      +UUID id_solicitud
      +date fecha_inicio
      +date fecha_fin
      +int dias_solicitados
      +bool es_con_goce_haberes
      +bool excede_limite_dias
      +text motivo
      +UUID id_empleado_resolutor
      +timestamp resuelto_en
      +text motivo_resolucion
    }
    class TipoLicencia {
      +string codigo
      +string nombre
      +bool es_con_goce_haberes
      +int dias_maximos_continuos
      +bool requiere_adjunto
    }
    class AdjuntoLicencia {
      +UUID id_adjunto
      +string nombre_original
      +string formato_mimetype
      +int tamano_bytes
    }
  }

  namespace KAN_53_Aprobacion {
    class EstadoSolicitud {
      <<enumeration>>
      PENDIENTE
      APROBADA
      RECHAZADA
      CANCELADA
    }
    class EventoSaliente {
      +UUID id_evento
      +string topico
      +string tipo_evento = PERSONAL_NO_DISPONIBLE
      +json carga
      +EstadoEvento estado
      +int intentos
    }
  }

  namespace KAN_54_Notificacion {
    class Notificacion {
      <<NotificationDB>>
      +UUID id_notificacion
      +UUID id_empleado
      +string tipo
      +string titulo
      +text mensaje
      +string enlace
      +UUID id_referencia
      +bool leida
      +string correo_estado
    }
  }

  namespace KAN_55_Calendario {
    class UmbralCobertura {
      +UUID id_umbral
      +UUID id_sucursal
      +UUID id_departamento
      +int max_ausentes_porcentaje
      +int min_presentes
    }
    class TurnoPublicado {
      +UUID id_empleado
      +date fecha
      +bool es_descanso
    }
  }

  SolicitudVacacion "1" --> "1" MovimientoVacacion : reserva y debita días
  SolicitudVacacion ..> EstadoSolicitud
  SolicitudLicencia ..> EstadoSolicitud
  SolicitudLicencia "*" --> "1" TipoLicencia
  SolicitudLicencia "1" *-- "0..*" AdjuntoLicencia
  SolicitudVacacion ..> Feriado : excluye días no hábiles
  SolicitudVacacion ..> TurnoPublicado : descansos del rol
  SolicitudVacacion ..> EventoSaliente : al aprobar
  SolicitudLicencia ..> EventoSaliente : al aprobar
  SolicitudVacacion ..> Notificacion : avisa el resultado
  SolicitudLicencia ..> Notificacion : avisa el resultado
  SolicitudVacacion ..> Empleado : id_empleado
  SolicitudLicencia ..> Empleado : id_empleado
  UmbralCobertura ..> Empleado : sucursal y área
```

### 1.2 Diagrama de secuencia de la épica

Un recorrido de punta a punta en el orden en que se usa la épica:

1. **KAN-52** · el colaborador consulta su saldo.
2. **KAN-50 · KAN-51** · pide vacaciones o una licencia y su supervisor recibe el aviso.
3. **KAN-53** · el supervisor revisa con el impacto en el equipo y decide; al aprobar se debita el saldo y se avisa a Producción o Entregas.
4. **KAN-54** · el colaborador recibe la alerta, el correo y abre el detalle.
5. **KAN-55** · el supervisor ve las ausencias aprobadas en el calendario y los días de baja cobertura.

```mermaid
sequenceDiagram
  autonumber
  actor C as Colaborador
  actor S as Supervisor o RRHH
  participant P as Portal
  participant A as AttendanceService
  participant E as EmployeeService
  participant N as NotificationService
  participant ERP as Producción y Entregas
  participant DB as AttendanceDB

  rect rgb(233, 242, 254)
    Note over C,DB: KAN-52 · KAN-50 · KAN-51 · el colaborador pide
    C->>P: consulta su saldo y pide vacaciones o una licencia
    P->>A: GET saldo, POST solicitud
    A->>E: fecha de ingreso, estado y supervisor
    A->>DB: valida saldo, cruces y topes, guarda la solicitud y reserva los días
    A-->>N: mensaje directo al supervisor
  end

  rect rgb(255, 247, 214)
    Note over S,DB: KAN-53 · el supervisor decide
    S->>P: abre Aprobaciones
    P->>A: GET bandeja y detalle
    A->>E: personal de la sucursal
    A->>DB: solicitudes, ausencias del equipo y saldo
    S->>P: aprueba o rechaza con motivo
    P->>A: POST resolución
    A->>DB: una transacción: estado, saldo y evento de indisponibilidad
    A-->>ERP: PERSONAL_NO_DISPONIBLE por REST o Pub/Sub
  end

  rect rgb(220, 255, 241)
    Note over C,N: KAN-54 · el colaborador se entera
    A->>N: POST resolución de solicitud
    N->>N: alerta en el portal y correo resumen
    C->>P: campana, Notificaciones, Ver solicitud
  end

  rect rgb(243, 240, 255)
    Note over S,DB: KAN-55 · cobertura del equipo
    S->>P: Calendario de ausencias
    P->>A: GET calendario por sucursal, área y rango
    A->>DB: ausencias aprobadas, turnos, feriados y umbrales
    A-->>P: ausencias y días con baja cobertura
  end
```

## 2. Diagrama de clases detallado

### 2.1 Modelo de dominio

Las tablas de la épica con sus atributos reales. Los catálogos de estado y de tipo de licencia son enumeraciones; `TurnoPublicado` y `EventoSaliente` vienen de la épica 4. La restricción `EXCLUDE` de `SolicitudLicencia` impide que un empleado tenga dos licencias `PENDIENTE` o `APROBADA` con fechas cruzadas.

```mermaid
classDiagram
  direction TB

  class SolicitudVacacion {
    +UUID id_solicitud PK
    +UUID id_empleado
    +EstadoSolicitud id_estado_solicitud
    +date fecha_inicio
    +date fecha_fin
    +int dias_habiles
    +UUID id_supervisor
    +bool supervisor_notificado
    +UUID id_empleado_resolutor
    +timestamptz resuelto_en
    +text motivo_resolucion
    +timestamptz resolucion_notificada_en
    +timestamptz creado_en
  }
  class MovimientoVacacion {
    +UUID id_movimiento PK
    +UUID id_empleado
    +EstadoMovimiento id_estado_movimiento
    +UUID id_solicitud_origen UK
    +date fecha_inicio
    +date fecha_fin
    +int dias
  }
  class SolicitudLicencia {
    +UUID id_solicitud PK
    +UUID id_empleado
    +TipoLicencia id_tipo_licencia
    +EstadoSolicitud id_estado_solicitud
    +date fecha_inicio
    +date fecha_fin
    +int dias_solicitados «derivado»
    +bool es_con_goce_haberes
    +bool excede_limite_dias
    +text motivo
    +UUID id_empleado_resolutor
    +timestamptz resuelto_en
    +text motivo_resolucion
    +timestamptz resolucion_notificada_en
  }
  class AdjuntoLicencia {
    +UUID id_adjunto PK
    +UUID id_solicitud FK
    +string nombre_original
    +string archivo_url
    +string formato_mimetype
    +int tamano_bytes
  }
  class TipoLicencia {
    <<enumeration>>
    MEDICA · con goce · requiere adjunto
    MATERNIDAD · con goce · 90 días
    PATERNIDAD · con goce · 3 días
    DUELO · con goce · 3 días
    ACADEMICA · sin goce · 5 días
    PERSONAL · sin goce · 2 días
  }
  class EstadoSolicitud {
    <<enumeration>>
    PENDIENTE
    APROBADA
    RECHAZADA
    CANCELADA
  }
  class EstadoMovimiento {
    <<enumeration>>
    EN_PROCESO
    GOZADO
    CANCELADO
  }
  class Feriado {
    +date fecha PK
    +string nombre
  }
  class TurnoPublicado {
    +UUID id_empleado
    +date fecha
    +bool es_descanso
  }
  class EventoSaliente {
    +UUID id_evento PK
    +string topico
    +string tipo_evento
    +jsonb carga
    +EstadoEvento id_estado_evento
    +int intentos
    +timestamptz proximo_intento_en
  }
  class UmbralCobertura {
    +UUID id_umbral PK
    +UUID id_sucursal «NULL = todas»
    +UUID id_departamento «NULL = todas»
    +int max_ausentes_porcentaje
    +int min_presentes
    +UUID actualizado_por
  }
  class Notificacion {
    <<NotificationDB>>
    +UUID id_notificacion PK
    +UUID id_empleado
    +string tipo
    +string titulo
    +text mensaje
    +string enlace
    +UUID id_referencia UK
    +bool leida
    +string correo_estado
  }

  SolicitudVacacion "1" -- "1" MovimientoVacacion : id_solicitud_origen
  SolicitudVacacion "*" --> "1" EstadoSolicitud
  SolicitudLicencia "*" --> "1" EstadoSolicitud
  SolicitudLicencia "*" --> "1" TipoLicencia
  SolicitudLicencia "1" *-- "0..*" AdjuntoLicencia
  MovimientoVacacion "*" --> "1" EstadoMovimiento
  SolicitudVacacion ..> Feriado : días hábiles
  SolicitudVacacion ..> TurnoPublicado : descansos
  SolicitudVacacion ..> EventoSaliente : «publica» al aprobar
  SolicitudLicencia ..> EventoSaliente : «publica» al aprobar
  SolicitudVacacion ..> Notificacion : «HTTP» resultado
  SolicitudLicencia ..> Notificacion : «HTTP» resultado
  UmbralCobertura ..> TurnoPublicado : cobertura por día
```

### 2.2 Capas del servicio

Cómo se reparte la lógica en `AttendanceService` y qué módulos externos usa cada historia.

```mermaid
classDiagram
  direction LR

  class SolicitudesVacacionService {
    +consultarSaldo()
    +calcular()
    +registrarSolicitud()
    +resolverSolicitud()
  }
  class LicenciasService {
    +listarTipos()
    +radicar()
    +resolver()
    +reintentarAvisosPendientes()
  }
  class VacacionesService {
    +consultarMiSaldo()
    +consultarSaldo()
  }
  class AprobacionesService {
    +listarBandeja()
    +obtenerDetalle()
    +resolver()
    +iniciarReintentoDeAvisos()
  }
  class IndisponibilidadService {
    +prepararEvento()
  }
  class EventosService {
    +registrarIndisponibilidad()
    +despachar()
    +reintentar()
  }
  class CalendarioAusenciasService {
    +alcance()
    +consultar()
    +listarUmbrales()
    +guardarUmbral()
    +eliminarUmbral()
  }
  class EmpleadosService {
    <<cliente HTTP>>
    +obtener()
    +listarPorArea()
    +obtenerUbicacionConArea()
  }
  class NotificacionesService {
    <<cliente HTTP>>
    +avisarSolicitudVacaciones()
    +notificarResolucion()
  }
  class UtilsDominio {
    <<funciones puras>>
    contarDiasHabiles()
    calcularSaldo()
    evaluarLimite()
    calcularPrioridad()
    calcularCobertura()
    calcularDias()
    resolverUmbral()
  }

  SolicitudesVacacionService --> EmpleadosService
  SolicitudesVacacionService --> NotificacionesService
  SolicitudesVacacionService --> IndisponibilidadService
  SolicitudesVacacionService --> UtilsDominio
  LicenciasService --> NotificacionesService
  LicenciasService --> IndisponibilidadService
  VacacionesService --> UtilsDominio
  AprobacionesService --> LicenciasService
  AprobacionesService --> SolicitudesVacacionService
  AprobacionesService --> UtilsDominio
  IndisponibilidadService --> EventosService
  IndisponibilidadService --> EmpleadosService
  CalendarioAusenciasService --> EmpleadosService
  CalendarioAusenciasService --> UtilsDominio
```

## 3. Diagramas de secuencia por historia

Cada diagrama sigue las capas del servicio: pantalla → API Gateway → controlador → servicio → modelo → base de datos, más los sistemas externos. Las respuestas de error se indican con su código HTTP.

### 3.1 KAN-50 · Solicitud formal de vacaciones

Cálculo de días hábiles, validación de saldo, anticipación y cruces dentro de una transacción que bloquea al empleado, y aviso al supervisor directo.

```mermaid
sequenceDiagram
  autonumber
  actor C as Colaborador
  participant P as Solicitud de vacaciones
  participant GW as API Gateway
  participant S as SolicitudesVacacionService
  participant E as EmployeeService
  participant M as Modelo
  participant DB as AttendanceDB
  participant N as NotificationService

  C->>P: fecha de inicio y de fin
  P->>GW: GET /att/vacaciones/solicitudes/calculo
  GW->>S: calcular(idEmpleado, fechas)
  S->>E: GET /empleados/:id
  S->>M: feriados, turnos publicados y solicitudes cruzadas
  M->>DB: FERIADOS, TURNOS_PUBLICADOS, SOLICITUDES_VACACION
  S-->>P: días hábiles y problemas (saldo, cruce, anticipación)
  C->>P: Enviar solicitud
  P->>GW: POST /att/vacaciones/solicitudes
  GW->>S: registrarSolicitud(idEmpleado, fechas)
  S->>E: empleado activo con un año de antigüedad
  S->>E: GET /empleados/:id/supervisor
  S->>M: enTransaccionDeEmpleado
  M->>DB: BEGIN y pg_advisory_xact_lock
  S->>S: vuelve a evaluar saldo, anticipación y cruces
  alt hay problemas
    S-->>P: 409 saldo insuficiente, conflicto de fechas o anticipación
    M->>DB: ROLLBACK
  else todo válido
    M->>DB: INSERT solicitud PENDIENTE y movimiento EN_PROCESO (una sentencia)
    M->>DB: COMMIT
    S->>N: POST /comunicaciones/directa al supervisor
    opt NotificationService acepta
      S->>M: marcarNotificada
    end
    S-->>P: 201 solicitud pendiente y aviso si el supervisor no se pudo notificar
  end
```

### 3.2 KAN-51 · Licencias y permisos especiales

Causal del catálogo con su clasificación de goce de haberes, comprobante obligatorio según la causal, validación del contenido del archivo y advertencia al superar el tope de días.

```mermaid
sequenceDiagram
  autonumber
  actor C as Colaborador
  participant P as Licencias
  participant GW as API Gateway
  participant S as LicenciasService
  participant E as EmployeeService
  participant A as Almacenamiento
  participant M as Modelo
  participant DB as AttendanceDB

  C->>P: causal, fechas y comprobantes
  P->>GW: POST /att/licencias/solicitudes (multipart)
  GW->>S: radicar(idEmpleado, datos, archivos)
  S->>E: empleado activo
  S->>M: obtenerTipo(causal)
  M->>DB: CATALOGOS_TIPO_LICENCIA
  alt la causal exige respaldo y no hay archivo
    S-->>P: 400 adjunte el respaldo digital
  else hay respaldo o no se exige
    S->>S: valida firma del archivo (PDF, JPG o PNG)
    S->>A: guarda cada archivo
    S->>S: evaluarLimite(tipo, días)
    S->>M: crear(solicitud, adjuntos)
    M->>DB: BEGIN, INSERT solicitud y adjuntos, COMMIT
    alt fechas cruzadas con otra licencia activa
      DB-->>M: 23P01 (EXCLUDE)
      S->>A: elimina los archivos guardados
      S-->>P: 409 elija fechas que no se solapen
    else registrada
      S-->>P: 201 con clasificación CON_GOCE o SIN_GOCE
      Note over S,P: si excede el tope, requiere_autorizacion_rrhh = true y se advierte
    end
  end
```

### 3.3 KAN-52 · Saldo de vacaciones

Los días ganados no se guardan: se calculan en cada consulta con la fecha de ingreso y la escala legal, y se restan los movimientos gozados y en proceso.

```mermaid
sequenceDiagram
  autonumber
  actor U as Colaborador o RRHH
  participant P as Vacaciones
  participant GW as API Gateway
  participant S as VacacionesService
  participant E as EmployeeService
  participant M as Modelo
  participant DB as AttendanceDB

  U->>P: abre su saldo, o el expediente de un empleado (RRHH)
  P->>GW: GET /att/vacaciones/saldo
  GW->>S: consultarMiSaldo(idEmpleado)
  S->>E: GET /empleados/:id (fecha de ingreso)
  alt el empleado no existe
    S-->>P: 403 no corresponde a un empleado registrado
  else existe
    S->>M: listarMovimientos(idEmpleado)
    M->>DB: MOVIMIENTOS_VACACION (sin cancelados)
    S->>S: periodos acreditados por aniversario (15, 20 o 30 días)
    S->>S: disponibles = acumulados - gozados - en proceso
    S-->>P: saldo, períodos ganados e historial de consumo
  end
```

### 3.4 KAN-53 · Aprobación o rechazo

Bandeja con prioridad, detalle con cobertura, resolución en una transacción (estado, saldo y evento de indisponibilidad) y envío asíncrono con respaldo.

```mermaid
sequenceDiagram
  autonumber
  actor S as Supervisor o RRHH
  participant P as Aprobaciones
  participant GW as API Gateway
  participant MW as exigirResolutor
  participant AP as AprobacionesService
  participant V as SolicitudesVacacionService
  participant I as IndisponibilidadService
  participant E as EmployeeService
  participant M as Modelo
  participant DB as AttendanceDB
  participant EV as Despachador de eventos
  participant ERP as Producción o Entregas
  participant N as NotificationService

  S->>P: sucursal, área, tipo y prioridad
  P->>GW: GET /att/aprobaciones/solicitudes
  GW->>MW: X-Rol supervisor, gerente o admin
  alt rol no autorizado
    MW-->>P: 403 solo supervisor o RRHH
  else autorizado
    MW->>AP: listarBandeja(filtros)
    AP->>E: personal de la sucursal
    AP->>M: vacaciones y licencias del personal
    M->>DB: SOLICITUDES_VACACION y SOLICITUDES_LICENCIA
    AP-->>P: solicitudes ordenadas por prioridad y contadores
  end
  S->>P: Revisar
  P->>GW: GET /att/aprobaciones/solicitudes/VACACIONES/:id
  AP->>E: ubicación y equipo del colaborador
  AP->>M: ausencias del equipo que se cruzan
  AP-->>P: fechas, días, causal, comprobantes, saldo y cobertura
  S->>P: Aprobar o Rechazar con motivo
  P->>GW: POST /att/aprobaciones/solicitudes/VACACIONES/:id/resolucion
  GW->>AP: resolver(categoría, resolutor, datos)
  AP->>V: resolverSolicitud
  alt rechazo sin motivo, solicitud propia o ya resuelta
    V-->>P: 400, 403 o 409
  else decisión válida
    opt aprobación
      V->>I: prepararEvento
      I->>E: nombre y área del empleado
    end
    V->>M: enTransaccionDeEmpleado
    M->>DB: UPDATE solicitud (solo si sigue PENDIENTE)
    M->>DB: movimiento EN_PROCESO pasa a GOZADO (aprobar) o CANCELADO (rechazar)
    opt aprobación
      M->>DB: INSERT EVENTOS_SALIENTES PERSONAL_NO_DISPONIBLE
    end
    M->>DB: COMMIT
    V->>N: alerta del resultado (KAN-54)
    V-->>P: 200 resuelta, notificacion_enviada, eventos_sincronizacion
  end
  loop cada 5 segundos
    EV->>DB: reserva eventos pendientes
    alt hay URL REST del módulo
      EV->>ERP: POST del evento
      opt el endpoint falla y hay Pub/Sub
        EV->>ERP: publica en Pub/Sub
      end
    else
      EV->>ERP: publica en Pub/Sub
    end
    EV->>DB: entregado, o error con espera creciente (fallido tras agotarse)
  end
```

### 3.5 KAN-54 · Notificación del resultado

El aviso sale después de confirmar la resolución. NotificationService es idempotente por solicitud y empleado; si no responde, un reintento periódico completa el aviso.

```mermaid
sequenceDiagram
  autonumber
  participant AT as AttendanceService
  participant N as NotificationService
  participant NDB as NotificationDB
  participant E as EmployeeService
  participant SMTP as Servidor de correo
  actor C as Colaborador
  participant P as Portal (campana y Notificaciones)

  AT->>N: POST /notificaciones/resolucion-solicitud (categoría, estado, motivo)
  N->>N: valida y arma el mensaje y el enlace de su categoría
  N->>NDB: INSERT notificación (ON CONFLICT DO NOTHING)
  alt ya existía (reintento)
    N-->>AT: 200 sin repetir alerta ni correo
  else nueva
    N->>E: correo del empleado
    N->>SMTP: correo resumen con el enlace al detalle
    N->>NDB: correo_estado ENVIADO, FALLIDO o NO_APLICA
    N-->>AT: 201
  end
  alt NotificationService no respondió
    AT->>AT: resolucion_notificada_en vacío, el reintento cada 60 s lo completa
  end
  loop cada 30 segundos con la pestaña visible
    P->>N: GET /notificaciones/conteo
    N-->>P: no leídas (contador de la campana)
  end
  C->>P: abre la campana o la página Notificaciones
  P->>N: GET /notificaciones (estado, límite, desplazamiento)
  N-->>P: página, no leídas y total
  C->>P: Ver solicitud
  P->>N: POST /notificaciones/:id/leer
  P->>P: navega al detalle de la solicitud
```

### 3.6 KAN-55 · Calendario consolidado de ausencias

Una sola consulta trae las ausencias aprobadas del personal; la cobertura por área y día se calcula con los turnos publicados y el umbral que rige.

```mermaid
sequenceDiagram
  autonumber
  actor S as Supervisor o RRHH
  participant P as Calendario de ausencias
  participant GW as API Gateway
  participant CAL as CalendarioAusenciasService
  participant E as EmployeeService
  participant M as Modelo
  participant DB as AttendanceDB

  S->>P: abre el calendario
  P->>GW: GET /att/calendario/ausencias/alcance
  GW->>CAL: alcance(identidad)
  alt rol distinto de supervisor, gerente o admin
    CAL-->>P: 403
  else supervisor
    CAL->>E: sucursal del supervisor
    CAL-->>P: su sucursal fija, áreas y tipos
  else RRHH
    CAL-->>P: todas las sucursales, áreas, tipos y permiso de umbrales
  end
  S->>P: sucursal, departamento, vista y mes
  P->>GW: GET /att/calendario/ausencias?id_sucursal&id_departamento&desde&hasta
  GW->>CAL: consultar(filtros, identidad)
  opt supervisor pide otra sucursal
    CAL-->>P: 403 solo puede ver su sucursal
  end
  CAL->>E: personal activo de la sucursal y el área
  par consultas en paralelo
    CAL->>M: ausencias aprobadas del personal en el rango
    M->>DB: SOLICITUDES_VACACION y SOLICITUDES_LICENCIA (estado APROBADA)
  and
    CAL->>M: turnos publicados y feriados
    M->>DB: TURNOS_PUBLICADOS y FERIADOS
  and
    CAL->>M: umbrales de cobertura
    M->>DB: UMBRALES_COBERTURA
  end
  CAL->>CAL: por día y área, programados, ausentes y presentes frente al umbral
  CAL-->>P: ausencias, días con baja_cobertura y resumen
  P->>P: cuadrícula con color por tipo y advertencia en los días de baja cobertura
  S->>P: clic en un bloque
  P-->>S: colaborador, cargo, tipo y período aprobado
  opt RRHH configura umbrales
    S->>P: Umbrales de cobertura
    P->>GW: PUT /att/calendario/umbrales
    GW->>CAL: guardarUmbral
    CAL->>M: upsert por sucursal y área
    M->>DB: UMBRALES_COBERTURA
    P->>GW: vuelve a consultar el calendario
  end
```

## Notación

| Elemento | Significado |
|---|---|
| `*--` | Composición: la parte no existe sin el todo |
| `-->` | Asociación navegable |
| `..>` | Dependencia o referencia por UUID sin clave foránea («HTTP», «publica») |
| `<<enumeration>>` | Catálogo de valores fijos |
| `«derivado»` | Columna calculada por la base, no escrita por la aplicación |
| `->>` · `-->>` | Llamada · respuesta |
| `alt` · `opt` · `loop` · `par` | Alternativas · opcional · repetición · en paralelo |
| Fondo de color (`rect`) | Agrupa los pasos de una historia en el diagrama general |

## Trazabilidad con el código

| Historia | Rutas | Servicio | Modelo | Pantalla |
|---|---|---|---|---|
| KAN-50 | `routes/solicitudesVacacion.routes.js` | `solicitudesVacacion.service.js` | `solicitudesVacacion.model.js` | `features/solicitud-vacaciones` |
| KAN-51 | `routes/licencias.routes.js` | `licencias.service.js` | `licencias.model.js` | `features/licencias` |
| KAN-52 | `routes/vacaciones.routes.js` | `vacaciones.service.js` | `vacaciones.model.js` | `features/vacaciones` |
| KAN-53 | `routes/aprobaciones.routes.js`, `routes/eventos.routes.js` | `aprobaciones.service.js`, `indisponibilidad.service.js`, `eventos.service.js` | `aprobaciones.model.js`, `eventos.model.js` | `features/aprobaciones` |
| KAN-54 | `NotificationService/src/routes/notificaciones.routes.js` | `notificaciones.service.js` (ambos servicios) | `notificaciones.model.js` | `features/notificaciones` |
| KAN-55 | `routes/calendarioAusencias.routes.js` | `calendarioAusencias.service.js` | `calendarioAusencias.model.js` | `features/calendario-ausencias` |

Las reglas de negocio y del esquema están en [`db/aclaracion.md`](../../db/aclaracion.md); el SQL, en `db/init.sql` (bloques idempotentes por historia).

## Configuración

| Variable | Servicio | Para qué |
|---|---|---|
| `EMPLOYEE_SERVICE_URL` | Attendance, Notification | Empleados, supervisor, sucursales y áreas |
| `NOTIFICATION_SERVICE_URL` | Attendance | Aviso al supervisor (KAN-50) y resultado al colaborador (KAN-54) |
| `INTERVALO_AVISOS_MS` | Attendance | Cada cuánto se reintentan los avisos sin confirmar (60 000 por defecto) |
| `AREAS_PRODUCCION` · `AREAS_REPARTO` | Attendance | Códigos de área que van a Producción y Logística o a Entregas y Despachos (KAN-53) |
| `URL_PRODUCCION_LOGISTICA` · `URL_ENTREGAS_DESPACHOS` | Attendance | Endpoint REST de cada módulo; sin URL se publica solo por Pub/Sub (KAN-53) |
| `RUTA_VACACIONES` | Notification | Pantalla a la que lleva la alerta de una vacación (`/asistencia/solicitud-vacaciones`) |
| `SMTP_HOST` · `SMTP_PORT` · `SMTP_SECURE` · `SMTP_USER` · `SMTP_PASS` · `SMTP_FROM` · `PORTAL_URL` | Notification | Correo resumen y su enlace; sin `SMTP_HOST` solo se crea la alerta del portal (KAN-54) |
