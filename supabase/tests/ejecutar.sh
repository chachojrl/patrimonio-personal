#!/usr/bin/env bash
# Prueba las migraciones de supabase/migrations en un PostgreSQL desechable (16 o superior),
# con lo mínimo de Supabase simulado: privacidad entre cuentas, cuenta compartida,
# aportaciones automáticas y borrados. NO usar contra la base de datos de Supabase.
#
# Uso (con un superusuario de un PostgreSQL de pruebas):
#   PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=... ./supabase/tests/ejecutar.sh
#
# Crea y borra la base de datos «pruebas_bd» y los roles anon, authenticated y owner_sim.
set -euo pipefail
cd "$(dirname "$0")/../.."
T=supabase/tests
M=supabase/migrations
total=0

su_psql() { PGOPTIONS='-c client_min_messages=warning' psql -X -q -v ON_ERROR_STOP=1 "$@"; }
# Propietario de las tablas: sin superusuario ni BYPASSRLS (como el peor caso en Supabase)
ow_psql() { PGPASSWORD=pruebas psql -X -q -t -v ON_ERROR_STOP=1 -U owner_sim -d pruebas_bd "$@"; }

preparar() {
  su_psql -d postgres -c "drop database if exists pruebas_bd" \
    -c "drop role if exists owner_sim" -c "drop role if exists authenticated" -c "drop role if exists anon" \
    -c "create database pruebas_bd" >/dev/null
  su_psql -d pruebas_bd -f "$T/simulacion_supabase.sql" >/dev/null
  ow_psql -c "select 1" >/dev/null # el propietario puede conectarse
}

migrar() {
  for f in "$@"; do
    if ! PGOPTIONS='-c client_min_messages=warning' ow_psql -f "$M/$f" >/dev/null; then
      echo "  ✗ falla la migración $f"; exit 1
    fi
  done
}

ejecutar() {
  local f=$1 out n
  if ! out=$(PGOPTIONS='-c client_min_messages=notice' ow_psql -f "$T/$f" 2>&1); then
    echo "$out" | sed 's/^psql:[^:]*:[0-9]*: //' | grep -v '^\s*$' | tail -15
    echo "  ✗ $f"; exit 1
  fi
  n=$(grep -c 'NOTICE:  OK' <<<"$out" || true)
  total=$((total + n))
  echo "  ✓ $f ($n comprobaciones)"
}

cargar_datos_previos() {
  ow_psql -f "$T/datos_previos.sql" >/dev/null
}

# Migraciones a partir de la 0005 (las que trabajan con cuentas), en orden
posteriores() { ls "$M" | sort | awk -F_ '$1 >= "0005"'; }

echo "▶ 1. Como en una instalación real: 0001-0004, datos, 0005 (dos veces) y 0006; luego la 0007 con su limpieza"
preparar
migrar 0001_esquema.sql 0002_usuarios_nuevos_en_blanco.sql 0003_fijos_presupuestos.sql 0004_deudas.sql
cargar_datos_previos
migrar 0005_cuentas_compartidas.sql 0005_cuentas_compartidas.sql 0006_borrar_cuenta_compartida.sql
ow_psql -f "$T/ayudas.sql" >/dev/null
ejecutar 01_cuentas_compartidas.sql
ejecutar 03_borrar_mes.sql

echo "▶ 2. Todas las migraciones: borrado de cuenta, tiempo real, historial, compra y viajes"
preparar
migrar 0001_esquema.sql 0002_usuarios_nuevos_en_blanco.sql 0003_fijos_presupuestos.sql 0004_deudas.sql
cargar_datos_previos
# shellcheck disable=SC2046
migrar $(posteriores)
migrar 0008_tiempo_real.sql 0009_historial_compra_viajes.sql 0010_clasificacion_reparto.sql # otra vez: se pueden repetir
ow_psql -f "$T/ayudas.sql" >/dev/null
ejecutar 01_cuentas_compartidas.sql
ejecutar 02_borrar_cuenta.sql
ejecutar 04_tiempo_real.sql
ejecutar 05_historial_compra_viajes.sql
ejecutar 06_clasificacion_reparto.sql

# La copia semanal tiene que incluir TODAS las tablas de datos (si añades una, añádela allí)
lista_copia=$(grep -m1 -E '^\s*for t in config ' .github/workflows/backup.yml)
faltan=""
for t in $(ow_psql -A -c "select tablename from pg_tables where schemaname = 'public' and tablename <> 'app_owner' order by 1"); do
  grep -qw "$t" <<<"$lista_copia" || faltan="$faltan $t"
done
if [ -n "$faltan" ]; then echo "  ✗ la copia de seguridad (backup.yml) no incluye:$faltan"; exit 1; fi
echo "  ✓ la copia de seguridad incluye todas las tablas"

echo "▶ 3. Sin las migraciones 0003 ni 0004 (la 0005 tiene que bastarse sola)"
preparar
migrar 0001_esquema.sql 0002_usuarios_nuevos_en_blanco.sql
cargar_datos_previos
migrar 0005_cuentas_compartidas.sql
ow_psql -f "$T/ayudas.sql" >/dev/null
ejecutar 01_cuentas_compartidas.sql

su_psql -d postgres -c "drop database if exists pruebas_bd" >/dev/null
echo "✔ Todo correcto: $total comprobaciones"
