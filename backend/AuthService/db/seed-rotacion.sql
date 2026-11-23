-- Cuenta de prueba para el dashboard de rotación de personal (RF-75, KAN-95): Carla Mamani Condori, jefa de la
-- sucursal Calacoto en backend/EmployeeService/db/seed-rotacion.sql, con rol supervisor (ve solo Calacoto).
-- Contraseña: rrhh123. Requiere seed.sql de AuthService. Se puede ejecutar varias veces.
--   cat backend/AuthService/db/seed-rotacion.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d AuthDB
BEGIN;

INSERT INTO USUARIOS (id_usuario, id_empleado, correo, hash_contrasena, rol, esta_activo) VALUES
  -- Carla Mamani Condori, Jefe de Atención al Cliente (Calacoto)
  ('b0000000-0000-4000-8095-000000000100', 'f0000000-0000-4000-8095-000000000100', 'carla.mamani.100@correo.test',
   'scrypt$4ba06a4cb9c407e03bc3e7ca4ae97e2e$0e0c82a2e7b7a006926902de4f7fc325d510b73d1884a687b8883dca2f1955d4c29b05edeca01b5aaef17befd693cd09b9656a3e1e106ca5fbdeefed8927ebf1', 'supervisor', TRUE)
ON CONFLICT DO NOTHING;

COMMIT;
