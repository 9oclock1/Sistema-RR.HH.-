-- Datos de prueba de AuthDB: una cuenta por colaborador de EmployeeService/db/seed.sql (mismos ids y correos).
-- Contraseña de todas las cuentas: rrhh123. Lista completa en CUENTAS-DE-PRUEBA.md (raíz del repositorio).
-- Los colaboradores de baja tienen la cuenta desactivada: su inicio de sesión se rechaza.
-- Se puede ejecutar varias veces: lo que ya existe no se duplica.
--   Get-Content backend/AuthService/db/seed.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d AuthDB
BEGIN;

INSERT INTO USUARIOS (id_usuario, id_empleado, correo, hash_contrasena, rol, esta_activo) VALUES
  -- Andrea Salazar Vega, Jefe de Recursos Humanos
  ('b0000000-0000-4000-8000-000000000023', 'f0000000-0000-4000-8000-000000000023', 'andrea.salazar@correo.test',
   'scrypt$12100357daafc9d52d5f29909f688d0f$fa0f0d856d3c14877cb11d6d298e6971c70fe45ed4e9d1e254b4aef2b03d1fff3572f05c7129d3eb8d9596170b8360f5b90de185c7d4a32807f102a2ecae7389', 'admin', TRUE),
  -- Marcela Quiroga Peña, Jefe de Atención al Cliente
  ('b0000000-0000-4000-8000-000000000021', 'f0000000-0000-4000-8000-000000000021', 'marcela.quiroga@correo.test',
   'scrypt$baf18fe7efbf39cfa5563f1fbce976aa$ed7bbf32ab6656e59b347b307ea5d00e058c3f823988db09698f08e6090edd9ecf8729fadca1a23b22cb037047a33e1e676624529febaf4c7cdfe96618966dc8', 'gerente', TRUE),
  -- Sofía Condori Mamani, Analista de Recursos Humanos
  ('b0000000-0000-4000-8000-000000000026', 'f0000000-0000-4000-8000-000000000026', 'sofia.condori@correo.test',
   'scrypt$c173bdc89f7d04a822e4ea87aeb3bd3d$104d7eb8ee95a4fd37e7f1b82b516738807b40816d54599f561247fa4f45370557f48b3c3e2de3ca3070290df5c116c87298407d453f36d308bb9ba93ee3031d', 'reclutador', TRUE),
  -- Jorge Mamani Condori, Jefe de Atención al Cliente
  ('b0000000-0000-4000-8000-000000000022', 'f0000000-0000-4000-8000-000000000022', 'jorge.mamani@correo.test',
   'scrypt$1c72dd872c22ac442f27f73fefcc3da1$a3a5265a5c8b33eb65ebad920f619464ab84ec16f75eef236fe42ecee8e41466c97e8a72b172ea3e0ea34c61103cbf47682dde3c85c182ae359bd45212786a42', 'supervisor', TRUE),
  -- Rosa Mendoza Ticona, Supervisor de Cajas
  ('b0000000-0000-4000-8000-000000000024', 'f0000000-0000-4000-8000-000000000024', 'rosa.mendoza@correo.test',
   'scrypt$c7fe624d0daf21e041e7bfb032110d1c$afaf0f517372da69f510e0ce594ad5ffb0c99299381653f57a59233ee67fdf9676491d9cd12bfbd95a22100ff9b84b3503a0448cac211e380e3d131c49ddb03c', 'supervisor', TRUE),
  -- Luis Vargas Apaza, Supervisor de Cajas
  ('b0000000-0000-4000-8000-000000000025', 'f0000000-0000-4000-8000-000000000025', 'luis.vargas@correo.test',
   'scrypt$fdfe1e413c352ad55ee18ae35f60f0ea$c575b9d50678a2f1cfb5503617a3053ef2e160095ef7c7bc48fa151ebb8cde996840626d62b03ec37f8dfdabbf195b8ef7c85a30977795097301a14249502bef', 'auditor', TRUE),
  -- Carlos Rojas Vargas, Cajero
  ('b0000000-0000-4000-8000-000000000031', 'f0000000-0000-4000-8000-000000000031', 'carlos.rojas@correo.test',
   'scrypt$25cb967f06410034548c255736acb4cc$b2cf2efc8c8bf1bdc3385ecdfcae21d6a1ba585256a0abed7dba1d0b4b1b7879a07a6adb5d6a5a8b13a70b7f45ce1113c0691ee68380f55c118d8ecfbeff8ef2', 'empleado', TRUE),
  -- Lucía Flores Choque, Cajero
  ('b0000000-0000-4000-8000-000000000032', 'f0000000-0000-4000-8000-000000000032', 'lucia.flores@correo.test',
   'scrypt$ba60f5d156daab90cd9a675d17869bb9$8fb23794b17863d932f04d1568807b0e5ce4f27fe79ae5ae06edecbf96cc0d8ff1d520a50f07a19b0eb60407e8155b3d5f62b99512dd10b1f6f52706b0159610', 'empleado', TRUE),
  -- Diego Quispe Mamani, Cajero
  ('b0000000-0000-4000-8000-000000000033', 'f0000000-0000-4000-8000-000000000033', 'diego.quispe@correo.test',
   'scrypt$9c89f69b31e1e333bf07882c4076e18b$174f915a7be9d6cbc4884aacc7395ac23ee9e0feb2b9d24287e7f421a911f1192d177c806ce255a2a89f8479d0a4ebdc30d3245e9ca8628f7cce94682202bdb9', 'empleado', TRUE),
  -- Paola Gutiérrez Limachi, Asesor de Atención
  ('b0000000-0000-4000-8000-000000000034', 'f0000000-0000-4000-8000-000000000034', 'paola.gutierrez@correo.test',
   'scrypt$ded3587e5ea2a9a85fdf7ebcade2cae6$5b6c4e787212c08581a60099d8fab0da8a23d98d5bac76d4be01b5457e1a85d0c8b9c33bd983da721ecf9fe3038b9f598ee84364fcb3e3b2cecbad1c45ad89e4', 'empleado', TRUE),
  -- Ana Torrez Villca, Cajero
  ('b0000000-0000-4000-8000-000000000035', 'f0000000-0000-4000-8000-000000000035', 'ana.torrez@correo.test',
   'scrypt$f31e9086c9aa357dcb790d92d14dc2a4$9be4e22f1304fc7719a434a23cad199f798d4601b79547c4f69af39c4b5dc187229a78e8e4a91d25645171818dbf2e7528d096dd6fdccb8d9303ba70c4268272', 'empleado', TRUE),
  -- Mario Fernández Cruz, Asesor de Atención; en el portal opera como Contador / Encargado de planillas
  ('b0000000-0000-4000-8000-000000000036', 'f0000000-0000-4000-8000-000000000036', 'mario.fernandez@correo.test',
   'scrypt$c42da0bc0a45d28496c1daa744d2a320$462bd51e3c84f2adf3eaf1ef1b3e61b7b85ba4526a8d8000b413eee4c15caf9cbb46ad3f18502346b2245862f4f6d282eefade53517e335731b92972f98a1c05', 'contador', TRUE),
  -- Elena Paredes Gómez, Cajero (de baja: cuenta desactivada)
  ('b0000000-0000-4000-8000-000000000037', 'f0000000-0000-4000-8000-000000000037', 'elena.paredes@correo.test',
   'scrypt$cda485cb2cd7ceaa75b0a29cb9eda13c$f778913a0ea15bbf59f965750fd5663f98196a5b2178a38aa76ddcd1db95dcc43399a5715cadb065a2b9afc53603b93c9cea7f1511a1ccc22871a094648019b0', 'empleado', FALSE),
  -- Luciano Morales Chávez, Cajero (de baja: cuenta desactivada)
  ('b0000000-0000-4000-8000-000000000741', 'f0000000-0000-4000-8000-000000000741', 'luciano.morales@correo.test',
   'scrypt$04371e22a4e02b46d26d31174cb5fbca$6fa784c081c3305beba5d69d4c88e25e821a96cdab40baac57e37ac0c7aaca0176d38c17b632f5f573fd8dacbbb5385745df6ad37ef3cbf7feed0ce94bc15aec', 'empleado', FALSE),
  -- Valeria Nina Quisbert, Asesor de Atención (de baja: cuenta desactivada)
  ('b0000000-0000-4000-8000-000000000742', 'f0000000-0000-4000-8000-000000000742', 'valeria.nina@correo.test',
   'scrypt$e7477f253ca2c38ff48bc19c01b6ed9e$28942f78dde699ad6f8db7cb1325ed4597c8577bb9896f6863e172becce00b5c01b898a7c5cd5383a4a1cd82e0c844250bbe19d4fb2c6798615fdb7c7027550f', 'empleado', FALSE),
  -- Rodrigo Apaza Calle, Cajero (de baja: cuenta desactivada)
  ('b0000000-0000-4000-8000-000000000743', 'f0000000-0000-4000-8000-000000000743', 'rodrigo.apaza@correo.test',
   'scrypt$198c30ffd8af9454ab499ed4f45047bf$de9937b7dca047b9a7591ad2b110fb64766188ced852d9db2893f6e9ebdde266af9b197924bbf9640badf8ab9307c2760c862fc293019e72698c505994f7aed7', 'empleado', FALSE)
ON CONFLICT DO NOTHING;

COMMIT;
