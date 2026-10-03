# Ashmere — simulación de mundo con mapa interactivo (test de Fable 5.1)

> **Este documento es un prompt one-shot.** Está cerrado: no quedan decisiones abiertas. Se entrega completo a Claude Fable 5.1 con la instrucción de generar `ashmere.html` en una sola pasada. Cualquier detalle no especificado aquí queda a criterio del implementador, pero nada de lo que sí está especificado es negociable.

## 1. Objetivo

Construir una simulación de mundo original con mapa interactivo para poner a prueba a Claude Fable 5.1 (`claude-fable-5-1`) como **narrador puro**: la lógica del mundo es determinística en JavaScript, y el modelo solo convierte números y eventos en prosa.

Se está probando específicamente:

- **Consistencia de voz** — que cada pueblo suene igual a sí mismo a lo largo de decenas de turnos.
- **Coherencia causal** — que la narración no contradiga eventos pasados ni invente cambios de estado que la simulación no autorizó.
- **Impacto visual** — que el modelo produzca una pieza con identidad propia y no una maqueta de demo. Cuenta tanto como los dos puntos anteriores; ver §8.

Mundo original. No se usa el universo de Juego de Tronos (derechos de autor); solo se toma prestado el tono de intriga política y fantasía medieval.

## 2. Entregable

| Aspecto | Decisión |
|---|---|
| Archivo | Uno solo: `ashmere.html` |
| Stack | HTML + CSS + JS vanilla + SVG inline. Cero frameworks, cero librerías, cero build step, cero `npm` |
| Ejecución | Servido por HTTP local (`python -m http.server 8000`) — **no** por doble clic. Ver §7.1 |
| Modo de entrega | One-shot: el archivo completo generado de una vez, funcional sin iteración posterior |

## 3. El mundo

### 3.1 Geografía (vecindad entre pueblos)

```
         Vaerholt (N)
        /          \
  Tharn Peak ---- Ashmere Delta ---- Corvane Bay
   (NE)          (centro, hub)        (E, costa)
                  /        \
           Greywood      Caldrun Vale
            (O)             (S)
              \
          Duskmere Fen
           (O, aislado)
```

Aristas de vecindad (7 en total):

`Vaerholt–Tharn Peak`, `Vaerholt–Ashmere`, `Tharn Peak–Ashmere`, `Ashmere–Corvane Bay`, `Ashmere–Greywood`, `Ashmere–Caldrun Vale`, `Greywood–Duskmere`.

Ashmere participa en 5 de las 7 aristas: es el hub y la fuente estructural de tensión.

### 3.2 Los 7 pueblos

| Pueblo | Región | Rasgo dominante | Economía | Tendencia | Vulnerabilidad |
|---|---|---|---|---|---|
| Emberfolk | Caldrun Vale (sur, llanuras cálidas) | Expansionistas, prósperos | Agricultura | Diplomático hasta que falta tierra, luego agresivo | Sequía |
| Frostkin | Vaerholt (norte, montañas) | Aislacionistas, resistentes | Minería/caza | Neutral, pero feroz si se sienten amenazados | Inviernos duros |
| River Clans | Ashmere Delta (centro, hub) | Mercantiles, diplomáticos | Comercio/pesca | Siempre buscan acuerdos, evitan la guerra | Militarmente débiles |
| Highland Wardens | Tharn Peak (noreste) | Orgullosos, ligados al honor | Ganadería/mercenariado | Cumplen juramentos incluso a su costa | Rígidos, no se adaptan rápido |
| Marsh Folk | Duskmere Fen (oeste, aislado) | Secretivos, autosuficientes | Recolección/alquimia | Desconfían de forasteros, comercian poco | Aislamiento los deja sin aliados en crisis |
| Sail Lords | Corvane Bay (este, costa) | Oportunistas, semi-piratas | Comercio marítimo | Apoyan al que más ofrezca | Dependientes del mar (tormentas, bloqueos) |
| Greywood Wardens | Greywood (centro-oeste, bosque) | Reclusivos, espirituales | Recolección/guardia de sitios antiguos | Pacíficos pero implacables si su bosque es invadido | Población pequeña, no sostiene guerra larga |

### 3.3 Tensiones narrativas de diseño

- Ashmere como hub mercantil genera presión constante — todos quieren su ruta de comercio.
- Emberfolk vs Greywood: expansión agrícola vs bosque sagrado.
- Frostkin y Highland Wardens: fronterizos con valores opuestos (honor rígido vs supervivencia pragmática).
- Duskmere aislado: en una crisis, nadie viene a ayudarlos.
- Sail Lords oportunistas: pueden voltear alianzas por conveniencia y desestabilizar el equilibrio.

## 4. Modelo de datos

### 4.1 Stats por pueblo

Cinco campos. `poblacion` es un entero sin tope duro; el resto se recorta siempre al rango 0–100.

| Campo | Rango | Significado |
|---|---|---|
| `poblacion` | 20–300 | Habitantes en unidades abstractas |
| `prosperidad` | 0–100 | Excedente económico |
| `estabilidad` | 0–100 | Cohesión interna; baja = revueltas |
| `militar` | 0–100 | Capacidad de sostener un conflicto |
| `favor` | 0–100 | Opinión del pueblo hacia el Cronista (el jugador) |

Valores iniciales — **desiguales a propósito**, cada uno derivado del rasgo del pueblo:

| Pueblo | poblacion | prosperidad | estabilidad | militar | favor |
|---|---:|---:|---:|---:|---:|
| Emberfolk | 140 | 72 | 58 | 55 | 50 |
| Frostkin | 85 | 44 | 74 | 68 | 50 |
| River Clans | 120 | 80 | 52 | 24 | 50 |
| Highland Wardens | 100 | 52 | 80 | 76 | 50 |
| Marsh Folk | 60 | 40 | 70 | 34 | 50 |
| Sail Lords | 95 | 74 | 38 | 52 | 50 |
| Greywood Wardens | 55 | 46 | 84 | 40 | 50 |

### 4.2 Matriz de relaciones

Simétrica, 7×7, rango −100 a +100. Se definen los 21 pares (no solo vecinos): los no vecinos existen pero derivan más lento (§5.5).

| Par | Valor | Par | Valor |
|---|---:|---|---:|
| Emberfolk – Greywood | −35 | Frostkin – Sail Lords | −15 |
| Emberfolk – River Clans | +25 | River Clans – Highland | +20 |
| Emberfolk – Frostkin | 0 | River Clans – Greywood | +15 |
| Emberfolk – Highland | −10 | River Clans – Marsh Folk | +5 |
| Emberfolk – Marsh Folk | −5 | River Clans – Sail Lords | +30 |
| Emberfolk – Sail Lords | +10 | Highland – Greywood | +10 |
| Frostkin – Highland | −30 | Highland – Marsh Folk | −10 |
| Frostkin – River Clans | +10 | Highland – Sail Lords | −25 |
| Frostkin – Greywood | +5 | Greywood – Marsh Folk | +20 |
| Frostkin – Marsh Folk | 0 | Greywood – Sail Lords | −5 |
| | | Marsh Folk – Sail Lords | −20 |

Umbrales de estado (se muestran en la UI y se pasan al modelo como etiqueta, no como número crudo):

| Rango | Estado |
|---|---|
| ≤ −60 | Guerra abierta |
| −59 … −25 | Hostil |
| −24 … +24 | Neutral |
| +25 … +59 | Cordial |
| ≥ +60 | Alianza |

### 4.3 Rutas comerciales

Una ruta existe sobre una arista de vecindad y puede estar `activa` o `cerrada`. Estado inicial: todas activas **excepto** `Greywood–Duskmere` (cerrada — los Marsh Folk comercian poco).

- Ruta activa: +2 prosperidad por turno a ambos extremos.
- Una ruta se cierra automáticamente si la relación del par cae a ≤ −25.
- Una ruta cerrada no se reabre sola: requiere la acción del Cronista (§6).

### 4.4 Tiempo

Un turno = una **estación**. Ciclo `Primavera → Verano → Otoño → Invierno`; 4 turnos = 1 año. La partida arranca en Primavera del Año 1. No hay condición de victoria ni de derrota: es un **sandbox indefinido** que corre hasta que el usuario decide parar.

## 5. Motor de simulación

Todo el motor es determinístico salvo el sorteo de eventos, que usa un PRNG con semilla guardada en el estado (para que una partida sea reproducible). Orden de resolución de un turno, estrictamente:

### 5.1 Efecto estacional

| Estación | Efecto |
|---|---|
| Primavera | +3 prosperidad a economías agrícolas y de recolección (Emberfolk, Marsh Folk, Greywood) |
| Verano | +3 prosperidad a economías comerciales (River Clans, Sail Lords); Emberfolk sube su probabilidad de sequía (§5.4) |
| Otoño | +2 prosperidad a todos; +2 estabilidad a todos (cosecha) |
| Invierno | −4 prosperidad a todos; −6 adicional a Frostkin; Sail Lords suben su probabilidad de tormenta (§5.4) |

### 5.2 Deriva económica

Por pueblo: `prosperidad += (rutas_activas_del_pueblo × 2) − 1`. El −1 es desgaste base.

### 5.3 Población

`poblacion += round((prosperidad − 50) / 12 + (estabilidad − 50) / 20)`, recortado para que nunca baje de 20.

### 5.4 Eventos aleatorios

Se sortean **0 a 2 eventos por turno**. Cada evento tiene un peso base; el peso se multiplica por 3 cuando el evento coincide con la vulnerabilidad del pueblo objetivo, y por 2 más cuando coincide con la estación indicada.

| Evento | Objetivo | Peso | Vulnerable | Estación | Efecto |
|---|---|---:|---|---|---|
| Sequía | 1 pueblo | 10 | Emberfolk | Verano | −12 prosperidad, −5 estabilidad |
| Invierno brutal | 1 pueblo | 10 | Frostkin | Invierno | −10 prosperidad, −8 población |
| Tormenta costera | Sail Lords | 10 | Sail Lords | Invierno | −14 prosperidad, −4 militar |
| Peste | 1 pueblo | 6 | Marsh Folk | — | −15 población, −6 estabilidad |
| Cosecha excepcional | 1 pueblo | 8 | — | Otoño | +12 prosperidad, +4 estabilidad |
| Veta de mineral | Frostkin / Highland | 6 | — | — | +14 prosperidad |
| Revuelta interna | 1 pueblo con estabilidad < 45 | 12 | Sail Lords | — | −12 estabilidad, −5 militar |
| Incursión fronteriza | 1 par vecino hostil | 10 | — | — | −8 relación, −4 militar a ambos, −3 estabilidad al defensor |
| Juramento cumplido | Highland Wardens | 7 | — | — | +10 relación con un vecino, −6 prosperidad (les cuesta) |
| Ruta saqueada | 1 ruta activa | 8 | Sail Lords como culpable | — | Ruta se cierra, −12 relación del par |
| Peregrinación | Greywood Wardens | 6 | — | Primavera | +8 estabilidad, +5 relación con todos los vecinos |
| Descubrimiento alquímico | Marsh Folk | 5 | — | — | +10 prosperidad, +6 favor |
| Tala en el bosque sagrado | Emberfolk → Greywood | 7 | — | Verano | −20 relación del par, +6 prosperidad a Emberfolk |
| Ofrecimiento mercenario | Sail Lords / Highland | 6 | — | — | +8 militar, −10 relación con un tercer pueblo al azar |

### 5.5 Deriva de relaciones

Cada relación se mueve 1 punto por turno hacia la línea base de la pareja (los valores de §4.2). Para pares **no vecinos** la deriva es 1 punto cada 2 turnos. Esto evita que el mundo quede congelado en un extremo tras una crisis puntual.

### 5.6 Chequeos de umbral

Se evalúan al final del turno y generan **hitos** — eventos permanentes que se anotan en el registro y nunca se borran del historial:

- Relación ≤ −60 → **guerra declarada** entre el par. Mientras dure: −5 prosperidad/turno a ambos, rutas del par cerradas.
- Relación ≥ +60 → **alianza formal**.
- `prosperidad < 15` durante 2 turnos seguidos → **hambruna**: −10 población/turno.
- `estabilidad < 20` → **colapso de autoridad**: el pueblo ignora la siguiente acción del Cronista dirigida a él.

## 6. El jugador: el Cronista

El usuario es una **entidad externa** — un cronista que observa y puede intervenir. No controla ningún pueblo. Esta decisión es deliberada: mantiene al modelo narrando *sobre* los pueblos en lugar de *desde dentro* de uno, que es lo que hace medible la consistencia de voz.

Recurso único: **Influencia**. Empieza en 12, gana +4 por turno, tope 30. Máximo **2 acciones por turno**.

| Acción | Costo | Efecto |
|---|---:|---|
| Apoyar con recursos | 4 | +8 prosperidad, +3 estabilidad, +6 favor al pueblo elegido |
| Enviar emisario | 3 | +10 a la relación entre dos pueblos elegidos |
| Imponer impuesto | 2 | −6 prosperidad al pueblo, −8 favor, +6 influencia al Cronista |
| Abrir acuerdo comercial | 5 | Activa una ruta cerrada entre vecinos, +12 a la relación del par |
| Romper acuerdo comercial | 3 | Cierra una ruta activa, −15 a la relación del par |

## 7. Integración con Claude Fable 5.1

### 7.1 Transporte y credenciales

Llamada directa desde el navegador con `fetch`. El usuario pega su propia API key en un campo de la UI; se guarda en `localStorage` y nunca se envía a ningún sitio que no sea `api.anthropic.com`.

Atajo de desarrollo: si la carpeta se sirve por HTTP y contiene un `.env` con `ANTHROPIC_API_KEY=…` (también se aceptan `ANTHROPIC_TOKEN` y `ANTRHOPHIC_TOKEN`), la página lo lee al cargar y guarda la clave sola. Funciona porque `python -m http.server` sirve todos los archivos de la carpeta, incluido el `.env` — cómodo en local, y una razón más para no exponer ese servidor fuera de `localhost`.

```
POST https://api.anthropic.com/v1/messages
content-type: application/json
x-api-key: <key del usuario>
anthropic-version: 2023-06-01
anthropic-dangerous-direct-browser-access: true
anthropic-beta: server-side-fallback-2026-07-01
```

Dos avisos que la UI debe mostrar explícitamente:

1. **Exponer una API key en el navegador es inseguro.** Es aceptable aquí porque es una herramienta local de un solo usuario para un test. Usar una key dedicada y rotarla al terminar.
2. **Hay que servir el archivo por HTTP**, no abrirlo con doble clic: desde `file://` el origen es `null` y CORS rechaza la petición. `python -m http.server 8000` y abrir `http://localhost:8000/ashmere.html`. Si aun así llega un 403 de CORS, la alternativa es un proxy local mínimo — pero eso rompe la restricción de un solo archivo, así que se documenta y no se implementa.

### 7.2 Forma de la petición

```json
{
  "model": "claude-fable-5-1",
  "max_tokens": 1200,
  "output_config": { "effort": "medium" },
  "fallbacks": "default",
  "system": [
    { "type": "text", "text": "<biblia del mundo — §7.4>", "cache_control": { "type": "ephemeral" } }
  ],
  "messages": [ "<historial append-only — §7.3>" ]
}
```

Restricciones de este modelo que el código **debe** respetar (son errores 400 si se violan):

- **No enviar `thinking`.** En Fable 5.1 el razonamiento siempre está activo; cualquier configuración explícita es rechazada.
- **No enviar `temperature`, `top_p` ni `top_k`.** Están removidos en este modelo. La variación de tono se consigue con el prompt, no con sampling.
- **No usar prefill** (último mensaje `assistant` como arranque de la respuesta).
- **No forzar `tool_choice`.** Aquí no hay herramientas, así que no aplica, pero no introducirlas.
- `effort: "medium"` es deliberado: las crónicas son texto corto y rutinario, no hace falta `high`.

Manejo de respuesta:

- Comprobar `stop_reason` **antes** de leer `content`. Si es `"refusal"`, mostrar el texto de la crónica seca (§7.5) y una nota discreta en la UI; no romper la partida.
- `fallbacks: "default"` hace que la API reintente sola en otro modelo ante un rechazo de política, dentro de la misma llamada.
- Extraer el texto concatenando los bloques con `type === "text"`.

### 7.3 Historial: append-only

El array `messages` **crece y nunca se recorta ni se reescribe**. Cada turno añade un par:

- `user`: el estado del mundo de ese turno (§7.4) más los eventos y deltas que calculó el motor.
- `assistant`: la respuesta del modelo, tal cual llegó.

Esto es una decisión de diseño, no una omisión. Tres razones:

1. Con ~400 tokens de entrada y ~250 de salida por turno, 100 turnos son ~65K tokens — holgado dentro del millón de contexto del modelo.
2. El caché de prompt hace que el historial acumulado cueste casi nada en lecturas sucesivas; la biblia del mundo lleva `cache_control` y supera de sobra el mínimo cacheable de 512 tokens de este modelo.
3. Fable 5.1 valida que el historial no se edite hacia atrás. Un historial append-only es el único que no arriesga invalidaciones, y además es el escenario honesto para el test: el modelo tiene delante todo lo que dijo antes, así que la coherencia causal es mérito suyo y no de un resumen que le recuerde las cosas.

Los números autoritativos se reenvían completos cada turno, así que aunque el modelo derive en algún detalle, el estado nunca depende de lo que él recuerde.

### 7.4 Prompt

**System (congelado, nunca se interpola nada dinámico):** la biblia del mundo. Contiene la geografía, los 7 pueblos con su rasgo, economía, tendencia y vulnerabilidad, y una **guía de voz de media línea por pueblo** (p. ej. Frostkin: frases cortas, sin adornos, la montaña como medida de todo; Sail Lords: labia de puerto, todo tiene precio). Cierra con las reglas de narración:

- Narrar solo lo que los deltas autorizan. No inventar muertes, batallas, tratados ni cambios de estado que no estén en la entrada. Los números se traducen a hechos, no se citan.
- Entre 120 y 190 palabras por turno.
- Registro por turno: crónica, rumor o carta (con encabezado y despedida), marcado en la primera línea como `[Crónica]`, `[Rumor]` o `[Carta]`. No repetir el mismo registro más de dos estaciones seguidas.
- Contar como testigo: una imagen concreta por estación; la voz del pueblo protagonista tiñe la prosa.
- Continuidad: lo narrado sigue siendo cierto hasta que los datos digan lo contrario; recuperar detalles y personas de estaciones anteriores.
- Personajes con nombre: como mucho uno nuevo por estación; una vez nombrado, existe y se mantiene.
- Cerrar cada estación con algo pendiente (una deuda, una amenaza, una pregunta), sin anunciarlo.
- Las estaciones sin acontecimientos también se narran.

Probado en vivo (3 estaciones encadenadas): ~15 s por turno, `stop_reason: end_turn`, caché de prompt enganchando desde el segundo turno (3.339 tokens leídos en el turno 2, 5.350 en el 3), y el modelo alterna registros y mantiene hilos entre turnos sin que se le pida explícitamente.

**User (por turno):** estación y año, estado de los pueblos afectados (stats como números, relaciones como etiqueta de §4.2), eventos sorteados con su delta, acciones del Cronista si las hubo, e hitos activos (guerras, alianzas, hambrunas).

### 7.5 Modo sin API key — "crónica seca"

Si no hay key configurada o la llamada falla, la simulación **sigue corriendo igual** y genera el texto del turno con plantillas determinísticas (`"La sequía golpea Caldrun Vale. La prosperidad de los Emberfolk cae 12 puntos."`). Nunca se bloquea el avance del turno por un problema de red o de credenciales.

## 8. Interfaz e impacto visual

**El impacto visual es un objetivo de primer nivel de este proyecto, a la altura de la calidad narrativa.** Un mapa correcto pero anodino cuenta como entrega fallida. La pieza tiene que sostenerse sola como objeto: algo que da ganas de mirar antes de entender qué hace.

### 8.1 Dirección de arte — diorama de bronce, "la intro de Juego de Tronos"

Referencia final: la secuencia de títulos de *Game of Thrones* — maqueta mecánica vista en picado, relieve esculpido con luz lateral, terrazas escalonadas bajo cada ciudad, engranajes y astrolabios de bronce, terreno en miniatura, rótulos dorados grabados y desenfoque tilt-shift en los bordes. Todo sobre fondo oscuro cálido, sin marcos ni cajas: la jerarquía la dan el espacio, la tipografía y la luz.

Se descartaron por el camino: "ceniza y estaño" (editorial, plano — aburrido), "grabado sobre página quemada" con paneles enmarcados (demasiadas cajas, no parecía un sitio moderno) y una primera paleta casi negra (demasiado oscura en general).

**Paleta**

| Nombre | Hex | Uso |
|---|---|---|
| carbón | `#1C1815` | Fondo. Marrón muy oscuro, no negro |
| brea | `#262019` / `#322A23` | Superficies secundarias (diálogo, chips) |
| hueso | `#F1E6CF` | Texto principal |
| ceniza | `#9E9284` | Texto secundario, etiquetas, rutas cerradas |
| oro | `#B58C36` | Rutas activas, alianzas, barras, subrayado de acciones |
| oro grabado | `#D8B872` | Nombres de región en el mapa, brújula |
| bronce | `#5A4736` → `#B0925C` | Terrazas, ciudadelas, astrolabio, engranajes |
| sangre | `#A11D1D` / `#D63A2A` | Botón primario, capitulares, guerra, hambruna, colapso |

Tinta de cada pueblo (se apaga hacia `#2C251F` cuando cae su prosperidad): Emberfolk `#A0562A`, Frostkin `#66788A`, River Clans `#437A76`, Highland `#735273`, Marsh Folk `#5C6C36`, Sail Lords `#3D5480`, Greywood `#3E6244`. Blasones en glifo para el POV y los selectores: ☀ ▲ ≋ ⚔ ☾ ⚓ ♣.

**Tipografía** — faces de sistema, sin assets: display `Cambria / Book Antiqua / Palatino Linotype / Georgia` en versalitas con tracking amplio para títulos, botones y etiquetas; lectura `Georgia / Cambria` a 17.5px (19px en la crónica más reciente), interlineado 1.58, medida ≤ 62ch, capitular en sangre.

**Composición** — sin paneles. Cabecera con sello, la estación como título de capítulo centrado (año en numerales romanos), influencia en sangre y un único botón sólido. Mapa dominante a la izquierda flotando sobre un halo de vela; acciones como texto con coste en oro y subrayado al pasar; columna de crónicas a la derecha separada por una línea de un píxel al 7 %. Viñeta radial suave y grano sobre todo. En móvil se apila.

**Elemento firma: el mapa como maqueta 2.5D.**

- El tablero se inclina con perspectiva CSS (`rotateX` ~22°) y sigue sutilmente al ratón; al entrar en una región se aplana y la cámara vuela hasta ella (animación del `viewBox`). Al cargar, la cámara arranca sobre Ashmere y se abre hasta el mundo entero.
- Las regiones son placas extruidas (cinco capas de canto oscuro) con borde irregular y un filtro de iluminación SVG (difusa + especular con luz distante desde el noroeste, más sombra proyectada) que las hace parecer esculpidas en bronce coloreado. Hachurado fino encima, como grabado.
- Terreno en miniatura por región: montañas con nieve en Vaerholt y Tharn Peak, bosque de conos en Greywood, juncos y agua en Duskmere, parcelas de cultivo en Caldrun Vale, el río que baja de Vaerholt y se abre en tres canales en el Delta, olas y un barco en Corvane Bay.
- Bajo cada ciudad, tres terrazas escalonadas; encima, una ciudadela con base de engranaje cuyas torres se alzan o se hunden según la prosperidad (una, dos o tres torres). Ashmere lleva además un astrolabio de bronce que gira despacio.
- Tilt-shift: una copia desenfocada del mundo enmascarada en las franjas superior e inferior; desaparece en el POV. Una luz cálida barre el tablero muy lentamente. Rótulos en oro grabado con halo de tinta.
- Rutas activas en oro que fluye; cerradas en puntos de ceniza; guerra en sangre con parpadeo lento, y arcos de conflicto entre pueblos no vecinos.
- Sin 3D real (WebGL a mano queda fuera del alcance de un solo archivo sin librerías); el efecto de maqueta sale de perspectiva, extrusión, iluminación y profundidad de campo.

**Motion** — intro de cámara, parallax del tablero, torres que suben y bajan, flujo de oro en las rutas, giro del astrolabio, barrido de luz, zoom POV y tinta que se seca en la crónica. `prefers-reduced-motion` lo apaga todo.

Restricciones que cumple esta dirección:

- Todo tiene que caber en `ashmere.html`: CSS inline, SVG inline, sin assets externos.
- El mundo es fantasía medieval de intriga política — frío, político, con peso. La dirección debe salir de ese material (cartografía antigua, sellos de cera, heráldica, registros contables de puerto), no de un tema visual genérico.
- **No** caer en los defaults que produce cualquier generador: fondo crema con serif de alto contraste y acento terracota; negro casi puro con un único acento verde ácido o bermellón; maqueta tipo periódico con filetes finos y cero radio de borde. Cualquiera de los tres es una opción legítima para otro brief, pero aquí serían la ausencia de una decisión.

### 8.2 Componentes

- **Mapa SVG inline** — 7 regiones como polígonos con posiciones fijas que respetan la topología de §3.1. El estado del mundo se lee del mapa sin tener que abrir un panel: prosperidad, guerras activas y rutas abiertas o cerradas deben ser legibles de un vistazo. Cómo se codifica cada uno lo decide la dirección de arte.
- **Clic en una región** — zoom "POV": el mapa se acerca a ese pueblo y aparecen sus stats, sus relaciones con los otros seis y sus últimas crónicas. La transición de zoom es uno de los pocos sitios donde vale la pena gastar animación.
- **Panel de estado** — estación y año, influencia disponible, acciones, y `Avanzar estación` como la acción principal e inconfundible de la pantalla.
- **Registro de crónicas** — la más reciente arriba, cada entrada con su estación y año. Es el corazón del test: el texto de Fable 5.1 se lee mucho, así que la columna de crónicas necesita medida de línea e interlineado tratados como tipografía editorial, no como log.
- **Estado de carga** — el turno se resuelve y los números se actualizan al instante; solo la prosa llega después. Esa espera es un momento de diseño, no un spinner: la crónica debe aparecer de una forma que se sienta parte de la pieza.

### 8.3 Suelo de calidad

Sin anunciarlo en la interfaz: responsive hasta móvil, foco de teclado visible, `prefers-reduced-motion` respetado, contraste suficiente para leer la prosa largo rato.

### 8.4 Texto de la interfaz

El texto de la UI es material de diseño, no relleno. Verbos en activa y en imperativo (`Avanzar estación`, no `Siguiente turno`), nombres constantes entre el botón y su resultado, sin mayúsculas de título. Los errores dicen qué pasó y cómo seguir — el aviso de API key inválida es una instrucción, no una disculpa. Los estados vacíos (antes del primer turno) invitan a actuar.

## 9. Persistencia

`localStorage`, clave `ashmere_state_v1`. Se guarda todo el estado: stats, matriz de relaciones, rutas, turno, influencia, semilla del PRNG, hitos, historial de crónicas y el array `messages` completo. Botón `Reiniciar` con confirmación. La API key se guarda aparte, en `ashmere_api_key`.

## 10. Criterios de aceptación

El one-shot se considera correcto si, al abrirlo:

1. Carga sin errores en consola y dibuja los 7 pueblos con la topología de §3.1.
2. `Avanzar estación` resuelve el turno completo en el orden de §5 y actualiza los números en pantalla.
3. Sin API key, el modo crónica seca produce texto y la partida avanza.
4. Con API key, cada turno genera una crónica de Fable 5.1 coherente con los deltas de ese turno.
5. Recargar la página restaura la partida exactamente donde estaba.
6. El array `messages` crece de forma append-only — verificable en consola.
7. La pieza tiene identidad visual propia: ejecuta la dirección de arte de §8.1, el mapa comunica el estado del mundo de un vistazo, y nada en pantalla se lee como una plantilla por defecto.

## 11. Decisiones de implementación no cubiertas arriba

Tomadas al construir; se anotan para que el comportamiento no parezca accidental:

- **Fin de guerra y de alianza** — la spec fija el umbral de entrada pero no el de salida. Se usa histéresis: una guerra termina cuando la relación sube por encima de −40; una alianza se disuelve cuando baja de +40. Ambos generan hito.
- **Caché del historial** — además del `cache_control` en el system, se envía `cache_control` a nivel raíz de la petición para que el historial acumulado también se cachee. Sin eso, la afirmación de §7.3 sobre el coste del historial no se cumple.
- **Alternancia de roles** — cuando la llamada falla o el modelo rechaza, la crónica seca se guarda también como turno `assistant` en `messages`. La API exige alternancia estricta user/assistant; sin esto la siguiente petición fallaría.
- **Un turno a la vez** — `Avanzar estación` se desactiva mientras hay una crónica pendiente. Las acciones del Cronista sí se permiten durante la espera; pertenecen al turno siguiente.
- **Recarga con crónica pendiente** — si se recarga la página con una petición en vuelo, la entrada huérfana se completa con crónica seca al cargar.
