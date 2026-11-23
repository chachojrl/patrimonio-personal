// Contenido de Ajustes → Guía de uso: cada función de la app explicada con detalle.
// Si añades o cambias una función, actualiza aquí su ficha (y el README).
import { COLOR, type NombreIcono } from './ios'

export interface SeccionFicha {
  /** Subtítulo de la sección (opcional). */
  titulo?: string
  pasos: string[]
}

export interface Ficha {
  titulo: string
  icono: NombreIcono
  color: string
  /** Una frase que se ve sin abrir la ficha. */
  resumen: string
  secciones: SeccionFicha[]
  /** Un consejo destacado al final. */
  consejo?: string
  ir?: { texto: string; to: string }
  /** Solo con cuenta en la nube (no en modo local). */
  nube?: boolean
}

export interface GrupoGuia {
  grupo: string
  fichas: Ficha[]
}

export const GUIA: GrupoGuia[] = [
  // ===================================================================
  {
    grupo: 'Primeros pasos',
    fichas: [
      {
        titulo: 'Cómo está organizada la app',
        icono: 'lista',
        color: COLOR.azul,
        resumen: 'Dónde está cada cosa en el móvil y en el ordenador.',
        secciones: [
          {
            titulo: 'En el móvil',
            pasos: [
              'Abajo tienes la barra con Inicio, Mes (el mes en curso), el botón + para apuntar un gasto, Resumen y Más.',
              'Más abre el resto de secciones: Historial, Huchas, Futuro, Logros, Lista de la compra, Buscar, Viajes, Te deben, «¿Me lo puedo permitir?», Actividad y Ajustes.',
              'Arriba, la lupa abre Buscar y el ojo oculta o muestra las cifras (modo discreto).',
            ],
          },
          {
            titulo: 'En el ordenador o la tablet',
            pasos: [
              'A la izquierda está la barra lateral con todas las secciones y el botón «Apuntar gasto».',
              'Abajo de la barra ves si está todo guardado y el ojo del modo discreto.',
            ],
          },
          {
            titulo: 'Si tienes varias cuentas',
            pasos: [
              'Con una cuenta compartida aparece un selector (por ejemplo, «Mi cuenta / Casa») arriba en el móvil y en la barra lateral en el ordenador. Todo lo que ves y apuntas es de la cuenta elegida.',
            ],
          },
        ],
        consejo: 'El recorrido guiado (botón de arriba) te enseña lo principal en un minuto.',
      },
      {
        titulo: 'Empezar desde cero',
        icono: 'bandera',
        color: COLOR.amarillo,
        resumen: 'Los saldos de partida, los conceptos y tu primer mes.',
        secciones: [
          {
            titulo: '1. Punto de partida',
            pasos: [
              'En Ajustes → Punto de partida elige el mes en que empiezas y cuánto tenías antes: en la cuenta de gastos, en la cuenta remunerada y en inversiones (lo que valían y lo que habías metido).',
              'Así el dinero total cuadra desde el primer día. Solo se puede cambiar mientras no haya meses.',
            ],
          },
          {
            titulo: '2. Conceptos',
            pasos: [
              'En Ajustes → Conceptos del primer mes escribe tus fuentes de ingresos y tus gastos habituales, uno por línea (Nómina, Alquiler, Supermercado…).',
              'Solo se usan para el primer mes: después, cada mes copia los conceptos del anterior.',
            ],
          },
          {
            titulo: '3. Tu primer mes',
            pasos: [
              'En Inicio pulsa «Crear mes nuevo». Ya puedes apuntar ingresos, gastos y ahorro.',
              'Si ya tienes ahorros con TAE, pon la TAE en Ajustes → Cuenta remunerada para que los intereses se sumen solos.',
            ],
          },
        ],
        ir: { texto: 'Ir a Punto de partida', to: '/ajustes/partida' },
      },
      {
        titulo: 'Instalarla en el móvil',
        icono: 'movil',
        color: COLOR.verde,
        resumen: 'Tenerla en la pantalla de inicio como una app más.',
        secciones: [
          {
            titulo: 'iPhone',
            pasos: [
              'Abre la app en Safari, toca el botón Compartir (el cuadrado con la flecha) y elige «Añadir a pantalla de inicio».',
            ],
          },
          {
            titulo: 'Android',
            pasos: ['En Chrome, abre el menú (los tres puntos) y elige «Instalar aplicación» o «Añadir a pantalla de inicio».'],
          },
          {
            pasos: [
              'Se abre a pantalla completa, sin barra del navegador, y se actualiza sola cuando hay una versión nueva.',
            ],
          },
        ],
      },
      {
        titulo: 'Guardado, sin conexión y tiempo real',
        icono: 'reloj',
        color: COLOR.gris,
        resumen: 'Todo se guarda solo y llega al momento a tus otros dispositivos.',
        secciones: [
          {
            pasos: [
              'No hay botón de guardar: cada cambio se guarda solo a los pocos segundos. Arriba (o abajo de la barra lateral) ves «Guardado» o «Guardando…».',
              'Si te quedas sin conexión, aparece un aviso naranja y los cambios se guardan en cuanto vuelve. Si intentas cerrar la pestaña con algo pendiente, te avisa.',
              'Tiempo real: lo que se apunta en un dispositivo aparece solo en los demás que tengan la app abierta (por ejemplo, un gasto que apunta tu pareja en la cuenta compartida). Si estás escribiendo en una fila, no se te pisa.',
            ],
          },
          {
            titulo: 'Modo local',
            pasos: [
              'Si la app no está conectada a la nube, sale una franja amarilla: los datos se guardan solo en ese navegador. Sirve para probarla; para usarla en serio, conéctala a Supabase (ver el README).',
            ],
          },
        ],
      },
    ],
  },

  // ===================================================================
  {
    grupo: 'El día a día',
    fichas: [
      {
        titulo: 'Inicio',
        icono: 'casa',
        color: COLOR.azul,
        resumen: 'Tu patrimonio, el mes en curso y dónde está tu dinero, de un vistazo.',
        secciones: [
          {
            titulo: 'Patrimonio',
            pasos: [
              'Arriba ves todo tu dinero sumado (disponible + cuenta remunerada + inversiones) y cuánto ha cambiado desde el mes anterior.',
              'Toca la línea para ir al Historial con la evolución mes a mes.',
            ],
          },
          {
            titulo: 'El mes en curso',
            pasos: ['Ingresos, gastos y lo que te queda (ingresos menos gastos). Toca una fila para abrir la hoja del mes.'],
          },
          {
            titulo: 'Dónde está tu dinero',
            pasos: [
              'Una barra de colores con el reparto entre disponible, cuenta remunerada e inversiones, y el importe de cada parte.',
              'En la cuenta remunerada verás los intereses del mes si tienes puesta la TAE.',
              'En Inversiones, el lápiz sirve para escribir lo que vale hoy tu cartera (sustituye a la estimación).',
            ],
          },
          {
            titulo: 'Tarjetas',
            pasos: [
              'Colchón de emergencia: cuántos meses podrías vivir sin ingresos.',
              'Racha de ahorro: meses seguidos ahorrando y cuántos logros llevas.',
              'Te deben: lo que tienes pendiente de cobrar, si hay algo.',
              'Huchas: las que están en curso, con lo reservado y lo que te queda libre.',
            ],
          },
          {
            titulo: 'Avisos y meses',
            pasos: [
              'Si un mes ya terminado sigue abierto, aparece un aviso para que lo cierres.',
              'Abajo están todos tus meses y los resúmenes de cada año, por años.',
              'En la cuenta compartida, Inicio enseña además los últimos cambios.',
            ],
          },
        ],
        ir: { texto: 'Ir a Inicio', to: '/' },
      },
      {
        titulo: 'Apuntar un gasto',
        icono: 'mas',
        color: COLOR.verde,
        resumen: 'El botón + desde cualquier pantalla, en tres toques.',
        secciones: [
          {
            pasos: [
              'Toca el botón + de la barra de abajo (en el ordenador, «Apuntar gasto» en la barra lateral).',
              'Elige el concepto: salen primero los que más usas.',
              'Escribe el importe con el teclado de la pantalla (en el ordenador también con el teclado normal) y, si quieres, una nota como «Mercadona».',
              'Pulsa «Apuntar»: se suma a ese gasto del último mes abierto y queda guardado con su fecha y hora.',
            ],
          },
          {
            titulo: 'Detalles',
            pasos: [
              'Si te equivocas, toca «Deshacer» en el aviso que aparece abajo.',
              'Si el concepto tiene presupuesto, te dice cuánto te queda.',
              'Como guarda el día, lo que apuntas así aparece en el calendario de gastos.',
            ],
          },
        ],
        consejo: 'Apuntar al momento con el + es lo que hace que el calendario y las rachas sean exactos.',
      },
      {
        titulo: 'Siri y Atajos',
        icono: 'microfono',
        color: COLOR.rosa,
        resumen: 'Apuntar un gasto hablando o desde un atajo del iPhone.',
        secciones: [
          {
            pasos: [
              'En Ajustes → Siri y Atajos la app te da un enlace para un concepto (por ejemplo, Supermercado) y te explica cómo crear el atajo en la app Atajos del iPhone.',
              'Al usarlo, la app se abre con el gasto y el importe ya puestos. Siempre pide un toque para confirmar, así que nada se apunta sin que lo veas.',
              'Puedes añadir una nota al final del enlace.',
            ],
          },
        ],
        ir: { texto: 'Ir a Siri y Atajos', to: '/ajustes/atajos' },
      },
      {
        titulo: 'La hoja del mes',
        icono: 'calendario',
        color: COLOR.naranja,
        resumen: 'Ingresos, gastos y ahorro del mes, como en el Excel.',
        secciones: [
          {
            titulo: 'Moverte',
            pasos: [
              'Arriba cambias al mes anterior o al siguiente con las flechas. El título del mes se puede editar tocándolo.',
              'Todo se edita tocando la cifra o el texto, y se guarda solo.',
              'El saldo disponible de arriba dice lo que te queda y qué parte de lo que ha entrado llevas gastada (la barra se pone ámbar al 90 % y roja si te pasas).',
            ],
          },
          {
            titulo: 'Ingresos',
            pasos: ['Cada fuente de ingresos con su importe. «Añadir» crea una fila nueva.'],
          },
          {
            titulo: 'Gastos y apuntes',
            pasos: [
              'Cada concepto con su importe. Puedes escribir el total directamente en la casilla, o ir sumando: escribe un importe en «+ € nota» y pulsa Enter (o ✓).',
              'Detrás del importe puedes poner una nota: «12,50 Mercadona». Cada suma queda como un apunte con fecha y hora; el enlace «N apuntes» los enseña y ahí puedes cambiar la nota o deshacer uno.',
              'Si dejas varias casillas «+ € nota» escritas, «Sumar todos» las suma de una vez.',
              'Vencimiento: la fecha en que se cobra un gasto (por ejemplo, el recibo de la luz). Aparece en el calendario de gastos.',
            ],
          },
          {
            titulo: 'Los tres puntos de cada gasto',
            pasos: [
              'Gasto fijo: al crear el mes siguiente se copia con el mismo importe y el vencimiento un mes después. Lleva la marca «Fijo».',
              'Presupuesto mensual: un límite para ese concepto. Debajo sale una barra (verde, ámbar desde el 90 % y roja si te pasas) y arriba de la tabla un resumen. Se mantiene en los meses siguientes.',
              'Borrar esta fila.',
              'En la cuenta compartida, además, «Cómo se reparte» (mira la ficha de Cuentas compartidas).',
            ],
          },
          {
            titulo: 'Orden',
            pasos: ['Arrastra el asa ⋮⋮ para cambiar el orden de las filas (con el dedo o con el ratón). Con el teclado: enfoca el asa y usa ↑ / ↓.'],
          },
        ],
        ir: { texto: 'Ir al mes actual', to: '/mes/actual' },
      },
      {
        titulo: 'Ahorro y traspasos',
        icono: 'traspaso',
        color: COLOR.indigo,
        resumen: 'Mover dinero entre la cuenta de gastos, la remunerada y las inversiones.',
        secciones: [
          {
            pasos: [
              'Tienes tres cuentas: la cuenta de gastos (tu saldo disponible), la cuenta remunerada y las inversiones. Cada fila de «Ahorro y traspasos» mueve dinero Desde una cuenta Hacia otra.',
              '«Ahorro» crea una fila de la cuenta de gastos a inversiones; «Traspaso», una de la cuenta remunerada a la cuenta de gastos. Después puedes cambiar las dos cuentas a tu gusto.',
            ],
          },
          {
            titulo: 'Cómo cuenta',
            pasos: [
              'Un movimiento no es un ingreso ni un gasto: tu dinero total no cambia, solo cambia de sitio.',
              'Lo que sale de la cuenta de gastos hacia el ahorro es tu «ahorro del mes». Si traes dinero de vuelta a la cuenta de gastos, suma al disponible y resta del ahorro de ese mes.',
              'Origen y destino no pueden ser la misma cuenta.',
            ],
          },
        ],
      },
      {
        titulo: 'Cuadrar con el banco e inversiones',
        icono: 'balanza',
        color: COLOR.grafito,
        resumen: 'Ajustar el saldo y el valor real de tu cartera (opcional).',
        secciones: [
          {
            titulo: 'Saldo real en cuenta',
            pasos: [
              'En «Cuadrar con el banco», escribe lo que de verdad tienes en la cuenta de gastos según tu banco.',
              'Si no coincide con el saldo calculado, la diferencia se apunta sola: como ingreso extra si tienes más, o como gasto no apuntado si tienes menos («Ajuste automático»).',
            ],
          },
          {
            titulo: 'Valor real de las inversiones',
            pasos: [
              'Escribe lo que vale toda tu cartera ese mes (el total, no la ganancia). Sustituye a la estimación en ese mes y en los siguientes.',
              'Si lo dejas vacío, la app estima: la última valoración real más lo que hayas aportado después.',
              'El lápiz de la fila Inversiones en Inicio hace lo mismo con el último mes.',
            ],
          },
        ],
        consejo: 'No hace falta cada mes, pero cuadrar de vez en cuando hace que tu patrimonio sea exacto.',
      },
      {
        titulo: 'Intereses de la cuenta remunerada',
        icono: 'billete',
        color: COLOR.verde,
        resumen: 'Pon la TAE y los intereses se suman solos el mes en que te los paga el banco.',
        secciones: [
          {
            titulo: 'Ponerla',
            pasos: [
              'En Ajustes → Cuenta remunerada toca «Poner la TAE» y escribe la de tu cuenta (por ejemplo, 2,5 %).',
              '«Desde» es el primer mes que genera intereses con esa TAE (por defecto, el mes en curso). Elígelo en la lista.',
              'Si el banco la cambia, toca «Cambió la TAE…» y pon la nueva desde el mes en que cambia: los meses anteriores siguen con la de antes.',
              'La retención de Hacienda viene al 19 % (lo habitual en España); puedes cambiarla.',
            ],
          },
          {
            titulo: 'Cuándo te paga el banco',
            pasos: [
              '«El día 1 del mes siguiente» (por defecto): lo que genera noviembre te llega el 1 de diciembre, así que se suma en la hoja de diciembre. En noviembre la cuenta remunerada se queda con lo que tienes de verdad y ves «unos X € el 1 de diciembre».',
              '«El último día del mismo mes»: lo de noviembre se suma en noviembre.',
              'Elige la que use tu banco para que la app cuadre con lo que tienes en cada momento.',
            ],
          },
          {
            titulo: 'Cómo se calcula',
            pasos: [
              'Cada mes genera el interés neto sobre lo que había en la cuenta remunerada al empezar el mes: saldo × ((1 + TAE)^(1/12) − 1) × (1 − retención). Lo que metes durante el mes empieza a generar al mes siguiente.',
              'Los intereses suben la cuenta remunerada y tu dinero total, pero no son un ingreso de tu cuenta de gastos: no salen en Ingresos ni tocan tu saldo disponible.',
              'En Ajustes ves cuánto generas al mes y al año con tu saldo actual, el próximo cobro y lo que llevas cobrado.',
            ],
          },
          {
            titulo: 'Lo que pagó el banco',
            pasos: [
              'Si el banco te pagó otra cifra, escríbela en la hoja del mes en que la cobraste («Intereses cobrados») o al cerrarlo. Manda la tuya en lugar de la estimación.',
              'Se puede escribir aunque el mes esté cerrado.',
            ],
          },
          {
            titulo: 'Dónde se ven',
            pasos: [
              'En la hoja del mes, en «Cuadrar con el banco»: debajo de «Cuenta remunerada» pone lo cobrado ese mes o lo que llegará el día 1.',
              'En Inicio, bajo la cuenta remunerada; como columna en el Historial y en el Excel.',
            ],
          },
        ],
        ir: { texto: 'Poner la TAE', to: '/ajustes/intereses' },
      },
      {
        titulo: '¿En qué se va? (regla 50/30/20)',
        icono: 'tarta',
        color: COLOR.morado,
        resumen: 'Necesidades, caprichos y ahorro de cada mes.',
        secciones: [
          {
            pasos: [
              'En la hoja del mes verás cuánto de lo que entra se va en necesidades, en caprichos y en ahorro, comparado con la regla 50/30/20 (50 % necesidades, 30 % caprichos, 20 % ahorro).',
              'Clasifica cada concepto una vez con un toque (necesidad o capricho). Se recuerda para los meses siguientes.',
              'La aportación a una cuenta compartida cuenta como necesidad.',
            ],
          },
        ],
      },
      {
        titulo: 'Avisos «Revisa»',
        icono: 'alerta',
        color: COLOR.naranja,
        resumen: 'La app te avisa de lo raro antes de que se te pase.',
        secciones: [
          {
            pasos: [
              'Arriba del mes, en un recuadro ámbar, aparecen tres tipos de aviso:',
              'Un concepto que va más de 2,5 veces por encima de su media (cuando tiene al menos 3 meses de historia y 30 € o más).',
              'Dos apuntes iguales en el mismo concepto con menos de un día de diferencia: «¿Duplicado?».',
              'Una suscripción que ha subido de precio este mes, con lo que te cuesta de más al año.',
              'Si está bien, toca la ✕ para ocultarlo. Los mismos avisos salen también al cerrar el mes.',
            ],
          },
        ],
      },
      {
        titulo: 'Crear el mes nuevo',
        icono: 'calendario',
        color: COLOR.azul,
        resumen: 'Empezar el mes siguiente con los conceptos y los fijos ya puestos.',
        secciones: [
          {
            pasos: [
              '«Crear mes nuevo» (en Inicio o al final del último mes) crea el mes siguiente.',
              'Copia los conceptos del mes anterior con importe 0, y los gastos fijos con su importe y su vencimiento un mes después.',
              'Te pregunta si quieres cerrar el mes anterior; si dices que sí, antes verás el repaso para comprobar que está todo.',
              'En enero aparece también el resumen del año nuevo.',
            ],
          },
        ],
      },
      {
        titulo: 'Cerrar, reabrir y borrar un mes',
        icono: 'candado',
        color: COLOR.grafito,
        resumen: 'El repaso guiado del final de mes.',
        secciones: [
          {
            titulo: 'Cerrar',
            pasos: [
              'Al final de la hoja del mes, «Cerrar mes…» abre un repaso por pasos:',
              'El saldo real del banco y el valor de tus inversiones (opcionales).',
              'Los intereses que te ha pagado el banco ese mes, si tienes TAE.',
              'Las aportaciones a tus huchas: te propone la aportación mensual de cada una, marcada con su importe. Cámbiala o desmárcala; se aparta al cerrar.',
              'Lo pendiente: presupuestos que te has pasado, avisos y lo que te deben.',
              'El resumen del mes comparado con el anterior.',
              'Al cerrarlo, todo queda en solo lectura (también en la base de datos), para no cambiar el pasado por error.',
            ],
          },
          {
            titulo: 'Reabrir',
            pasos: ['Si necesitas corregir algo, pulsa «Reabrir mes». Al terminar, vuelve a cerrarlo.'],
          },
          {
            titulo: 'Borrar',
            pasos: [
              '«Borrar mes…» lo elimina con todo lo que tiene. No se puede deshacer, así que te pide confirmación; si no es el último mes, te avisa de que quedará un hueco en el historial.',
            ],
          },
        ],
        consejo: 'Si un mes ya terminado sigue abierto, Inicio te lo recuerda (lo puedes quitar en Ajustes → Recordatorios).',
      },
    ],
  },

  // ===================================================================
  {
    grupo: 'Ver cómo vas',
    fichas: [
      {
        titulo: 'Resumen del año',
        icono: 'grafica',
        color: COLOR.indigo,
        resumen: 'El año mes a mes, con gráfica, calendario y suscripciones.',
        secciones: [
          {
            pasos: [
              'Arriba eliges el año. Ves los ingresos, los gastos, el ahorro y el % de ahorro del año.',
              'La gráfica enseña dónde está tu dinero cada mes: saldo disponible, cuenta remunerada e inversiones (los mismos colores que en Inicio).',
              'Debajo, la tabla de meses (en el móvil, una lista) con las cifras de cada uno; toca un mes para abrirlo.',
              'También están el calendario de gastos, tus suscripciones y el acceso a «Tu año en cifras».',
            ],
          },
        ],
        ir: { texto: 'Ir a Resumen', to: '/resumen' },
      },
      {
        titulo: 'Calendario de gastos',
        icono: 'calendario',
        color: COLOR.azul,
        resumen: 'Qué días gastas más, en un mapa de calor.',
        secciones: [
          {
            pasos: [
              'En Resumen, elige el mes: cada día sale más oscuro cuanto más gastaste.',
              'Toca un día para ver qué apuntaste (concepto, nota e importe).',
              'Debajo, el gasto medio por día de la semana del año y, si un día destaca, una frase como «Los sábados gastas 2,4 veces más que la media».',
            ],
          },
          {
            titulo: 'Qué gastos tienen día',
            pasos: [
              'Los apuntados con el botón +, con «+ € nota» o con Siri (guardan la fecha y la hora) y los gastos con fecha de vencimiento.',
              'Lo que escribes directamente en la casilla de un concepto no sabe qué día fue, así que no sale. Debajo del calendario ves cuánto del mes tiene día.',
            ],
          },
        ],
        ir: { texto: 'Ir a Resumen', to: '/resumen' },
      },
      {
        titulo: 'Suscripciones',
        icono: 'ticket',
        color: COLOR.rosa,
        resumen: 'Cuánto pagas al mes y al año en servicios que se repiten.',
        secciones: [
          {
            titulo: 'Qué ves',
            pasos: [
              'En Resumen: «Pagas X € al mes en N suscripciones: Y € al año».',
              'Cada una con lo que pagas al mes, cuántos meses llevas, lo que supone al año y por qué se ha detectado.',
              'Las que ya no pagas van aparte, en «Ya no las pagas».',
            ],
          },
          {
            titulo: 'Cómo se detectan (solas)',
            pasos: [
              'Servicios conocidos en el concepto o en las notas de los apuntes: Netflix, Spotify, HBO, Disney+, Amazon Prime, iCloud, YouTube, el gimnasio…',
              'Gastos fijos de menos de 100 €.',
              'Gastos de menos de 100 € que se repiten 3 meses seguidos con casi el mismo importe.',
            ],
          },
          {
            titulo: 'Subidas y errores',
            pasos: [
              'Si una sube de precio, se marca («Subió en…: 12,99 € → 13,99 €») y te avisa en «Revisa» del mes y al cerrarlo.',
              'Si alguna no es una suscripción, toca «No es una suscripción»: no vuelve a salir, tampoco en tus otros dispositivos (puedes deshacerlo en el aviso).',
            ],
          },
        ],
        ir: { texto: 'Ver mis suscripciones', to: '/resumen' },
      },
      {
        titulo: 'Historial',
        icono: 'tendencia',
        color: COLOR.turquesa,
        resumen: 'Todos tus meses seguidos, con todas las columnas.',
        secciones: [
          {
            pasos: [
              'La gráfica del dinero total mes a mes y las cifras generales: dinero total, saldo inicial, último mes, colchón, inversiones (valor, aportado y ganancia) y cuenta remunerada (con los intereses generados).',
              'La tabla tiene una fila por mes con todas las columnas del Excel: ingresos, gastos, ahorro, saldo, inversiones, cuenta remunerada, intereses, acumulados y dinero total.',
              'En la columna «Valor real inversiones» puedes escribir lo que valía tu cartera ese mes.',
              'Los meses que faltan entre el primero y el último salen como «Sin hoja».',
            ],
          },
        ],
        ir: { texto: 'Ir al Historial', to: '/historial' },
      },
      {
        titulo: 'Tu año en cifras',
        icono: 'estrella',
        color: COLOR.rosa,
        resumen: 'Tu año resumido como historias, para ver o compartir.',
        secciones: [
          {
            pasos: [
              'Cuánto creció tu patrimonio, lo que entró y salió, tu mejor mes, en qué se te fue más dinero, los apuntes y los viajes.',
              'Se abre desde Resumen y, en diciembre y enero, también desde Inicio.',
              'Toca a la derecha para avanzar, a la izquierda para volver, y mantén pulsado para pararlo.',
              'Al final puedes compartirlo como texto.',
            ],
          },
        ],
      },
      {
        titulo: 'Colchón de emergencia',
        icono: 'escudo',
        color: COLOR.verde,
        resumen: 'Cuántos meses podrías vivir sin ingresos.',
        secciones: [
          {
            pasos: [
              'Se calcula con tu saldo disponible más la cuenta remunerada, dividido entre lo que gastas de media (hasta 6 meses). Las inversiones no cuentan porque no son dinero inmediato.',
              'Lo recomendable es tener entre 3 y 6 meses; la barra se pone verde al llegar a 6.',
              'Lo ves en Inicio y en el Historial.',
            ],
          },
        ],
      },
      {
        titulo: '¿Me lo puedo permitir?',
        icono: 'balanza',
        color: COLOR.marron,
        resumen: 'Antes de comprar algo grande, mira cómo te afectaría.',
        secciones: [
          {
            pasos: [
              'En Más → «¿Me lo puedo permitir?» escribe lo que cuesta y, si quieres, qué es.',
              'Elige cómo lo pagarías: de una vez, o a plazos (6, 12, 24 meses u «Otro», hasta 480).',
              'A plazos puedes poner la entrada y la TAE: la cuota se calcula como un préstamo normal y te dice los intereses y el total que pagarás.',
            ],
          },
          {
            titulo: 'Qué te dice',
            pasos: [
              'Si te lo puedes permitir, cómo quedaría tu colchón (la entrada sí lo baja), cuántos meses de ahorro supone y qué parte de tu patrimonio es.',
              '«Y en tu futuro»: cuánto valdría ese dinero si lo invirtieras, a 10 y 20 años (en euros de hoy), y cuántos meses retrasa tu libertad financiera.',
              'Usa tus medias de los últimos 6 meses. Es orientativo.',
            ],
          },
        ],
        ir: { texto: 'Abrir «¿Me lo puedo permitir?»', to: '/permitir' },
      },
      {
        titulo: 'Futuro: tu patrimonio',
        icono: 'cohete',
        color: COLOR.indigo,
        resumen: 'Lo que podrías tener en 5, 10, 20 o 30 años.',
        secciones: [
          {
            titulo: 'La gráfica',
            pasos: [
              'Elige el plazo (5, 10, 20 o 30 años). La línea es lo más probable; la banda, dónde quedarías 8 de cada 10 veces contando años buenos y malos (se simulan 300 futuros posibles).',
              '«De dónde sale» cambia la gráfica: lo que tienes hoy, lo que pondrás tú y lo que rinde (el interés compuesto).',
              'Toca la gráfica para ver ese momento por cuentas, los impuestos si lo vendieras y cuánto es tuyo y cuánto rentabilidad.',
              'Arriba, la frase te dice cuánto tendrías (y con qué edad, si pusiste tu año de nacimiento).',
              '«En euros de hoy» descuenta la inflación para que las cifras del futuro no engañen; «Descontar impuestos al vender» resta el IRPF del ahorro de las ganancias.',
            ],
          },
          {
            titulo: 'De dónde salen los números',
            pasos: [
              'Parte de lo que tienes hoy en cada cuenta y de tu ahorro medio de los últimos 12 meses (ingresos menos gastos), repartido como sueles repartirlo.',
              'Las inversiones crecen con la rentabilidad que elijas (5 % por defecto) menos las comisiones; la cuenta remunerada, con tu TAE; lo demás se queda en la cuenta de gastos.',
              'Si cada mes se queda dinero parado en la cuenta de gastos, te avisa de cuánto ganarías invirtiéndolo y puedes probarlo con un botón.',
            ],
          },
          {
            titulo: 'Juega con los números',
            pasos: [
              '«Ahorro extra al mes»: mira qué cambiaría si ahorrases algo más (ese extra se invierte).',
              '«Rentabilidad de las inversiones»: prueba otra; se guarda para la próxima vez.',
              '«Comisiones de tus fondos»: lo que te cobran al año; se resta de la rentabilidad.',
              '«Subida de tu ahorro cada año»: con los años el sueldo sube y sueles ahorrar más.',
              '«Altibajos de las inversiones»: cuánto suben y bajan; cuanto más, más ancha la banda.',
            ],
          },
          {
            titulo: 'Tus planes',
            pasos: [
              'Pon tu año de nacimiento para verlo todo por edad («a los 52»).',
              'Con «Añadir cambio» apunta lo que ya sabes que va a pasar: una compra o un ingreso puntual, un gasto nuevo al mes, dejar de pagar algo (el fin de la hipoteca), un cambio de sueldo o una pensión.',
              'Los importes van en euros de hoy y se actualizan solos con la inflación. Cambian la proyección y la libertad financiera desde su fecha.',
            ],
          },
          {
            titulo: 'Hitos',
            pasos: ['Cuándo llegarías a la siguiente cifra redonda, a llenar cada hucha, a cada uno de tus planes y a la libertad financiera.'],
          },
        ],
        consejo: 'Es una estimación: las rentabilidades pasadas no garantizan las futuras, y los impuestos se calculan con los tramos actuales.',
        ir: { texto: 'Ir a Futuro', to: '/futuro' },
      },
      {
        titulo: 'Libertad financiera',
        icono: 'sol',
        color: COLOR.verde,
        resumen: 'Cuánto necesitarías para vivir de tus ahorros, y cuándo llegarías.',
        secciones: [
          {
            titulo: 'Tu número',
            pasos: [
              'Es lo que gastas al año (media de los últimos meses × 12) dividido entre lo que sacarías cada año. Con el 4 % habitual, tu gasto anual × 25.',
              'La idea («regla del 4 %»): si cada año sacas ese porcentaje de lo que tienes invertido, el dinero debería durarte toda la vida.',
            ],
          },
          {
            titulo: 'Qué ves',
            pasos: [
              'Qué porcentaje llevas, con su barra, y cuándo llegarías según la proyección (en euros de hoy), y con años buenos y malos: cuándo llegas la mitad de las veces y 9 de cada 10.',
              'Si cuentas los impuestos, el número sube: hay que sacar algo más para que, tras pagar a Hacienda por las ganancias, te quede lo que gastas.',
              '«Lo que sacarías al año» (del 2,5 % al 6 %): cuanto menos, más tarda pero más seguro es.',
              '«Inflación»: para pasar las cifras a euros de hoy (el objetivo del Banco Central Europeo es el 2 %).',
            ],
          },
          {
            titulo: 'Afinar',
            pasos: [
              'En «Quitar gastos que entonces no tendrías» desmarca, por ejemplo, la comida de la oficina: el número baja.',
              'Lo que se acaba en una fecha (la hipoteca) o una pensión que cobrarás, mejor en «Tus planes»: el número baja justo desde entonces.',
            ],
          },
        ],
        ir: { texto: 'Ver mi número', to: '/futuro' },
      },
      {
        titulo: 'Rachas y logros',
        icono: 'trofeo',
        color: COLOR.amarillo,
        resumen: 'Tus rachas y lo que vas consiguiendo, sin apuntar nada.',
        secciones: [
          {
            titulo: 'Rachas',
            pasos: [
              'Meses seguidos ahorrando, gastando menos de lo que entra, sin pasarte de ningún presupuesto y cerrando los meses. Para cada una ves la actual y tu mejor racha.',
              'El mes en curso suma cuando lo cumples y, mientras tanto, no rompe la racha. Pasarte de un presupuesto sí la rompe al momento.',
            ],
          },
          {
            titulo: 'Logros',
            pasos: [
              'Primer mes cerrado, un año de cuentas, 3, 6 y 12 meses ahorrando, ahorrar el 20 % de lo que entra, un mes dentro del presupuesto, colchón de 3 y de 6 meses, cada cifra de patrimonio (10.000 €, 25.000 €, 50.000 €…), primera hucha conseguida, 100 € de intereses y 1.000 € ganados invirtiendo.',
              'Los conseguidos salen con la fecha; los que faltan, con una barra de progreso («5 de 6 meses seguidos»).',
              'Cuando consigues uno nuevo te avisa (una vez en cada dispositivo).',
            ],
          },
        ],
        ir: { texto: 'Ver mis logros', to: '/logros' },
      },
    ],
  },

  // ===================================================================
  {
    grupo: 'Herramientas',
    fichas: [
      {
        titulo: 'Huchas',
        icono: 'hucha',
        color: COLOR.rosa,
        resumen: 'Apartar dinero para lo que quieres conseguir.',
        secciones: [
          {
            titulo: 'Crear una hucha',
            pasos: [
              'En Más → Huchas toca «Nueva hucha». Ponle nombre, un icono y el objetivo.',
              'Opcional: para cuándo lo necesitas, una aportación mensual y en qué cuenta está el dinero (cuenta de gastos, remunerada o inversiones).',
              'Opcional: «Meter ya de lo que tienes», para empezar con parte de tus ahorros.',
            ],
          },
          {
            titulo: 'Llenarla',
            pasos: [
              'Dentro de la hucha: «Meter» para añadir dinero cuando quieras (con nota y fecha) y «Sacar» si lo necesitas.',
              'Si tiene aportación mensual, al cerrar cada mes «Cerrar mes…» te la propone para que la confirmes, la cambies o la desmarques. Nunca propone más de lo que falta.',
              'Cada movimiento queda en la lista y se puede borrar.',
            ],
          },
          {
            titulo: 'Qué te dice',
            pasos: [
              '«Con 200 € al mes llegas en julio de 2027», o con fecha límite: «Para llegar en diciembre necesitas 340 € al mes» (en ámbar si no llegas).',
              'Al llenarla, ¡confeti! Después puedes marcarla como «Conseguida» (se archiva abajo y cuenta para los logros) o reabrirla.',
            ],
          },
          {
            titulo: 'Dinero libre',
            pasos: [
              'Las huchas reservan dinero, no lo mueven: tu dinero total no cambia. Arriba ves el dinero total, lo que hay en huchas y lo que te queda libre.',
              'No te deja reservar más de lo que tienes. Si la hucha tiene cuenta, tampoco más de lo que hay en esa cuenta (y ves lo libre por cuenta).',
              'Cuando gastes el dinero de una hucha conseguida, sácalo de la hucha para que vuelva a contar como libre.',
            ],
          },
        ],
        ir: { texto: 'Ir a Huchas', to: '/huchas' },
      },
      {
        titulo: 'Te deben',
        icono: 'billete',
        color: COLOR.verde,
        resumen: 'Lo que adelantas a otras personas, hasta que te lo devuelvan.',
        secciones: [
          {
            pasos: [
              'Apunta quién te debe, por qué (una cena, unas entradas…), cuánto y cuándo.',
              'Se agrupa por persona, con la que más te debe primero.',
              'Cuando te pague, márcalo como devuelto: pasa a la lista de devueltos.',
              'No cuenta en tus ingresos ni gastos ni en el dinero total. Si hay algo pendiente, sale en Inicio y al cerrar el mes.',
            ],
          },
        ],
        ir: { texto: 'Ir a Te deben', to: '/te-deben' },
      },
      {
        titulo: 'Viajes',
        icono: 'avion',
        color: COLOR.azul,
        resumen: 'El presupuesto de un viaje, con gastos en cualquier moneda.',
        secciones: [
          {
            titulo: 'Antes',
            pasos: [
              'En Más → Viajes, «Nuevo viaje»: nombre, moneda del destino, presupuesto en euros (opcional) y fechas.',
              'El tipo de cambio se toma de los tipos oficiales del Banco Central Europeo (solo se envía el código de la moneda) y lo puedes cambiar a mano.',
            ],
          },
          {
            titulo: 'Durante',
            pasos: [
              'Apunta cada gasto con su concepto, categoría (alojamiento, transporte, comida, ocio, compras u otros), importe y moneda. Cada gasto guarda el cambio de su día.',
              'Ves lo gastado en euros, el presupuesto gastado, la media por día y el reparto por categoría.',
            ],
          },
          {
            titulo: 'Al volver',
            pasos: [
              '«Cerrar y pasar al mes…» apunta el total en tu presupuesto: como fila nueva o sumado a un gasto que elijas. Hace falta un mes abierto.',
              'Un viaje cerrado se puede reabrir o borrar.',
            ],
          },
        ],
        ir: { texto: 'Ir a Viajes', to: '/viajes' },
      },
      {
        titulo: 'Lista de la compra',
        icono: 'carrito',
        color: COLOR.naranja,
        resumen: 'Una lista que, al terminar, se apunta como gasto.',
        secciones: [
          {
            pasos: [
              'Añade cosas a la lista; para varias a la vez, sepáralas por comas («leche, pan, huevos»).',
              'Márcalas al meterlas en el carro y quítalas cuando quieras.',
              'Al terminar, «Terminar la compra»: escribe el total del ticket y se suma como apunte al gasto que elijas (por defecto, Supermercado), con lo comprado en la nota. Hace falta un mes abierto.',
              'Hay una lista por cuenta: la de la cuenta compartida la veis los dos en tiempo real.',
            ],
          },
        ],
        ir: { texto: 'Ir a la lista', to: '/compra' },
      },
      {
        titulo: 'Buscar',
        icono: 'lupa',
        color: COLOR.gris,
        resumen: 'Cuánto llevas gastado en algo, en todos tus meses.',
        secciones: [
          {
            pasos: [
              'Toca la lupa de arriba y escribe un concepto («super», «regalos»), una nota («Mercadona») o una persona de «Te deben».',
              'Ves cuánto llevas gastado o ingresado, mes a mes, con la media al mes, en el año elegido o en todos.',
              'No distingue mayúsculas ni tildes. Sin escribir nada, te enseña tus conceptos.',
            ],
          },
        ],
        ir: { texto: 'Ir a Buscar', to: '/buscar' },
      },
      {
        titulo: 'Actividad',
        icono: 'reloj',
        color: COLOR.gris,
        resumen: 'Quién cambió qué y cuándo.',
        nube: true,
        secciones: [
          {
            pasos: [
              'Una lista con los cambios de la cuenta en frases: «cambiaste «Super»: 300 € → 345 €», «Ana cerró el mes»…',
              'La apunta la base de datos sola: nadie puede editarla ni borrarla. Se guarda 3 meses.',
              'Es muy útil en una cuenta compartida; Inicio enseña allí los últimos cambios.',
            ],
          },
        ],
        ir: { texto: 'Ir a Actividad', to: '/actividad' },
      },
    ],
  },

  // ===================================================================
  {
    grupo: 'Cuentas compartidas',
    fichas: [
      {
        titulo: 'Qué es y cómo crearla',
        icono: 'casa',
        color: COLOR.marron,
        resumen: 'Una cuenta para los gastos comunes, cada uno con su usuario.',
        nube: true,
        secciones: [
          {
            pasos: [
              'Además de tu cuenta personal (que solo ves tú), puedes tener una cuenta compartida para los gastos de casa, el wifi, el súper… que veis los dos.',
              'Créala en Ajustes → Cuentas compartidas con el correo de la otra persona (tiene que tener usuario en la app). Cuando entre, la verá en el selector de cuenta.',
              'Puedes tener varias (por ejemplo, una con tu pareja y otra con tu familia). Ajustes las lista con quién las compartes y quién no ha entrado aún.',
              'Cambia de cuenta con el selector de arriba. Las huchas, la lista de la compra y los viajes también son de cada cuenta.',
            ],
          },
        ],
        ir: { texto: 'Ir a Cuentas compartidas', to: '/ajustes/compartida' },
      },
      {
        titulo: 'Aportaciones automáticas',
        icono: 'traspaso',
        color: COLOR.marron,
        resumen: 'Cada uno aporta el mismo porcentaje de sus ingresos.',
        nube: true,
        secciones: [
          {
            pasos: [
              'Dentro de la cuenta compartida, en Ajustes → Cuentas compartidas, activa «Aportaciones automáticas proporcionales» y elige el porcentaje.',
              'Cada mes, cada uno aporta ese porcentaje de todos sus ingresos: se apunta solo como ingreso en la cuenta compartida («Aportación Ana») y como gasto en la cuenta personal de cada uno.',
              'Se recalcula sola al cambiar los ingresos o el porcentaje, y aparece cuando cada uno tiene creado ese mes. Los meses cerrados no se tocan.',
              'Esas filas llevan la marca «Automático» y no se pueden editar a mano.',
            ],
          },
        ],
        consejo: 'Al aportar un porcentaje, la otra persona puede deducir tus ingresos. El resto de tu cuenta personal sigue siendo privado.',
      },
      {
        titulo: 'Reparto por concepto',
        icono: 'balanza',
        color: COLOR.marron,
        resumen: 'Gastos a medias o que paga uno solo.',
        nube: true,
        secciones: [
          {
            pasos: [
              'En los tres puntos de cada gasto de la cuenta compartida, «Cómo se reparte»: proporcional (lo cubren las aportaciones), a medias, o lo paga entero uno de los dos.',
              'La tarjeta «Reparto del mes» dice cuánto pone cada uno además de su aportación.',
              'Se mantiene en los meses siguientes.',
            ],
          },
        ],
      },
      {
        titulo: 'Borrar una cuenta compartida',
        icono: 'papelera',
        color: COLOR.rojo,
        resumen: 'Con doble confirmación, para que no pase por error.',
        nube: true,
        secciones: [
          {
            pasos: [
              'Dentro de la compartida, en Ajustes → Cuentas compartidas → Zona peligrosa.',
              'Tienes que marcar que lo entiendes y escribir el nombre de la cuenta. Se borra para los dos con todo su contenido.',
              'En las cuentas personales solo desaparece la aportación de los meses abiertos (en los cerrados se queda como gasto normal).',
              'Antes te ofrece descargar una copia.',
            ],
          },
        ],
      },
    ],
  },

  // ===================================================================
  {
    grupo: 'Tus datos y tu privacidad',
    fichas: [
      {
        titulo: 'Informe PDF',
        icono: 'documento',
        color: COLOR.naranja,
        resumen: 'Un documento con resumen, gráficas y el detalle de cada mes.',
        secciones: [
          {
            pasos: [
              'En Ajustes → Informe PDF elige el periodo: todo, un año, o de un mes a otro (aunque abarque varios años).',
              'Incluye una portada con las cifras principales, gráficas de evolución, ingresos, gastos y ahorro, en qué se va el dinero y de dónde viene, el resumen por año y el historial mensual, Te deben y viajes, y todo lo apuntado mes a mes.',
              'Se genera en tu dispositivo: no se envía a ningún sitio. El modo discreto no lo afecta.',
            ],
          },
        ],
        ir: { texto: 'Ir al Informe PDF', to: '/ajustes/informe' },
      },
      {
        titulo: 'Exportar a Excel o CSV',
        icono: 'grafica',
        color: COLOR.verde,
        resumen: 'Tus datos en una hoja de cálculo.',
        secciones: [
          {
            pasos: [
              'Libro completo (.xlsx): una hoja por mes, el índice, el historial y los resúmenes por año.',
              'Tablas sueltas en CSV (historial, ingresos, gastos, ahorro y traspasos), con «;» y coma decimal, como en España. Se abren en Excel o Numbers.',
            ],
          },
        ],
        ir: { texto: 'Ir a Exportar', to: '/ajustes/exportar' },
      },
      {
        titulo: 'Copias de seguridad',
        icono: 'archivo',
        color: COLOR.azul,
        resumen: 'Guarda una copia completa y restáurala si hace falta.',
        secciones: [
          {
            pasos: [
              '«Descargar copia completa» guarda un archivo con todo: meses, ingresos, gastos, ahorro, Te deben, viajes, huchas y ajustes. Guárdalo, por ejemplo, en iCloud Drive.',
              'Ajustes te recuerda cuándo descargaste la última en ese dispositivo.',
              '«Restaurar una copia» sustituye todos los datos de la cuenta abierta por los del archivo. Antes te pide confirmación.',
              'Si la app está instalada con GitHub, además se guarda una copia automática cada lunes (ver el README).',
            ],
          },
        ],
        consejo: 'Descarga una copia antes de restaurar otra o de borrar una cuenta compartida.',
        ir: { texto: 'Ir a Copias de seguridad', to: '/ajustes/copias' },
      },
      {
        titulo: 'Contraseña y seguridad',
        icono: 'candado',
        color: COLOR.grafito,
        resumen: 'Contraseña, verificación en dos pasos y cerrar sesión.',
        nube: true,
        secciones: [
          {
            pasos: [
              'En Ajustes → Contraseña y seguridad cambias la contraseña (al menos 8 caracteres) y activas la verificación en dos pasos con una app de códigos.',
              'Si olvidas la contraseña, en la pantalla de entrada pulsa «¿Has olvidado tu contraseña?».',
              'Al final de Ajustes está «Cerrar sesión», con la opción de cerrarla en todos los dispositivos.',
            ],
          },
        ],
        ir: { texto: 'Ir a Seguridad', to: '/ajustes/seguridad' },
      },
      {
        titulo: 'Face ID',
        icono: 'cara',
        color: COLOR.verde,
        resumen: 'Bloquear la app con tu cara, tu huella o el código.',
        secciones: [
          {
            pasos: [
              'Al activarlo, la app pide Face ID, la huella o el código del móvil al abrirla y al volver a ella tras más de un minuto.',
              'Es de cada dispositivo. La app no ve ni guarda tu cara ni tu huella: lo comprueba el propio móvil.',
              'Si algún día falla, en la pantalla de bloqueo puedes cerrar sesión y entrar con tu contraseña.',
            ],
          },
        ],
        ir: { texto: 'Ir a Face ID', to: '/ajustes/faceid' },
      },
      {
        titulo: 'Modo discreto',
        icono: 'ojoTachado',
        color: COLOR.indigo,
        resumen: 'Ocultar las cifras en pantalla.',
        secciones: [
          {
            pasos: [
              'El ojo de arriba cambia los importes por «•••• €», por si alguien mira tu pantalla.',
              'En Ajustes → Modo discreto puedes hacer que empiece siempre oculto al abrir la app.',
              'No afecta al PDF ni a las exportaciones, y es de cada dispositivo.',
            ],
          },
        ],
        ir: { texto: 'Ir a Modo discreto', to: '/ajustes/discreto' },
      },
      {
        titulo: 'Apariencia y recordatorios',
        icono: 'paleta',
        color: COLOR.azul,
        resumen: 'Tema, color de la app, céntimos y avisos.',
        secciones: [
          {
            titulo: 'Apariencia',
            pasos: [
              'Tema claro, oscuro o automático (el del sistema).',
              'El color de la app: marino, verde, grafito, ciruela o teja.',
              'Ver los céntimos o redondear a euros, y si los saldos positivos salen en verde y los negativos en rojo.',
            ],
          },
          {
            titulo: 'Recordatorios',
            pasos: ['El aviso de Inicio cuando queda un mes pasado sin cerrar. Se puede quitar.'],
          },
          {
            pasos: ['Estas preferencias son de cada dispositivo y no cambian tus datos.'],
          },
        ],
        ir: { texto: 'Ir a Apariencia', to: '/ajustes/apariencia' },
      },
    ],
  },

  // ===================================================================
  {
    grupo: 'Preguntas frecuentes',
    fichas: [
      {
        titulo: '¿Qué diferencia hay entre saldo, ahorro y dinero total?',
        icono: 'billete',
        color: COLOR.gris,
        resumen: 'Las tres cifras que más vas a ver.',
        secciones: [
          {
            pasos: [
              'Saldo disponible: lo que hay en tu cuenta de gastos (lo que te queda para el mes).',
              'Ahorro del mes: lo que pasas de la cuenta de gastos a la cuenta remunerada o a inversiones.',
              'Dinero total (patrimonio): todo junto, disponible + cuenta remunerada + inversiones. Mover dinero entre cuentas no lo cambia; los ingresos, los gastos, los intereses y la rentabilidad sí.',
            ],
          },
        ],
      },
      {
        titulo: '¿Por qué no me cuadra el saldo con el banco?',
        icono: 'balanza',
        color: COLOR.gris,
        resumen: 'Normalmente, algo sin apuntar.',
        secciones: [
          {
            pasos: [
              'Suele ser un gasto o un ingreso que no has apuntado, o un traspaso que falta.',
              'Si no lo encuentras, escribe el saldo real en «Cuadrar con el banco»: la diferencia se apunta sola como ajuste y todo vuelve a cuadrar.',
            ],
          },
        ],
      },
      {
        titulo: 'Me he equivocado, ¿cómo lo deshago?',
        icono: 'anterior',
        color: COLOR.gris,
        resumen: 'Casi todo tiene marcha atrás.',
        secciones: [
          {
            pasos: [
              'Un gasto apuntado con el + o con «+ € nota»: «Deshacer» en el aviso, o bórralo en «N apuntes».',
              'Una cifra mal escrita: tócala y corrígela.',
              'Un mes cerrado: «Reabrir mes», corrige y vuelve a cerrarlo.',
              'Lo que no se puede deshacer (borrar un mes o una cuenta compartida) siempre pide confirmación.',
            ],
          },
        ],
      },
      {
        titulo: '¿Las huchas mueven mi dinero?',
        icono: 'hucha',
        color: COLOR.gris,
        resumen: 'No: solo lo reservan.',
        secciones: [
          {
            pasos: [
              'Una hucha marca una parte de tu dinero como «para esto», pero no lo cambia de cuenta: tu dinero total y tus cuentas siguen igual.',
              'Si quieres mover dinero de verdad (por ejemplo, a la cuenta remunerada), hazlo en «Ahorro y traspasos» del mes.',
            ],
          },
        ],
      },
      {
        titulo: '¿Dónde se guardan mis datos y quién los ve?',
        icono: 'candado',
        color: COLOR.gris,
        resumen: 'En tu propia base de datos, solo para ti.',
        nube: true,
        secciones: [
          {
            pasos: [
              'En tu base de datos de Supabase. Las reglas de seguridad de la base de datos solo dejan ver cada dato a los miembros de su cuenta: tu cuenta personal solo la ves tú.',
              'En una cuenta compartida la veis los dos (y, con aportaciones automáticas, la otra persona puede deducir tus ingresos).',
              'El PDF y las exportaciones se generan en tu dispositivo. Los viajes solo consultan el tipo de cambio enviando el código de la moneda.',
            ],
          },
        ],
      },
    ],
  },
]

/** Texto de una ficha para buscar (sin tildes ni mayúsculas). */
export function textoFicha(f: Ficha): string {
  return [f.titulo, f.resumen, ...f.secciones.flatMap((s) => [s.titulo ?? '', ...s.pasos]), f.consejo ?? '']
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}
