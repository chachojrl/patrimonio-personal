# Presupuesto personal

Aplicación web privada que replica mi Excel de presupuesto mensual (hojas por mes, Historial,
Resumen anual e Índice) **y sus macros**. La uso desde el móvil, la tablet y el portátil, y solo
yo puedo ver los datos.

- **Frontend:** React + TypeScript + Vite + Tailwind + Recharts. Se instala en el móvil (PWA).
- **Datos y login:** Supabase (Postgres + Auth + Row Level Security), plan gratuito.
- **Hosting:** GitHub Pages, desplegado con GitHub Actions.
- **Cálculos:** módulo puro `src/lib/calculos.ts`, en céntimos enteros, con tests (`npm test`).

> **¿Es privado si GitHub Pages es público?** Sí. En GitHub Pages solo se publica el *código* de la
> app (HTML/JS), que no contiene ningún dato ni secreto. Los datos están en Supabase y solo se
> pueden leer tras iniciar sesión con **tu** usuario. Los registros están desactivados y cada tabla
> tiene reglas RLS que solo dejan pasar al email de la tabla `app_owner`. Cualquier otra persona
> que abra la URL solo verá la pantalla de login.

---

## Puesta en marcha (unos 20 minutos)

### 1. Crear el proyecto en Supabase

1. Entra en <https://supabase.com>, crea una cuenta y un proyecto nuevo (región *Frankfurt*, por
   ejemplo). Guarda la contraseña de la base de datos en tu gestor de contraseñas.
2. Ve a **SQL Editor → New query**, pega el contenido de
   [`supabase/migrations/0001_esquema.sql`](supabase/migrations/0001_esquema.sql) y pulsa **Run**.
3. En otra consulta, autoriza tu email (cámbialo por el tuyo):
   ```sql
   insert into public.app_owner (email) values ('tu-email@ejemplo.com');
   ```
4. **Desactiva los registros:** *Authentication → Sign In / Providers*: desactiva
   **Allow new users to sign up**. Deja activado el proveedor *Email*.
5. **Crea tu usuario:** *Authentication → Users → Add user → Create new user*, con tu email y una
   contraseña larga. Marca **Auto Confirm User**.
6. Copia los datos de conexión desde *Project Settings → API* (o *Data API* / *API Keys*):
   - **Project URL**, del tipo `https://xxxx.supabase.co`.
   - **anon / publishable key**. Es pública por diseño: protegida por RLS.
   - La **service_role / secret key** solo hace falta para las copias automáticas (paso 3.4).
     **Nunca** la pongas en el frontend.

### 2. Subir el código a GitHub

1. Crea un repositorio, por ejemplo `presupuesto`. Con una cuenta gratuita de GitHub, Pages
   requiere que el repositorio sea **público**. No pasa nada: no contiene datos ni claves privadas.
   Con GitHub Pro puede ser privado.
2. Sube este código:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/presupuesto.git
   git push -u origin main
   ```

### 3. Configurar GitHub

1. *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
2. *Settings → Secrets and variables → Actions → **Variables*** → *New repository variable*:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon / publishable key
3. *Actions → "Tests y despliegue en GitHub Pages" → Run workflow* (o haz cualquier push).
   Cuando termine, la app estará en `https://TU_USUARIO.github.io/presupuesto/`.
4. (Recomendado) Copia semanal cifrada y mantener Supabase despierto. En *Secrets*, añade:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role / secret key
   - `BACKUP_PASSPHRASE` = una frase larga que guardes en tu gestor de contraseñas
5. En Supabase, en *Authentication → URL Configuration*, pon como **Site URL** la dirección de tu
   app de GitHub Pages.

### 4. Primer uso

1. Abre la app, inicia sesión y ve a **Ajustes → Cargar datos iniciales (Oct–Nov 2026)**.
2. Comprueba que el Inicio muestra *Dinero total actual 30.800,07 €*.
3. En el móvil, ábrela en el navegador y elige **Añadir a pantalla de inicio**: se instala como app.
4. (Opcional, recomendado) **Ajustes → Activar verificación en dos pasos**. Después, para que la
   base de datos lo exija también:
   ```sql
   update public.app_owner set requiere_mfa = true;
   ```

### 5. Comprobar la seguridad

```bash
SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=eyJ... ./scripts/comprobar-seguridad.sh
```

Debe responder `OK` en todas las tablas: sin sesión no se lee nada y el registro está desactivado.

---

## Uso diario

| En el Excel | En la app |
|---|---|
| Escribir en la columna **Añadir gasto** (macro `SumarGasto`) | Igual: en la tabla de gastos escribe el importe en «+ €» y pulsa **Enter** o ✓. Se suma, la casilla se vacía y puedes **Deshacer**. Cada suma queda como apunte con fecha y hora (enlace «N apuntes»). |
| Macro `AnadirGastos` (plan B) | Botón **Aplicar todos (N)** cuando hay varias casillas pendientes |
| `MarcarUltimoCambio` | «Último cambio» se actualiza solo (triggers de la base de datos) |
| `CrearMesNuevo` | Botón **Crear mes nuevo**: crea el mes siguiente, copia los conceptos con importe 0 y cierra el anterior (opcional). En enero aparece el *Resumen* del año nuevo. |
| `SincronizarHistorial`, `ActualizarIndice`, `IndiceDesactualizado` | No hacen falta: Historial e Índice se calculan siempre al momento y no tienen límite de años |
| `Workbook_Open`, `ReactivarEventos`, `DiagnosticoEventos` | No aplican: no hay eventos de Excel que se desactiven |

- **Gastos fijos:** en ⋯ de cada gasto, marca «Gasto fijo». Al crear el mes siguiente se copia con
  el mismo importe y el vencimiento un mes después.
- **Presupuesto por concepto:** en ⋯ pon un límite. Debajo del concepto aparece una barra (verde,
  ámbar desde el 90 %, roja si te pasas) y un resumen arriba de la tabla. Se mantiene en los meses siguientes.
- **Reordenar filas:** arrastra el asa ⋮⋮ (con el ratón o con el dedo). Con el teclado: enfoca el asa
  y usa ↑ / ↓.
- **Contraseña:** se cambia en *Ajustes → Seguridad y sesión*. Si la olvidas, pulsa «¿Has olvidado tu
  contraseña?» en el login (ver *Emails* más abajo).
- **Mes cerrado:** todo pasa a solo lectura, también en la base de datos. Usa **Reabrir mes**.
- **Saldo real en cuenta:** si lo rellenas, la diferencia con el saldo calculado se apunta sola
  como ingreso extra o como gasto no registrado.
- **Valor real de inversiones:** pulsa ✎ en la tarjeta «Total en inversiones» (Inicio o Historial)
  o rellénalo en la página de cada mes. Pon el valor total de la cartera, no la ganancia.
- **Buscar** (🔍): escribe un concepto («super», «regalos») o una persona y verás cuánto llevas
  gastado o ingresado, mes a mes, en el año elegido o en todos. No distingue mayúsculas ni tildes.
- **Te deben** (🤝): apunta quién te debe dinero y márcalo como devuelto cuando te pague. No se
  suma al dinero total ni a los gastos del mes. Si hay algo pendiente, aparece un aviso en Inicio.
- **Modo discreto** (👁): oculta todas las cifras en pantalla (•••• €). Se recuerda en cada
  dispositivo y no afecta a las exportaciones.
- **Exportar:** en Ajustes puedes descargar Excel (.xlsx, una hoja por mes + Índice + Historial +
  Resumen), una copia completa en JSON o CSV.

## Actualizaciones de la base de datos

Cuando una versión nueva trae un archivo nuevo en `supabase/migrations/`, hay que ejecutarlo **una
vez** en *Supabase → SQL Editor*, en orden. Se pueden repetir sin problema.

| Archivo | Qué hace |
|---|---|
| `0001_esquema.sql` | Tablas, seguridad y reglas (instalación inicial) |
| `0002_usuarios_nuevos_en_blanco.sql` | Los usuarios nuevos empiezan con saldos a 0 |
| `0003_fijos_presupuestos.sql` | Gastos fijos y presupuesto por concepto |
| `0004_deudas.sql` | Tabla «Te deben» (dinero que te deben) |

## Emails (recuperar contraseña)

- En *Authentication → URL Configuration*, la **Site URL** y las **Redirect URLs** deben incluir la
  dirección de la app (`https://TU_USUARIO.github.io/presupuesto/`).
- El servidor de email gratuito de Supabase solo envía a los miembros de tu organización de Supabase
  y muy pocos emails por hora. Para que llegue a otras personas, configura un SMTP propio en
  *Authentication → Emails → SMTP Settings*. Por ejemplo, Resend o Brevo tienen planes gratuitos.
- Mientras tanto, también puedes cambiar la contraseña de cualquier usuario desde *Authentication →
  Users*.

## Copias de seguridad

- **Manual:** *Ajustes → Copia completa (JSON)*. Se restaura con *Ajustes → Restaurar copia JSON*.
- **Automática:** cada lunes, en *Actions → Copia de seguridad semanal → (ejecución) → Artifacts*.
  Está cifrada; para abrirla:
  ```bash
  gpg -d copia.tgz.gpg > copia.tgz && tar xzf copia.tgz
  ```

## Desarrollo local

```bash
npm install
```

```bash
npm test
```

```bash
npm run dev
```

Sin el archivo `.env.local`, la app arranca en **modo local**: los datos se guardan en el
navegador y no hay login. Para conectarla a Supabase, copia `.env.example` a `.env.local` y
rellénalo.

## Estructura

```
src/lib/calculos.ts        Fórmulas del Excel (puras, en céntimos)
src/lib/calculos.test.ts   Tests de aceptación (los números de Oct/Nov 2026) y casos límite
src/lib/operaciones.ts     Crear mes, añadir gasto, deshacer, borrar mes, datos iniciales
src/lib/exportar.ts        Excel / JSON / CSV
src/data/                  Guardado: Supabase o modo local, cola con debounce de 500 ms y reintentos
src/pages/                 Inicio (Índice), Mes, Historial, Resumen anual, Ajustes
supabase/migrations/       Tablas, RLS, triggers (mes cerrado, último cambio) y función insertar_mes
.github/workflows/         Despliegue en Pages y copia semanal cifrada
```

## Decisiones tomadas

- Octubre-2026: los gastos sin desglosar (414,55 €) están en la fila «Pendiente de desglosar»,
  para que el total sea 428,55 €.
- El ahorro de 1.500 € de octubre, sin fecha en el Excel, tiene fecha 31/10/2026.
- Si hay un hueco entre meses (solo puede ocurrir al borrar un mes intermedio), el saldo
  «anterior» es el del último mes existente.
- El **valor real de inversiones** se puede editar también en meses cerrados. En el Excel vivía en
  el Historial, no en la hoja del mes.
- Solo se puede borrar un mes intermedio marcando expresamente «Sé que se creará un hueco».
