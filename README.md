# Presupuesto personal

Aplicación web privada que replica mi Excel de presupuesto mensual (hojas por mes, Historial,
Resumen anual e Índice) **y sus macros**. La uso desde el móvil, la tablet y el portátil, y solo
yo puedo ver los datos.

- **Frontend:** React + TypeScript + Vite + Tailwind + Recharts. Se instala en el móvil (PWA).
- **Datos y login:** Supabase (Postgres + Auth + Row Level Security), plan gratuito.
- **Hosting:** GitHub Pages, desplegado con GitHub Actions.
- **Cálculos:** módulo puro `src/lib/calculos.ts`, en céntimos enteros, con tests (`npm test`).
- **Pruebas en el navegador:** Playwright recorre los flujos principales en móvil y escritorio en cada
  pull request (`npm run e2e`).

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

1. Abre la app e inicia sesión. La primera vez, Inicio te ofrece un **recorrido guiado** de un minuto
   (también en *Ajustes → Guía de uso*).
2. En *Ajustes → Punto de partida* elige el mes de inicio y lo que había en tus cuentas antes de él.
3. En Inicio, pulsa **Crear mes nuevo**.
4. En el móvil, ábrela en el navegador y elige **Añadir a pantalla de inicio**: se instala como app.
5. (Opcional, recomendado) **Ajustes → Contraseña y seguridad → Activar verificación en dos pasos**. Después, para que la
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

> Dentro de la app, *Ajustes → Guía de uso* explica cada función en pocas líneas y permite repetir el
> recorrido guiado. Esta sección es la referencia completa.

### Moverse por la app

- **Móvil:** barra inferior con **Inicio**, **Mes**, el botón **+** (apuntar un gasto), **Resumen** y
  **Más** (Historial, Huchas, Futuro, Logros, Lista de la compra, Buscar, Viajes, Te deben, «¿Me lo puedo permitir?»,
  Actividad y Ajustes). Arriba, la lupa abre Buscar y el ojo, el modo discreto.
- **Ordenador y tablet:** barra lateral con todas las secciones y el botón **Apuntar gasto**.
- **Inicio:** patrimonio con su evolución, el mes en curso, dónde está tu dinero (disponible, cuenta
  remunerada e inversiones), colchón de emergencia, «Te deben» y los meses y resúmenes de cada año.

### Del Excel a la app

| En el Excel | En la app |
|---|---|
| Escribir en la columna **Añadir gasto** (macro `SumarGasto`) | Igual: en la tabla de gastos escribe el importe en «+ € nota» y pulsa **Enter** o el botón ✓. Se suma, la casilla se vacía y puedes **Deshacer**. Cada suma queda como apunte con fecha y hora (enlace «N apuntes»). O usa el botón **+** desde cualquier pantalla. |
| Macro `AnadirGastos` (plan B) | Botón **Sumar todos (N)** cuando hay varias casillas pendientes |
| `MarcarUltimoCambio` | «Último cambio» se actualiza solo (triggers de la base de datos) |
| `CrearMesNuevo` | Botón **Crear mes nuevo**: crea el mes siguiente, copia los conceptos con importe 0 y cierra el anterior (opcional). En enero aparece el *Resumen* del año nuevo. |
| `SincronizarHistorial`, `ActualizarIndice`, `IndiceDesactualizado` | No hacen falta: Historial e Índice se calculan siempre al momento y no tienen límite de años |
| `Workbook_Open`, `ReactivarEventos`, `DiagnosticoEventos` | No aplican: no hay eventos de Excel que se desactiven |

### Apuntar y el mes

- **Apuntar un gasto (botón +):** elige el concepto (salen primero los que más usas), escribe el
  importe con el teclado numérico y, si quieres, una nota. Se suma al gasto del último mes abierto y
  el aviso permite **Deshacer**. Si el concepto tiene presupuesto, te dice cuánto te queda. En el
  ordenador también se puede escribir con el teclado.
- **Notas en los apuntes:** en «+ € nota» escribe el importe y, detrás, una nota: `12,50 Mercadona`. Se ve
  (y se edita) en «N apuntes» y el buscador la encuentra.
- **Gastos fijos:** en los tres puntos de cada gasto, marca «Gasto fijo». Al crear el mes siguiente se copia con
  el mismo importe y el vencimiento un mes después.
- **Presupuesto por concepto:** en los tres puntos pon un límite. Debajo del concepto aparece una barra (verde,
  ámbar desde el 90 %, roja si te pasas) y un resumen arriba de la tabla. Se mantiene en los meses siguientes.
- **Reordenar filas:** arrastra el asa ⋮⋮ (con el ratón o con el dedo). Con el teclado: enfoca el asa
  y usa ↑ / ↓.
- **Cuadrar con el banco** (opcional, en cada mes): si rellenas el saldo real en cuenta, la diferencia con el
  saldo calculado se apunta sola como ingreso extra o como gasto no registrado. Ahí también puedes
  escribir el **saldo real de la cuenta remunerada** (la diferencia con lo calculado se ajusta sola y los meses
  siguientes parten de ahí; necesita la migración `0018_saldo_real_remunerada.sql`) y el **valor real de las
  inversiones** (el total de la cartera, no la ganancia); en Inicio,
  el lápiz de la fila «Inversiones» hace lo mismo con el último mes.
- **Ahorro y traspasos:** cada fila mueve dinero **Desde** una cuenta **Hacia** otra: cuenta de
  gastos, cuenta remunerada o inversiones. «Ahorro» crea una fila de la cuenta de gastos a
  inversiones y «Traspaso», una de la cuenta remunerada a la cuenta de gastos; luego puedes cambiar
  las cuentas. Un traspaso no es un ingreso ni un gasto: si llega a la cuenta de gastos, suma al saldo
  disponible y resta del ahorro del mes; el dinero total no cambia. Necesita la migración `0011_traspasos.sql`.
- **Intereses de la cuenta remunerada:** en *Ajustes → Cuenta remunerada* pon la TAE (y desde qué mes
  vale cada una, si el banco la cambia; se elige en una lista), la retención de Hacienda (19 % por defecto) y
  **cuándo te paga el banco**: el día 1 del mes siguiente (por defecto) o el último día del mismo mes. Cada mes
  genera los intereses netos sobre el saldo de la cuenta remunerada al empezar el mes: saldo × ((1 + TAE)^(1/12)
  − 1) × (1 − retención). Con el pago el día 1, lo que genera noviembre se suma en la hoja de diciembre (en
  noviembre se ve «unos X € el 1 de diciembre»). Los intereses suben la cuenta remunerada y el dinero total,
  pero no son ingresos de la cuenta de gastos. Si el banco paga otra cifra, escríbela en el mes en que la cobras
  («Intereses cobrados») o al cerrarlo y sustituye a la estimación. Se ven en el mes, en Inicio, como columna en
  Historial y en el Excel. Necesita las migraciones `0013_intereses_cuenta_remunerada.sql` y `0017_pago_intereses.sql`.
- **Cerrar mes guiado:** «Cerrar mes…», al final de la hoja del mes, repasa el saldo real del banco,
  el valor de las inversiones, lo pendiente (presupuestos, avisos, lo que te deben) y el resumen frente
  al mes anterior. Después todo pasa a solo lectura, también en la base de datos; usa **Reabrir mes**
  si hace falta.
- **Recordatorio de cierre:** si un mes ya terminado sigue abierto, Inicio lo avisa. Se quita en
  *Ajustes → Recordatorios*.
- **¿En qué se va?** (cada mes): necesidades, caprichos y ahorro frente a la regla 50/30/20. Clasifica
  cada concepto una vez con un toque; se recuerda para los meses siguientes. La aportación a la cuenta
  compartida cuenta como necesidad.
- **Avisos** («Revisa», arriba del mes): una suscripción que sube de precio, un concepto que va más de 2,5 veces por encima de su media
  (con al menos 3 meses de historia y 30 € o más) o dos apuntes iguales casi seguidos.
- **Apuntar con Siri o Atajos:** *Ajustes → Siri y Atajos* genera un enlace
  (`#/apuntar?gasto=Supermercado&importe=…`) y explica cómo crear el atajo. El enlace abre la app con
  el gasto puesto y siempre pide un toque para confirmar.

### Ver cómo vas

- **Resumen:** el año mes a mes, con la gráfica de dónde está el dinero cada mes (saldo disponible,
  cuenta remunerada e inversiones, con los mismos colores que en Inicio).
- **Historial:** todos los meses seguidos, con la evolución del dinero total y todas las columnas del Excel.
- **Calendario de gastos** (en *Resumen*): mapa de calor del mes (cada día, más oscuro cuanto más se gastó;
  al tocarlo se ve qué se apuntó) y gasto medio por día de la semana del año. Solo tienen día los apuntes
  (botón +, «+ € nota», Siri) y los gastos con fecha de vencimiento; lo escrito directamente en la casilla de
  un concepto no tiene día, y se indica cuánto del mes tiene día.
- **Suscripciones** (en *Resumen*): lo que se paga al mes y al año. Se detectan solas: servicios conocidos
  (Netflix, Spotify, el gimnasio…) en conceptos y notas, gastos fijos de menos de 100 € y gastos de menos de
  100 € que se repiten 3 meses seguidos con casi el mismo importe. Avisa de las subidas de precio en «Revisa»
  y al cerrar el mes. «No es una suscripción» la quita también en los demás dispositivos (necesita la
  migración `0016_suscripciones.sql`).
- **Tu año en cifras:** el resumen del año como historias: cuánto creció el patrimonio, lo que entró
  y salió, el mejor mes, dónde más se fue el dinero, los apuntes y los viajes. Toca a la derecha para
  avanzar, a la izquierda para volver y mantén pulsado para pararlo; al final se puede compartir como
  texto. Se abre desde *Resumen* y, en diciembre y enero, desde Inicio.
- **Futuro** (en *Más*): proyección del patrimonio a 5, 10, 20 y 30 años partiendo de lo que tienes y de tu
  ahorro medio de los últimos 12 meses. Las inversiones crecen con la rentabilidad que elijas (5 % por
  defecto) menos las comisiones de tus fondos (0,2 %), la cuenta remunerada con tu TAE y el resto se queda en
  la cuenta de gastos. Lo que ahorras sube cada año (2 % por defecto, como el sueldo). La gráfica enseña lo
  más probable y la banda donde caen 8 de cada 10 de 300 futuros simulados con años buenos y malos (según los
  «altibajos» de tus inversiones, 15 % por defecto), o, en «De dónde sale», lo que tienes hoy, lo que pondrás
  tú y lo que rinde; al tocarla se ve cada momento por cuentas. Opciones «en euros de hoy» (descuenta la
  inflación, 2 % por defecto) y «descontar impuestos al vender» (IRPF del ahorro por tramos). Avisa de lo que
  se queda parado cada mes en la cuenta de gastos y deja probar a invertirlo. Hitos: una cifra redonda, cada
  hucha, tus planes y la libertad financiera.
- **Tus planes** (en *Futuro*): tu año de nacimiento (para verlo todo por edad, «a los 52») y cambios que ya
  sabes que van a pasar: una compra o un ingreso puntual, un gasto nuevo al mes, dejar de pagar algo (el fin de
  la hipoteca), un cambio de sueldo o una pensión o renta. Los importes van en euros de hoy y se actualizan con
  la inflación; cambian la proyección y la libertad financiera desde su fecha.
- **Libertad financiera** (en *Futuro*): tu número = lo que gastas al año (más los impuestos de sacarlo, si se
  cuentan) ÷ lo que sacarías cada año (4 % por defecto), el porcentaje que llevas, cuándo llegarías (y a qué
  edad) y, con años buenos y malos, cuándo llegas la mitad de las veces y 9 de cada 10. Se pueden quitar los
  gastos que entonces no tendrías. Necesita las migraciones `0015_futuro.sql` y `0019_futuro_planes.sql` para
  guardar estos ajustes.
- **Rachas y logros** (en *Más*): rachas de meses seguidos ahorrando, gastando menos de lo que entra, sin
  pasarse de ningún presupuesto y cerrando los meses (el mes en curso suma cuando se cumple y mientras tanto
  no rompe la racha), y logros con su fecha: primer mes cerrado, 3/6/12 meses ahorrando, el 20 % al ahorro,
  colchón de 3 y 6 meses, cifras de patrimonio, primera hucha conseguida, 100 € de intereses, 1.000 €
  ganados invirtiendo… Los pendientes muestran su progreso. Avisa al conseguir uno nuevo (una vez por
  dispositivo) y en Inicio se ve la racha de ahorro. Se calculan con los meses: no necesitan migración.
- **Colchón de emergencia** (Inicio e Historial): cuántos meses podrías vivir sin ingresos con tu saldo
  y tu cuenta remunerada, según lo que gastas de media (las inversiones no cuentan).
- **¿Me lo puedo permitir?** (en *Más*): escribe lo que cuesta algo y si lo pagarías de una vez o a
  plazos (6, 12, 24 meses u «Otro», hasta 480). A plazos puedes poner la **entrada** y la **TAE**: la
  cuota se calcula como un préstamo normal (sistema francés) y te dice los intereses y el total que
  pagarás. Te dice si te lo puedes permitir, cómo quedaría tu colchón (la entrada sí lo baja), cuántos
  meses de ahorro supone y qué parte de tu patrimonio es. En «Y en tu futuro», cuánto valdría ese dinero
  invertido a 10 y 20 años (en euros de hoy) y cuántos meses retrasa la libertad financiera, con los
  ajustes de *Futuro*. Usa tus medias de los últimos 6 meses; es orientativo.

### Más herramientas

- **Buscar** (la lupa): escribe un concepto («super», «regalos») o una persona y verás cuánto llevas
  gastado o ingresado, mes a mes, en el año elegido o en todos. No distingue mayúsculas ni tildes.
- **Huchas** (en *Más*): objetivos de ahorro con su meta, fecha límite opcional, aportación mensual
  opcional y, si quieres, la cuenta donde está el dinero. Puedes meter de golpe parte de lo que ya tienes;
  la aportación mensual la propone «Cerrar mes…» para que la confirmes o la cambies. Calcula cuándo
  llegarás o cuánto tendrías que meter al mes para llegar a tiempo, y celebra con confeti al llenarla.
  Las huchas **reservan** dinero, no lo mueven: el dinero total no cambia y se ve cuánto queda libre (no
  deja reservar más de lo que tienes, ni más de lo que hay en la cuenta de la hucha). Inicio muestra las
  que están en curso. Necesita la migración `0014_huchas.sql`.
- **Te deben:** apunta quién te debe dinero y márcalo como devuelto cuando te pague. No se
  suma al dinero total ni a los gastos del mes. Si hay algo pendiente, aparece en Inicio.
- **Lista de la compra:** una por cuenta; la de la compartida la veis los dos en tiempo real. Al
  terminar, escribe el total del ticket y se suma como apunte al gasto que elijas (por defecto
  Supermercado), con lo comprado en la nota.
- **Viajes:** presupuesto de un viaje con gastos en cualquier moneda. El cambio se toma de los
  tipos del Banco Central Europeo (servicio público Frankfurter: solo se le envía el código de la
  moneda) y se puede escribir a mano; cada gasto guarda el del día. Al volver, «Cerrar y pasar al
  mes» lo apunta en tu presupuesto (fila nueva o sumado a un gasto).
- **Actividad:** quién cambió qué y cuándo. Lo apunta la base de datos sola (nadie puede editarlo ni
  borrarlo) y se guarda 3 meses. En la cuenta compartida, Inicio muestra los últimos cambios.
- **Tiempo real:** lo que se apunta en un dispositivo aparece solo en los demás que tengan la app
  abierta (por ejemplo, un gasto que apunta tu pareja en la cuenta compartida), sin recargar. Si
  estás escribiendo en una fila, no se te pisa. Necesita la migración `0008_tiempo_real.sql`.

### Ajustes

Organizados como los Ajustes del iPhone (en pantallas anchas, en dos paneles como en el Mac), con un
**buscador** arriba. Al final de la lista, **Cerrar sesión** (con la opción de cerrarla en todos los
dispositivos).

- **Guía de uso:** cada función explicada, con enlace para ir allí, y el recorrido guiado.
- **Contraseña y seguridad:** cambiar la contraseña y la verificación en dos pasos. Si olvidas la
  contraseña, pulsa «¿Has olvidado tu contraseña?» en el login (ver *Emails* más abajo).
- **Face ID:** pide Face ID, huella o el código del móvil al abrir la app y al volver a ella tras más
  de un minuto. Es por dispositivo; la app no ve ni guarda tu cara ni tu huella. Si algún día falla,
  en la pantalla de bloqueo puedes cerrar sesión y entrar con tu contraseña.
- **Modo discreto:** oculta las cifras en pantalla (•••• €), también con el ojo de arriba. Puede
  empezar siempre oculto al abrir la app. No afecta al PDF ni a las exportaciones.
- **Apariencia:** tema claro, oscuro o automático; el color de la app (marino, verde, grafito,
  ciruela o teja); céntimos visibles o redondeados; saldos positivos en verde y negativos en rojo.
- **Recordatorios:** el aviso de Inicio cuando queda un mes pasado sin cerrar.
- **Copias de seguridad:** indica cuándo descargaste la última copia en ese dispositivo.
- **Exportar:** Excel (.xlsx, una hoja por mes + Índice + Historial + Resumen) o tablas sueltas en CSV.
- **Reparto por concepto** (cuenta compartida): en los tres puntos de cada gasto, «proporcional» (lo cubren las
  aportaciones), «a medias» o «lo paga entero» uno. La tarjeta «Reparto del mes» dice cuánto pone cada
  uno además de su aportación.

Las preferencias de modo discreto, apariencia y recordatorios son de cada dispositivo y no cambian los datos.

## Actualizaciones de la base de datos

Cuando una versión nueva trae un archivo nuevo en `supabase/migrations/`, hay que ejecutarlo **una
vez** en *Supabase → SQL Editor*, en orden. Se pueden repetir sin problema.

| Archivo | Qué hace |
|---|---|
| `0001_esquema.sql` | Tablas, seguridad y reglas (instalación inicial) |
| `0002_usuarios_nuevos_en_blanco.sql` | Los usuarios nuevos empiezan con saldos a 0 |
| `0003_fijos_presupuestos.sql` | Gastos fijos y presupuesto por concepto |
| `0004_deudas.sql` | Tabla «Te deben» (dinero que te deben) |
| `0005_cuentas_compartidas.sql` | Cuentas: tu cuenta personal y, opcionalmente, una compartida. Tus datos pasan a tu cuenta personal sin cambios |
| `0006_borrar_cuenta_compartida.sql` | Permite borrar una cuenta compartida (con confirmación) |
| `0007_borrar_mes_compartido.sql` | Al borrar un mes de la cuenta compartida, desaparece la aportación de ese mes en las cuentas personales |
| `0008_tiempo_real.sql` | Tiempo real: los cambios aparecen al momento en los demás dispositivos |
| `0009_historial_compra_viajes.sql` | Historial de cambios, lista de la compra y viajes |
| `0010_clasificacion_reparto.sql` | Necesidades/caprichos (50/30/20) y reparto por concepto en la cuenta compartida |
| `0011_traspasos.sql` | Traspasos entre cualquier par de cuentas (p. ej. de la cuenta remunerada a la cuenta de gastos) |
| `0012_historial_tres_meses.sql` | El historial de cambios (Actividad) se guarda 3 meses en vez de un año, para ocupar menos |
| `0013_intereses_cuenta_remunerada.sql` | TAE de la cuenta remunerada y los intereses de cada mes (estimados o los reales del banco) |
| `0014_huchas.sql` | Huchas (objetivos de ahorro) y lo que se mete o se saca de cada una |
| `0015_futuro.sql` | Ajustes de la proyección y la libertad financiera (rentabilidad, inflación, % de retirada y gastos que no tendrías) |
| `0016_suscripciones.sql` | Gastos marcados como «no es una suscripción» |
| `0017_pago_intereses.sql` | Cuándo paga el banco los intereses (el día 1 del mes siguiente o a final de mes) |
| `0018_saldo_real_remunerada.sql` | Saldo real de la cuenta remunerada en cada mes (ajusta la diferencia con lo calculado) |
| `0019_futuro_planes.sql` | Más ajustes de Futuro (subida del ahorro, comisiones, impuestos, altibajos), año de nacimiento y tus planes |

## Cuenta compartida (opcional)

Cada usuario tiene su **cuenta personal**, que solo ve él. Si lo activáis, podéis tener además una
**cuenta compartida** para los gastos comunes (casa, wifi, supermercado…) que veis los dos, cada uno
con su usuario. Mientras nadie la cree, la app funciona exactamente igual que antes.

**Ponerla en marcha (una vez):**

1. Ejecuta `0005_cuentas_compartidas.sql` en *Supabase → SQL Editor* (si no lo has hecho ya).
2. Autoriza el email de tu pareja y créale su usuario:
   ```sql
   insert into public.app_owner (email) values ('email-de-tu-pareja@ejemplo.com');
   ```
   Después, en *Authentication → Users → Add user → Create new user*, con su email y una
   contraseña (marca **Auto Confirm User**). Podrá cambiarla luego en *Ajustes*.
3. En la app: *Ajustes → Cuentas compartidas → Crear cuenta compartida*, con su email. Cuando tu
   pareja entre, la verá en el selector de cuenta (Mi cuenta / Casa).

Puedes tener **varias** cuentas compartidas (por ejemplo, una con tu pareja y otra con tu familia).
*Ajustes → Cuentas compartidas* las lista todas, con quién las compartes y quién no ha entrado aún;
toca una para abrirla. Debajo están los ajustes de la que tienes abierta y la opción de crear otra.

**Aportaciones automáticas (interruptor, apagado por defecto):** en *Ajustes* dentro de la cuenta
compartida, activa «Aportaciones automáticas proporcionales» y elige el porcentaje. Cada mes, cada
uno aporta ese porcentaje de **todos** sus ingresos del mes:

- se apunta solo como ingreso en la cuenta compartida («Aportación Ana») y como gasto en la cuenta
  personal de cada uno («Aportación Casa»);
- se recalcula al cambiar los ingresos, el porcentaje o el nombre, y aparece cuando cada uno tiene
  creado ese mes en su cuenta personal;
- los meses **cerrados** no se tocan, así que cambiar el porcentaje no altera el pasado;
- esas filas no se pueden editar a mano (llevan la marca «Automático»).
- si se borra un mes de la cuenta compartida, desaparece la aportación de **ese mes** en la cuenta
  personal de cada uno (salvo que su mes personal esté cerrado).

**Borrar la cuenta compartida:** *Ajustes* (dentro de la compartida) → *Zona peligrosa*. Hay que
marcar que lo entiendes y escribir el nombre de la cuenta; la base de datos también comprueba el
nombre, así que no se puede borrar por error. Se borra para los dos con todo su contenido. En las
cuentas personales solo desaparece la aportación de los meses abiertos (en los cerrados se queda
como gasto normal). El diálogo ofrece descargar una copia antes.

Ten en cuenta que, al aportar un porcentaje, la otra persona puede deducir tus ingresos a partir de
tu aportación. El resto de tu cuenta personal sigue siendo privado: las reglas de la base de datos
solo dejan ver cada fila a los miembros de su cuenta.

## Emails (recuperar contraseña)

- En *Authentication → URL Configuration*, la **Site URL** y las **Redirect URLs** deben incluir la
  dirección de la app (`https://TU_USUARIO.github.io/presupuesto/`).
- El servidor de email gratuito de Supabase solo envía a los miembros de tu organización de Supabase
  y muy pocos emails por hora. Para que llegue a otras personas, configura un SMTP propio en
  *Authentication → Emails → SMTP Settings*. Por ejemplo, Resend o Brevo tienen planes gratuitos.
- Mientras tanto, también puedes cambiar la contraseña de cualquier usuario desde *Authentication →
  Users*.

## Informe PDF

*Ajustes → Informe PDF* genera un PDF de la cuenta activa: portada con tu nombre y las cifras
principales, gráficas (dinero total, dónde está tu dinero, ingresos y gastos, % de ahorro), en qué se
va el dinero por concepto, de dónde vienen los ingresos, resumen por año, historial mensual, «Te
deben», viajes y el detalle de cada mes.

En **Periodo** eliges qué meses entran:

- **Todo:** desde el primer mes hasta hoy.
- **Un año:** por ejemplo, 2026.
- **De mes a mes:** cualquier franja, aunque abarque varios años (por ejemplo, de noviembre de 2025 a
  diciembre de 2026).

Con un periodo, las cifras de la portada (dinero total, inversiones, cuenta remunerada) son las del
final del periodo, y el nombre del archivo lo indica (`informe-…-2026-….pdf`). Se genera en el propio
dispositivo; no se envía nada a ningún sitio. El nombre de la portada se pone en tu perfil, arriba del
todo en *Ajustes* (se guarda en tu perfil y se ve en todos tus dispositivos). En la cuenta compartida,
la portada muestra el nombre de la cuenta y de quienes la compartís.

## Copias de seguridad

- **Manual:** *Ajustes → Copias de seguridad → Descargar copia completa*. Se restaura en la misma
  pantalla, con *Restaurar una copia…*.
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

Las pantallas secundarias (y con ellas las gráficas), el PDF y el Excel se descargan la primera vez
que se usan, para que la app arranque antes en el móvil.

### Pruebas en el navegador

`e2e/` abre la app compilada en modo local, con un año de datos de ejemplo, en un móvil y en un
ordenador (Chromium), y recorre los flujos principales: que todas las pantallas abren sin errores,
apuntar con el botón + y deshacer, sumar en el mes, cerrar un mes, el buscador y la apariencia de
Ajustes, el PDF de un año, el Excel, «¿Me lo puedo permitir?», «Tu año en cifras» y el recorrido
guiado. GitHub las ejecuta en cada pull request (*Actions → Pruebas → navegador*). En local:

```bash
npx playwright install chromium
```

```bash
npm run build && npm run e2e
```

### Pruebas de la base de datos

`supabase/tests/` prueba las migraciones en un PostgreSQL desechable que simula lo mínimo de
Supabase (roles, `auth.uid()`, usuarios de prueba): privacidad entre cuentas, cuenta compartida,
aportaciones automáticas y borrados. GitHub las ejecuta solas en cada pull request y en cada cambio
en `main` (*Actions → Pruebas*), junto con los tests de la app. Para ejecutarlas a mano hace falta
un PostgreSQL 16 de pruebas (**nunca** el de Supabase):

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres ./supabase/tests/ejecutar.sh
```

Si añades una migración, añade también sus comprobaciones en un archivo nuevo de `supabase/tests/`.

## Estructura

```
src/lib/calculos.ts        Fórmulas del Excel (puras, en céntimos)
src/lib/calculos.test.ts   Tests de aceptación (los números de Oct/Nov 2026) y casos límite
src/lib/operaciones.ts     Crear mes, añadir gasto, deshacer, borrar mes, datos iniciales
src/lib/informe*.ts        Datos (con periodo) y dibujo del informe PDF
src/lib/apuntar.ts         Panel de Apuntar: conceptos más usados y teclado numérico
src/lib/permitir.ts        «¿Me lo puedo permitir?»
src/lib/anioEnCifras.ts    «Tu año en cifras»
src/lib/preferencias.ts    Preferencias del dispositivo (color, céntimos, recordatorios…)
src/lib/exportar.ts        Excel / JSON / CSV
src/data/                  Guardado: Supabase o modo local, cola con debounce de 500 ms y reintentos
src/components/            Navegación, panel de Apuntar, recorrido guiado, piezas estilo iOS
src/pages/                 Inicio, Mes, Historial, Resumen, Ajustes y el resto de pantallas
e2e/                       Pruebas en el navegador (Playwright)
supabase/migrations/       Tablas, RLS, triggers (mes cerrado, último cambio) y función insertar_mes
.github/workflows/         Pruebas, despliegue en Pages y copia semanal cifrada
```
