#!/bin/bash
set -e

setup_service_db() {
    local db_name=$1
    local sql_file=$2

    echo "Inicializando $db_name..."
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        SELECT 'CREATE DATABASE "$db_name"' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db_name')\gexec
EOSQL

    if [ -f "$sql_file" ]; then
        echo "Ejecutando $sql_file en $db_name..."
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db_name" -f "$sql_file"
    fi
}

setup_service_db "AuthDB" "/init-scripts/auth/init.sql"
setup_service_db "EmployeeDB" "/init-scripts/employee/init.sql"
setup_service_db "RecruitmentDB" "/init-scripts/recruitment/init.sql"
setup_service_db "AttendanceDB" "/init-scripts/attendance/init.sql"
setup_service_db "CompensationDB" "/init-scripts/compensation/init.sql"
setup_service_db "PerformanceDB" "/init-scripts/performance/init.sql"
setup_service_db "NotificationDB" "/init-scripts/notification/init.sql"