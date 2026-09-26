/**
 * Automated Test Suite: RF-09 Applicant Registration Acceptance Criteria
 *
 * Covers all 4 Acceptance Criteria and error boundary scenarios:
 *  - AC 1: Valid registration saves applicant info & associates with job opening
 *  - AC 2: Duplicate ID registration for same opening is flagged & no 2nd record created
 *  - AC 3: Missing required fields prevent registration and indicate missing data
 *  - AC 4: Recruiter views job opening and gets applicant list with application dates
 */

const { Pool } = require("pg");

const API_BASE =
  process.env.API_BASE || `http://localhost:${process.env.PORT || 3003}`;
const DB_URL =
  process.env.DATABASE_URL ||
  "postgres://adminRRHH:sistemaRRHH12@postgres:5432/RecruitmentDB";

const pool = new Pool({ connectionString: DB_URL });

// Seed opening IDs
const OPENING_ACTIVE_1 = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"; // Full Stack Senior
const OPENING_ACTIVE_2 = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"; // Analista Talento
const OPENING_INACTIVE = "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33"; // UI/UX Inactiva
const NON_EXISTENT_UUID = "99999999-9999-9999-9999-999999999999";

// Test counters
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const results = [];

function recordResult(criterion, testName, passed, details) {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     Details:`, details);
  }
  results.push({ criterion, testName, passed, details });
}

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  let body = null;
  try {
    body = await response.json();
  } catch (e) {
    body = null;
  }
  return { status: response.status, body };
}

async function cleanTestData() {
  console.log("\n🧹 Cleaning existing test applicant data from DB...");
  await pool.query("DELETE FROM POSTULACIONES;");
  await pool.query("DELETE FROM POSTULANTES;");
  console.log("   Done. Ready to run tests.");
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("🧪 RUNNING ACCEPTANCE CRITERIA & ERROR BOUNDARY TESTS (RF-09)");
  console.log("================================================================================\n");

  await cleanTestData();

  // ============================================================================
  // CRITERION 1: Happy Path Registration & Job Opening Association
  // ============================================================================
  console.log("\n--- CRITERION 1: Save Applicant Information & Associate with Job Opening ---");

  // Test 1.1: Register valid applicant
  const applicant1 = {
    id_convocatoria: OPENING_ACTIVE_1,
    numero_documento: "87654321",
    nombres: "Carlos Alberto",
    apellidos: "Gómez Pérez",
    correo_electronico: "carlos.gomez@testempresa.com",
    telefono_contacto: "+591 71234567",
    direccion_residencia: "Av. 6 de Agosto #2450, Sopocachi",
    ciudad: "La Paz",
  };

  const res1_1 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(applicant1),
  });

  const pass1_1 =
    res1_1.status === 201 &&
    res1_1.body?.success === true &&
    res1_1.body?.data?.postulante?.numero_documento === applicant1.numero_documento &&
    res1_1.body?.data?.postulacion?.id_convocatoria === OPENING_ACTIVE_1 &&
    !!res1_1.body?.data?.postulacion?.fecha_postulacion;

  recordResult(
    "Criterion 1",
    "1.1 Successful registration with valid data (HTTP 201 + association created)",
    pass1_1,
    res1_1
  );

  // Test 1.2: Verify DB persistence
  const dbCheck1 = await pool.query(
    `SELECT p.id_postulante, p.numero_documento, p.nombres, p.apellidos, 
            pos.id_postulacion, pos.id_convocatoria, pos.id_etapa, pos.fecha_postulacion
     FROM POSTULANTES p
     JOIN POSTULACIONES pos ON pos.id_postulante = p.id_postulante
     WHERE p.numero_documento = $1 AND pos.id_convocatoria = $2;`,
    [applicant1.numero_documento, OPENING_ACTIVE_1]
  );

  const pass1_2 =
    dbCheck1.rowCount === 1 &&
    dbCheck1.rows[0].numero_documento === applicant1.numero_documento &&
    dbCheck1.rows[0].id_convocatoria === OPENING_ACTIVE_1 &&
    dbCheck1.rows[0].id_etapa === 1;

  recordResult(
    "Criterion 1",
    "1.2 Verify persistence in DB (POSTULANTES and POSTULACIONES records match)",
    pass1_2,
    dbCheck1.rows[0]
  );

  // Test 1.3: Error - Register to inactive job opening
  const applicantInactive = {
    id_convocatoria: OPENING_INACTIVE,
    numero_documento: "55443322",
    nombres: "Mariana",
    apellidos: "López Silva",
    correo_electronico: "mariana.lopez@testempresa.com",
    telefono_contacto: "72345678",
  };

  const res1_3 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(applicantInactive),
  });

  const pass1_3 =
    res1_3.status === 400 &&
    res1_3.body?.success === false &&
    res1_3.body?.message?.includes("activa");

  recordResult(
    "Criterion 1 (Error Handling)",
    "1.3 Attempt to register for inactive job opening is rejected (HTTP 400)",
    pass1_3,
    res1_3
  );

  // Test 1.4: Error - Register to non-existent job opening UUID
  const applicantNotFound = {
    id_convocatoria: NON_EXISTENT_UUID,
    numero_documento: "44332211",
    nombres: "Rodrigo",
    apellidos: "Chavez",
    correo_electronico: "rodrigo.chavez@testempresa.com",
    telefono_contacto: "73456789",
  };

  const res1_4 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(applicantNotFound),
  });

  const pass1_4 =
    res1_4.status === 404 &&
    res1_4.body?.success === false &&
    res1_4.body?.message?.includes("no existe");

  recordResult(
    "Criterion 1 (Error Handling)",
    "1.4 Attempt to register for non-existent job opening is rejected (HTTP 404)",
    pass1_4,
    res1_4
  );

  // Test 1.5: Register existing applicant to a SECOND different job opening
  const applicant1_opening2 = {
    id_convocatoria: OPENING_ACTIVE_2,
    numero_documento: applicant1.numero_documento, // Same document
    nombres: applicant1.nombres,
    apellidos: applicant1.apellidos,
    correo_electronico: applicant1.correo_electronico,
    telefono_contacto: applicant1.telefono_contacto,
  };

  const res1_5 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(applicant1_opening2),
  });

  const pass1_5 =
    res1_5.status === 201 &&
    res1_5.body?.success === true &&
    res1_5.body?.data?.postulacion?.id_convocatoria === OPENING_ACTIVE_2;

  recordResult(
    "Criterion 1",
    "1.5 Register same applicant to a DIFFERENT active opening succeeds (reuses applicant record)",
    pass1_5,
    res1_5
  );

  // ============================================================================
  // CRITERION 2: Duplicate ID Prevention for Same Job Opening
  // ============================================================================
  console.log("\n--- CRITERION 2: Duplicate ID Detection for Same Job Opening ---");

  // Test 2.1: Duplicate ID for same opening
  const duplicateAttempt = {
    id_convocatoria: OPENING_ACTIVE_1,
    numero_documento: applicant1.numero_documento, // "87654321" already registered in OPENING_ACTIVE_1
    nombres: "Carlos Alberto Duplicate",
    apellidos: "Gómez Pérez",
    correo_electronico: "carlos.gomez@testempresa.com",
    telefono_contacto: "+591 71234567",
  };

  const res2_1 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(duplicateAttempt),
  });

  const pass2_1 =
    res2_1.status === 409 &&
    res2_1.body?.success === false &&
    res2_1.body?.message?.includes(applicant1.numero_documento) &&
    res2_1.body?.message?.includes("ya se encuentra registrado");

  recordResult(
    "Criterion 2",
    "2.1 Attempt to register duplicate ID for same opening is blocked (HTTP 409 Conflict)",
    pass2_1,
    res2_1
  );

  // Test 2.2: Verify no second record was created in DB
  const dbCheck2 = await pool.query(
    `SELECT COUNT(*) AS total_postulaciones
     FROM POSTULACIONES pos
     JOIN POSTULANTES p ON p.id_postulante = pos.id_postulante
     WHERE p.numero_documento = $1 AND pos.id_convocatoria = $2;`,
    [applicant1.numero_documento, OPENING_ACTIVE_1]
  );

  const pass2_2 = parseInt(dbCheck2.rows[0].total_postulaciones, 10) === 1;

  recordResult(
    "Criterion 2",
    "2.2 DB verification: exactly 1 application record exists (no duplicate record created)",
    pass2_2,
    `Total records found: ${dbCheck2.rows[0].total_postulaciones}`
  );

  // Test 2.3: Duplicate with padded whitespace around document
  const duplicateWithSpaces = {
    id_convocatoria: OPENING_ACTIVE_1,
    numero_documento: `  ${applicant1.numero_documento}  `,
    nombres: "Carlos Alberto",
    apellidos: "Gómez",
    correo_electronico: "carlos.gomez@testempresa.com",
    telefono_contacto: "71234567",
  };

  const res2_3 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(duplicateWithSpaces),
  });

  const pass2_3 =
    res2_3.status === 409 &&
    res2_3.body?.success === false &&
    res2_3.body?.message?.includes("ya se encuentra registrado");

  recordResult(
    "Criterion 2 (Edge Case)",
    "2.3 Duplicate document with whitespace padding is trimmed and detected as duplicate (HTTP 409)",
    pass2_3,
    res2_3
  );

  // Test 2.4: Conflict - Same email with a DIFFERENT document number
  const conflictEmail = {
    id_convocatoria: OPENING_ACTIVE_1,
    numero_documento: "99887766", // Different doc
    nombres: "Otro Postulante",
    apellidos: "Test",
    correo_electronico: applicant1.correo_electronico, // Same email as applicant1
    telefono_contacto: "78901234",
  };

  const res2_4 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(conflictEmail),
  });

  const pass2_4 =
    res2_4.status === 409 &&
    res2_4.body?.success === false &&
    res2_4.body?.message?.includes("correo electrónico");

  recordResult(
    "Criterion 2 (Data Integrity)",
    "2.4 Conflict when using an existing email with a different ID number (HTTP 409)",
    pass2_4,
    res2_4
  );

  // ============================================================================
  // CRITERION 3: Missing Required Fields Validation
  // ============================================================================
  console.log("\n--- CRITERION 3: Missing Required Fields Validation ---");

  // Test 3.1: Completely empty payload
  const res3_1 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify({}),
  });

  const requiredFieldKeys = [
    "id_convocatoria",
    "numero_documento",
    "nombres",
    "apellidos",
    "correo_electronico",
    "telefono_contacto",
  ];

  const returnedErrorFields = (res3_1.body?.errors || []).map((e) => e.field);
  const allRequiredIndicated = requiredFieldKeys.every((f) =>
    returnedErrorFields.includes(f)
  );

  const pass3_1 =
    res3_1.status === 400 &&
    res3_1.body?.success === false &&
    allRequiredIndicated;

  recordResult(
    "Criterion 3",
    "3.1 Empty registration payload blocks submission and indicates ALL 6 missing fields",
    pass3_1,
    { returnedErrorFields }
  );

  // Test 3.2: Missing numero_documento
  const payloadNoDoc = {
    id_convocatoria: OPENING_ACTIVE_1,
    numero_documento: "",
    nombres: "Ana",
    apellidos: "Condori",
    correo_electronico: "ana.condori@test.com",
    telefono_contacto: "72345678",
  };
  const res3_2 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(payloadNoDoc),
  });
  const pass3_2 =
    res3_2.status === 400 &&
    res3_2.body?.errors?.some((e) => e.field === "numero_documento");
  recordResult(
    "Criterion 3",
    "3.2 Missing numero_documento prevents registration and indicates missing field",
    pass3_2,
    res3_2
  );

  // Test 3.3: Missing nombres (whitespace string)
  const payloadNoName = {
    id_convocatoria: OPENING_ACTIVE_1,
    numero_documento: "76543210",
    nombres: "   ",
    apellidos: "Condori",
    correo_electronico: "ana.condori@test.com",
    telefono_contacto: "72345678",
  };
  const res3_3 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(payloadNoName),
  });
  const pass3_3 =
    res3_3.status === 400 &&
    res3_3.body?.errors?.some((e) => e.field === "nombres");
  recordResult(
    "Criterion 3",
    "3.3 Whitespace-only nombres prevents registration and indicates missing field",
    pass3_3,
    res3_3
  );

  // Test 3.4: Missing apellidos
  const payloadNoSurname = {
    id_convocatoria: OPENING_ACTIVE_1,
    numero_documento: "76543210",
    nombres: "Ana",
    apellidos: "",
    correo_electronico: "ana.condori@test.com",
    telefono_contacto: "72345678",
  };
  const res3_4 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(payloadNoSurname),
  });
  const pass3_4 =
    res3_4.status === 400 &&
    res3_4.body?.errors?.some((e) => e.field === "apellidos");
  recordResult(
    "Criterion 3",
    "3.4 Missing apellidos prevents registration and indicates missing field",
    pass3_4,
    res3_4
  );

  // Test 3.5: Missing correo_electronico
  const payloadNoEmail = {
    id_convocatoria: OPENING_ACTIVE_1,
    numero_documento: "76543210",
    nombres: "Ana",
    apellidos: "Condori",
    correo_electronico: "",
    telefono_contacto: "72345678",
  };
  const res3_5 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(payloadNoEmail),
  });
  const pass3_5 =
    res3_5.status === 400 &&
    res3_5.body?.errors?.some((e) => e.field === "correo_electronico");
  recordResult(
    "Criterion 3",
    "3.5 Missing correo_electronico prevents registration and indicates missing field",
    pass3_5,
    res3_5
  );

  // Test 3.6: Missing telefono_contacto
  const payloadNoPhone = {
    id_convocatoria: OPENING_ACTIVE_1,
    numero_documento: "76543210",
    nombres: "Ana",
    apellidos: "Condori",
    correo_electronico: "ana.condori@test.com",
    telefono_contacto: "",
  };
  const res3_6 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(payloadNoPhone),
  });
  const pass3_6 =
    res3_6.status === 400 &&
    res3_6.body?.errors?.some((e) => e.field === "telefono_contacto");
  recordResult(
    "Criterion 3",
    "3.6 Missing telefono_contacto prevents registration and indicates missing field",
    pass3_6,
    res3_6
  );

  // Test 3.7: Missing id_convocatoria
  const payloadNoOpening = {
    id_convocatoria: "",
    numero_documento: "76543210",
    nombres: "Ana",
    apellidos: "Condori",
    correo_electronico: "ana.condori@test.com",
    telefono_contacto: "72345678",
  };
  const res3_7 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(payloadNoOpening),
  });
  const pass3_7 =
    res3_7.status === 400 &&
    res3_7.body?.errors?.some((e) => e.field === "id_convocatoria");
  recordResult(
    "Criterion 3",
    "3.7 Missing id_convocatoria prevents registration and indicates missing field",
    pass3_7,
    res3_7
  );

  // Test 3.8: Malformed email format
  const payloadBadEmail = {
    id_convocatoria: OPENING_ACTIVE_1,
    numero_documento: "76543210",
    nombres: "Ana",
    apellidos: "Condori",
    correo_electronico: "not-an-email-address",
    telefono_contacto: "72345678",
  };
  const res3_8 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(payloadBadEmail),
  });
  const pass3_8 =
    res3_8.status === 400 &&
    res3_8.body?.errors?.some((e) => e.field === "correo_electronico");
  recordResult(
    "Criterion 3 (Format Validation)",
    "3.8 Invalid email format is rejected and indicates field error",
    pass3_8,
    res3_8
  );

  // Test 3.9: Document number too short (< 5 chars)
  const payloadShortDoc = {
    id_convocatoria: OPENING_ACTIVE_1,
    numero_documento: "123", // too short
    nombres: "Ana",
    apellidos: "Condori",
    correo_electronico: "ana.condori@test.com",
    telefono_contacto: "72345678",
  };
  const res3_9 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(payloadShortDoc),
  });
  const pass3_9 =
    res3_9.status === 400 &&
    res3_9.body?.errors?.some((e) => e.field === "numero_documento");
  recordResult(
    "Criterion 3 (Format Validation)",
    "3.9 Document number shorter than 5 chars is rejected and indicates field error",
    pass3_9,
    res3_9
  );

  // Test 3.10: Phone number too short (< 7 digits)
  const payloadShortPhone = {
    id_convocatoria: OPENING_ACTIVE_1,
    numero_documento: "76543210",
    nombres: "Ana",
    apellidos: "Condori",
    correo_electronico: "ana.condori@test.com",
    telefono_contacto: "123", // too short
  };
  const res3_10 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(payloadShortPhone),
  });
  const pass3_10 =
    res3_10.status === 400 &&
    res3_10.body?.errors?.some((e) => e.field === "telefono_contacto");
  recordResult(
    "Criterion 3 (Format Validation)",
    "3.10 Phone number shorter than 7 digits is rejected and indicates field error",
    pass3_10,
    res3_10
  );

  // Test 3.11: Malformed UUID for id_convocatoria
  const payloadMalformedUuid = {
    id_convocatoria: "not-a-valid-uuid",
    numero_documento: "76543210",
    nombres: "Ana",
    apellidos: "Condori",
    correo_electronico: "ana.condori@test.com",
    telefono_contacto: "72345678",
  };
  const res3_11 = await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(payloadMalformedUuid),
  });
  const pass3_11 =
    res3_11.status === 400 &&
    res3_11.body?.errors?.some((e) => e.field === "id_convocatoria");
  recordResult(
    "Criterion 3 (Format Validation)",
    "3.11 Malformed id_convocatoria string returns clean HTTP 400 error instead of server crash",
    pass3_11,
    res3_11
  );

  // ============================================================================
  // CRITERION 4: Recruiter Views Job Opening & Sees Applicants with Dates
  // ============================================================================
  console.log("\n--- CRITERION 4: Recruiter Views Job Opening & Associated Applicants ---");

  // First, register a second applicant for OPENING_ACTIVE_1 to test listing multiple applicants
  const applicant2 = {
    id_convocatoria: OPENING_ACTIVE_1,
    numero_documento: "65432109",
    nombres: "Beatriz Elena",
    apellidos: "Vargas Flores",
    correo_electronico: "beatriz.vargas@testempresa.com",
    telefono_contacto: "76543210",
    direccion_residencia: "Calle Loayza #500",
    ciudad: "La Paz",
  };

  await apiRequest("/applicants/register", {
    method: "POST",
    body: JSON.stringify(applicant2),
  });

  // Test 4.1: Recruiter queries applicants for OPENING_ACTIVE_1
  const res4_1 = await apiRequest(`/applicants/by-opening/${OPENING_ACTIVE_1}`);

  const applicantsList = res4_1.body?.data?.postulantes || [];
  const pass4_1 =
    res4_1.status === 200 &&
    res4_1.body?.success === true &&
    applicantsList.length === 2 &&
    res4_1.body?.data?.convocatoria?.id_convocatoria === OPENING_ACTIVE_1;

  recordResult(
    "Criterion 4",
    "4.1 Recruiter retrieves list of applicants associated with the job opening (HTTP 200)",
    pass4_1,
    { count: applicantsList.length, total: res4_1.body?.data?.total_postulantes }
  );

  // Test 4.2: Verify every applicant in the list has an application date (fecha_postulacion)
  const allHaveDates = applicantsList.every(
    (app) => !!app.fecha_postulacion && !isNaN(Date.parse(app.fecha_postulacion))
  );
  const allHaveRequiredFields = applicantsList.every(
    (app) =>
      !!app.numero_documento &&
      !!app.nombres &&
      !!app.apellidos &&
      !!app.correo_electronico &&
      !!app.telefono_contacto
  );

  const pass4_2 = allHaveDates && allHaveRequiredFields;

  recordResult(
    "Criterion 4",
    "4.2 Each applicant record includes valid application date (fecha_postulacion) and complete details",
    pass4_2,
    applicantsList.map((a) => ({
      doc: a.numero_documento,
      name: `${a.nombres} ${a.apellidos}`,
      fecha: a.fecha_postulacion,
      etapa: a.nombre_etapa,
    }))
  );

  // Test 4.3: Verify sorting: most recent application first
  const date0 = new Date(applicantsList[0].fecha_postulacion).getTime();
  const date1 = new Date(applicantsList[1].fecha_postulacion).getTime();
  const pass4_3 = date0 >= date1;

  recordResult(
    "Criterion 4",
    "4.3 Applicants are ordered in descending chronological order (most recent first)",
    pass4_3,
    { firstDate: applicantsList[0]?.fecha_postulacion, secondDate: applicantsList[1]?.fecha_postulacion }
  );

  // Test 4.4: Recruiter queries job opening with zero applicants
  const res4_4 = await apiRequest(`/applicants/by-opening/${OPENING_INACTIVE}`);
  const pass4_4 =
    res4_4.status === 200 &&
    res4_4.body?.success === true &&
    res4_4.body?.data?.total_postulantes === 0 &&
    Array.isArray(res4_4.body?.data?.postulantes) &&
    res4_4.body?.data?.postulantes.length === 0;

  recordResult(
    "Criterion 4",
    "4.4 Opening with zero applicants returns empty list cleanly (HTTP 200, count 0)",
    pass4_4,
    res4_4
  );

  // Test 4.5: Recruiter queries non-existent job opening UUID
  const res4_5 = await apiRequest(`/applicants/by-opening/${NON_EXISTENT_UUID}`);
  const pass4_5 =
    res4_5.status === 404 &&
    res4_5.body?.success === false &&
    res4_5.body?.message?.includes("no existe");

  recordResult(
    "Criterion 4 (Error Handling)",
    "4.5 Querying non-existent job opening returns HTTP 404 cleanly",
    pass4_5,
    res4_5
  );

  // Test 4.6: Recruiter queries with invalid UUID format
  const res4_6 = await apiRequest(`/applicants/by-opening/not-a-valid-uuid`);
  const pass4_6 =
    res4_6.status === 400 &&
    res4_6.body?.success === false &&
    res4_6.body?.message?.includes("UUID");

  recordResult(
    "Criterion 4 (Error Handling)",
    "4.6 Querying with invalid UUID string returns HTTP 400 cleanly",
    pass4_6,
    res4_6
  );

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("\n================================================================================");
  console.log("📊 TEST EXECUTION SUMMARY");
  console.log("================================================================================");
  console.log(`Total Tests Run: ${totalTests}`);
  console.log(`Passed:          ${passedTests} (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log(`Failed:          ${failedTests}`);
  console.log("================================================================================\n");

  await pool.end();

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Fatal error during test run:", err);
  pool.end();
  process.exit(1);
});
