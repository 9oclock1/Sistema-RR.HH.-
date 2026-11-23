# Cuentas de prueba

Cuentas para el inicio de sesión real del portal (AuthService). Hay una por cada colaborador de los datos de ejemplo de EmployeeService, con los mismos correos.

**Contraseña de todas las cuentas: `rrhh123`**

## Cómo iniciar sesión

Al pie de la barra lateral, active **Inicio de sesión real** e ingrese el correo y la contraseña. Mientras la sesión está abierta, el rol y el usuario de prueba quedan fijos en los de la cuenta; al desactivarlo vuelven los de prueba.

Por ahora **Mis boletas de pago** y **Rotación de personal** exigen sesión real. El resto del portal funciona igual con o sin sesión.

## Cuentas

| Correo | Colaborador | Cargo | Rol | Cuenta |
|---|---|---|---|---|
| `andrea.salazar@correo.test` | Andrea Salazar Vega | Jefe de Recursos Humanos | `admin` | Activa |
| `marcela.quiroga@correo.test` | Marcela Quiroga Peña | Jefe de Atención al Cliente | `gerente` | Activa |
| `sofia.condori@correo.test` | Sofía Condori Mamani | Analista de Recursos Humanos | `reclutador` | Activa |
| `jorge.mamani@correo.test` | Jorge Mamani Condori | Jefe de Atención al Cliente | `supervisor` | Activa |
| `rosa.mendoza@correo.test` | Rosa Mendoza Ticona | Supervisor de Cajas | `supervisor` | Activa |
| `luis.vargas@correo.test` | Luis Vargas Apaza | Supervisor de Cajas | `auditor` | Activa |
| `carlos.rojas@correo.test` | Carlos Rojas Vargas | Cajero | `empleado` | Activa |
| `lucia.flores@correo.test` | Lucía Flores Choque | Cajero | `empleado` | Activa |
| `diego.quispe@correo.test` | Diego Quispe Mamani | Cajero | `empleado` | Activa |
| `paola.gutierrez@correo.test` | Paola Gutiérrez Limachi | Asesor de Atención | `empleado` | Activa |
| `ana.torrez@correo.test` | Ana Torrez Villca | Cajero | `empleado` | Activa |
| `mario.fernandez@correo.test` | Mario Fernández Cruz | Asesor de Atención | `empleado` | Activa |
| `elena.paredes@correo.test` | Elena Paredes Gómez | Cajero | `empleado` | Desactivada (de baja) |
| `luciano.morales@correo.test` | Luciano Morales Chávez | Cajero | `empleado` | Desactivada (de baja) |
| `valeria.nina@correo.test` | Valeria Nina Quisbert | Asesor de Atención | `empleado` | Desactivada (de baja) |
| `rodrigo.apaza@correo.test` | Rodrigo Apaza Calle | Cajero | `empleado` | Desactivada (de baja) |
| `carla.mamani.100@correo.test` | Carla Mamani Condori (Calacoto) | Jefe de Atención al Cliente | `supervisor` | Activa (solo con los datos de rotación) |

Los colaboradores de baja tienen la cuenta desactivada: el inicio de sesión se rechaza.

Roles: `admin` (Administrador de RRHH, ve todo), `gerente` (Gerente de talento), `reclutador` (Encargado de reclutamiento), `supervisor` (Supervisor de área), `empleado` y `auditor` (Auditor de TI). Los roles incluyen los permisos de los que están debajo: `admin` ve también lo de `gerente` y `reclutador`, y así hacia abajo.

Para probar Mis boletas de pago: `ana.torrez@correo.test` o `carlos.rojas@correo.test` (cada uno ve solo las suyas); `andrea.salazar@correo.test` (RRHH) puede abrir la de cualquiera.

Para probar Rotación de personal (Dashboards): `marcela.quiroga@correo.test` (gerente) o `andrea.salazar@correo.test` (admin) ven toda la cadena y filtran por sucursal; `carla.mamani.100@correo.test` (Calacoto), `jorge.mamani@correo.test` (Miraflores) o `rosa.mendoza@correo.test` (Sopocachi) ven solo su sucursal; un `empleado` no tiene acceso. La cuenta de Carla y los datos del dashboard se cargan con los `seed-rotacion.sql` (paso 3).

## Cargar las cuentas

Las cuentas están en `backend/AuthService/db/seed.sql`; la tabla, en `backend/AuthService/db/init.sql`, que solo se ejecuta con un volumen nuevo de PostgreSQL.

1. Volumen nuevo (borra los datos de todas las bases): `docker compose down -v` y `docker compose up -d --build`.
2. Datos de ejemplo, en este orden:
   ```powershell
   Get-Content backend/EmployeeService/db/seed.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d EmployeeDB
   Get-Content backend/AuthService/db/seed.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d AuthDB
   Get-Content backend/CompensationService/db/seed.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d CompensationDB
   ```
3. Datos del dashboard de rotación (opcional), después de los anteriores y en este orden:
   ```powershell
   Get-Content backend/EmployeeService/db/seed-rotacion.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d EmployeeDB
   Get-Content backend/AuthService/db/seed-rotacion.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d AuthDB
   Get-Content backend/CompensationService/db/seed-rotacion.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d CompensationDB
   ```
4. `JWT_SECRET` debe tener el mismo valor en `backend/AuthService/.env` y `backend/CompensationService/.env` (en los `.env.example`: `secretWord`). Después de cambiarlo: `docker compose up -d auth-service compensation-service`.
