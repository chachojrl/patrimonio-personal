#!/usr/bin/env bash
# Comprueba que SIN iniciar sesión (solo con la clave pública anon) no se puede leer nada.
# Uso: SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=eyJ... ./scripts/comprobar-seguridad.sh
set -u
fallos=0
for t in config months incomes expenses expense_entries savings debts cuentas cuenta_miembros lista_compra viajes viaje_gastos cambios app_owner; do
  r=$(curl -s "$SUPABASE_URL/rest/v1/$t?select=*&limit=1" -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY")
  if [ "$r" = "[]" ] || echo "$r" | grep -q '"code"'; then
    echo "OK   $t → sin acceso ($(echo "$r" | head -c 80))"
  else
    echo "FALLO $t → devuelve datos: $(echo "$r" | head -c 120)"; fallos=1
  fi
done
r=$(curl -s -X POST "$SUPABASE_URL/auth/v1/signup" -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"prueba-registro@example.com","password":"Prueba-123456!"}')
if echo "$r" | grep -qi "signup.*disabled\|signups not allowed"; then echo "OK   registro de usuarios desactivado"; else echo "FALLO el registro parece activado: $(echo "$r" | head -c 120)"; fallos=1; fi
exit $fallos
