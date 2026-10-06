# Bacatá → Bogotá — cinco siglos de una ciudad en un mapa (test de Opus 5.5)

> **Este documento es un prompt one-shot.** Está cerrado: no quedan decisiones abiertas. Se entrega completo a Claude Opus 5.5 (`claude-opus-5-5`) con la instrucción de generar `bogota.html` en una sola pasada. Cualquier detalle no especificado aquí queda a criterio del implementador, pero nada de lo que sí está especificado es negociable.

## 1. Objetivo

Construir una pieza de storytelling visual sobre el crecimiento de Bogotá, de la sabana muisca a la primera línea del metro, contada como **un solo mapa que se transforma con el tiempo**. Un único control —una línea de tiempo que se arrastra— gobierna todo lo que hay en pantalla.

Se está probando específicamente:

- **Impacto visual** — que la pieza deslumbre como objeto: algo que da ganas de mirar antes de entender qué hace. Es el criterio principal; ver §6.
- **Ingeniería de la transformación** — que el paso entre épocas sea continuo y fluido (interpolación de formas, materiales y datos), no un carrusel de diez imágenes.
- **Fidelidad a los hechos** — que el modelo no invente historia. Los hechos de §3 y §4 son los únicos permitidos. Cualquier fecha, cifra, nombre o suceso que aparezca en pantalla y no esté en este documento cuenta como fallo.

En Ashmere (Fable 5.1) el modelo narraba y la lógica era fija. Aquí es al revés: los hechos están fijos y el modelo pone toda la dirección de arte, la animación y la interacción.

## 2. Entregable

| Aspecto | Decisión |
|---|---|
| Archivo | Uno solo: `bogota.html` |
| Stack | HTML + CSS + JS vanilla. SVG inline, Canvas 2D y WebGL escrito a mano están permitidos. Cero frameworks, cero librerías, cero build step, cero `npm` |
| Red | Cero peticiones externas: ni fuentes web, ni tiles de mapa, ni imágenes, ni APIs. Todo se dibuja con código |
| Ejecución | Funciona con doble clic (`file://`) y también servido por HTTP |
| Idioma | Español neutro con tuteo |
| Modo de entrega | One-shot: el archivo completo generado de una vez, funcional sin iteración posterior |

## 3. Los 10 hitos (hechos cerrados)

Cada hito es una "parada" de la línea de tiempo. El texto en pantalla de cada hito se redacta a partir de estos hechos y **solo de estos hechos**: se puede reformular, no ampliar.

| # | Año en la línea de tiempo | Título sugerido | Hechos permitidos |
|---|---|---|---|
| 1 | antes de 1538 | La sabana muisca | Territorio muisca. La sabana con sus humedales, el río Bogotá (Funza) al occidente y los cerros orientales al oriente. Bacatá era un asentamiento muisca de la sabana; de su nombre viene "Bogotá" |
| 2 | 1538–1539 | Dos fundaciones | 6 de agosto de 1538: Gonzalo Jiménez de Quesada levanta un campamento militar en el sitio que hoy se identifica con el Chorro de Quevedo. 27 de abril de 1539: fundación jurídica en el actual Parque Santander, con 12 chozas y una iglesia, tras la llegada de Sebastián de Belalcázar y Nicolás de Federmán. Los historiadores aún discuten cuál de las dos fechas es la fundación |
| 3 | 1800 | Santafé, capital virreinal | Santafé es la capital del Virreinato de la Nueva Granada. Pasa de 16.002 habitantes en 1778 a 21.464 en 1800. La ciudad es una cuadrícula atravesada por los ríos San Francisco y San Agustín |
| 4 | 1810 | El 20 de julio | 20 de julio de 1810, en la Plaza Mayor (hoy Plaza de Bolívar): el episodio del florero de Llorente desemboca en un cabildo abierto y en el grito de independencia |
| 5 | 1884–1912 | El tranvía | 24 de diciembre de 1884: empieza el tranvía de mulas, que va de la Plaza de Bolívar a Chapinero pasando por San Diego y la calle 26. En 1910 llega el tranvía eléctrico. Censo de 1912: 121.257 habitantes |
| 6 | 1938 | Un río se vuelve avenida | En 1915 el Gobierno ordena canalizar el río San Francisco; sobre él se construye la Avenida Jiménez, inaugurada en 1938 como la primera gran avenida de la ciudad. Censo de 1938: 330.312 habitantes |
| 7 | 1948 | El 9 de abril | 9 de abril de 1948: Jorge Eliécer Gaitán es asesinado en la carrera Séptima, cerca de la Avenida Jiménez. Siguen incendios, saqueos y cientos de muertos; se queman tranvías. Después se amplían calles del centro, entre ellas la Séptima desde la Plaza de Bolívar hasta San Diego. El tranvía deja de funcionar en 1951 |
| 8 | 1954 | Seis pueblos se vuelven ciudad | 17 de diciembre de 1954, Decreto Ley 3640: Bogotá pasa a ser Distrito Especial y se anexan seis municipios vecinos: Usaquén, Suba, Engativá, Fontibón, Bosa y Usme. Censo de 1964: 1.697.311 habitantes |
| 9 | 2000 | TransMilenio | 18 de diciembre de 2000: primer día de TransMilenio. 14 buses entre el Portal de la 80 y la estación Tercer Milenio por la troncal de la Avenida Caracas; 18.618 pasajeros ese día |
| 10 | 2018–2028 | La ciudad elevada | Censo de 2018: 7.181.469 habitantes. La primera línea del metro (unos 24 km, elevada, del suroccidente a la calle 72) tiene prevista su operación comercial para el 15 de marzo de 2028. Es el único hito en futuro: se marca como "previsto", nunca como hecho |

**Tono del hito 7.** Sobrio. Es violencia real con víctimas reales: nada de fuego espectacular, sangre ni dramatismo de videojuego. La pieza puede marcar la pérdida (por ejemplo, manzanas que se apagan o se vuelven ceniza y luego se reconstruyen más anchas), pero no la convierte en espectáculo.

## 4. Datos

### 4.1 Población (la curva que cuenta la historia)

Serie cerrada. Son los únicos números de población que pueden aparecer.

| Año | Habitantes | Fuente |
|---|---|---|
| 1778 | 16.002 | Estudios sobre Santafé ilustrada |
| 1800 | 21.464 | Estudios sobre Santafé ilustrada |
| 1912 | 121.257 | Censo |
| 1938 | 330.312 | Censo |
| 1964 | 1.697.311 | DANE |
| 1973 | 2.571.548 | DANE |
| 1985 | 3.982.941 | DANE |
| 1993 | 4.945.448 | DANE |
| 2005 | 6.778.691 | DANE |
| 2018 | 7.181.469 | DANE, CNPV 2018 |

No hay datos de población para los hitos 1 y 2, y la curva no los inventa: empieza en 1778. Entre puntos se interpola para la animación, pero el número que se muestra en pantalla como dato es siempre uno de la tabla (o se marca explícitamente como "entre censos").

La curva no es un gráfico aparte en un rincón: es parte de la línea de tiempo (ver §6.2). Escala logarítmica o lineal queda a criterio, pero la decisión tiene que hacer legible la explosión del siglo XX, que es el momento central de la historia.

### 4.2 Puntos del mapa (coordenadas aproximadas, WGS84)

Precisión de ±500 m: suficiente para un mapa estilizado. La proyección es equirectangular local alrededor de la Plaza de Bolívar (o la que el implementador prefiera, siempre que conserve las posiciones relativas).

| Punto | Lat | Lon | Aparece desde el hito |
|---|---|---|---|
| Plaza de Bolívar (Plaza Mayor) | 4.5981 | −74.0760 | 2 |
| Chorro de Quevedo | 4.5970 | −74.0688 | 2 |
| Parque Santander | 4.6023 | −74.0732 | 2 |
| Cerro de Monserrate | 4.6058 | −74.0556 | 1 |
| San Diego (calle 26 con Séptima) | 4.6136 | −74.0688 | 5 |
| Chapinero | 4.6486 | −74.0636 | 5 |
| Estación Tercer Milenio (Caracas con calle 6) | 4.5970 | −74.0820 | 9 |
| Portal de la 80 | 4.7110 | −74.1120 | 9 |
| Usaquén | 4.6950 | −74.0310 | 8 (como pueblo: desde el 1, en gris, sin rótulo hasta el 8) |
| Suba | 4.7410 | −74.0840 | 8 (ídem) |
| Engativá | 4.7070 | −74.1150 | 8 (ídem) |
| Fontibón | 4.6720 | −74.1440 | 8 (ídem) |
| Bosa | 4.6180 | −74.1880 | 8 (ídem) |
| Usme | 4.4750 | −74.1260 | 8 (ídem) |
| Metro, extremo norte (calle 72) | 4.6580 | −74.0670 | 10 |
| Metro, extremo suroccidental | 4.6300 | −74.2000 | 10 |

### 4.3 Geografía fija

- **Cerros orientales**: una cadena continua de norte a sur en el borde oriental, con Monserrate como referencia. La ciudad crece pegada a ellos y luego hacia el occidente.
- **Río Bogotá**: el borde occidental de la sabana, corriendo de norte a sur, unos 12–15 km al occidente de la Plaza de Bolívar.
- **Ríos San Francisco y San Agustín**: bajan de los cerros al centro histórico. El San Francisco se apaga como río en el hito 6, cuando se vuelve la Avenida Jiménez.
- **Humedales**: manchas de agua en la sabana occidental que se reducen a medida que la ciudad crece. Su forma exacta es ilustrativa.

### 4.4 La mancha urbana es ilustrativa

No hay polígonos históricos reales en este documento, y el modelo no debe fingir que los tiene. La forma de la ciudad en cada hito se dibuja de forma estilizada, respetando solo estas reglas:

- Hito 1: no hay ciudad, solo sabana.
- Hitos 2–4: un núcleo pequeño alrededor de la Plaza Mayor, pegado a los cerros, en cuadrícula. Crece muy poco entre el 2 y el 4.
- Hito 5: un eje alargado hacia el norte, siguiendo el tranvía hasta Chapinero.
- Hito 6: la ciudad se ensancha; el río San Francisco desaparece y aparece la avenida.
- Hito 8: la mancha alcanza y absorbe a los seis pueblos anexados.
- Hitos 9–10: la mancha cubre casi toda la sabana entre los cerros y el río Bogotá.

La pieza dice en algún lugar visible y discreto (por ejemplo, junto a las fuentes) que la forma de la ciudad es una ilustración y no un plano histórico.

## 5. Interacción

- **Línea de tiempo**: un único control que se arrastra (ratón, táctil y teclado con flechas). Tiene 10 paradas magnéticas, una por hito, pero se puede soltar entre dos paradas: el mapa muestra entonces un estado interpolado.
- **Reproducir**: un botón recorre los 10 hitos de forma automática, deteniéndose unos segundos en cada uno. Se pausa en cuanto el usuario toca la línea de tiempo.
- **Scroll**: la rueda del ratón (o el desplazamiento en móvil) también avanza por los hitos. Si se usa scrollytelling, el mapa se queda fijo y lo que avanza es el texto.
- **Puntos del mapa**: al pasar el ratón o hacer foco sobre un punto de §4.2, aparece su nombre y el hito en que entra en la historia.
- **Estado en la URL**: el hito actual se refleja en el hash (`#hito-6`), así que un enlace abre la pieza en ese momento.
- **Teclado**: todo se puede usar sin ratón, con un foco visible.

## 6. Interfaz e impacto visual

**El impacto visual es el objetivo de primer nivel de este proyecto.** Un mapa correcto pero anodino cuenta como entrega fallida.

### 6.1 Dirección de arte — "del oro muisca al ladrillo"

La idea central: **el material del mapa cambia con la época.** La ciudad no solo crece, también cambia de sustancia.

| Época (hitos) | Material del mapa | Referencia |
|---|---|---|
| Muisca (1) | Filigrana de oro sobre fondo oscuro: líneas finas, espirales, la sabana dibujada como una pieza de orfebrería | La orfebrería muisca (la balsa, los tunjos) |
| Colonia e independencia (2–4) | Tinta sepia sobre papel envejecido, como un plano manuscrito: hachurado, letra caligráfica, rosa de los vientos | Planos coloniales de Santafé |
| República y modernización (5–8) | Ladrillo y cal: el bloque urbano como relieve de ladrillo, la cuadrícula marcada | La Bogotá de ladrillo (Salmona, Las Torres del Parque) |
| Ciudad contemporánea (9–10) | La ciudad de noche desde los cerros: puntos de luz, troncales y la línea del metro como trazos luminosos | La vista nocturna desde Monserrate |

Las transiciones entre materiales son el momento estelar de la pieza: el oro se oxida en sepia, el papel se cuece en ladrillo, el ladrillo se enciende en luz. Nunca un corte seco ni un simple fundido entre dos imágenes.

Constantes en todas las épocas: los cerros orientales (siempre presentes, la referencia del espectador), la niebla de la sabana (capas que se mueven despacio) y la lluvia ocasional, sutil.

**Elemento firma**: la cámara. El mapa no se ve plano todo el tiempo: tiene una leve inclinación en perspectiva, como si se mirara la sabana desde Monserrate, y en cada hito la cámara se mueve hacia donde está pasando la historia (al Chorro de Quevedo en el 2, a la Plaza Mayor en el 4, a lo largo del tranvía en el 5, hacia el occidente en el 8).

**Tipografía**: solo fuentes de sistema, sin assets. La elección tiene que cambiar o adaptarse con la época (de lo caligráfico a lo moderno) sin perder coherencia.

**Restricciones**:

- Todo cabe en `bogota.html`: CSS inline, SVG o Canvas generados por código, sin imágenes externas.
- **No** caer en los defaults de cualquier generador: fondo crema con serif de alto contraste y acento terracota; negro casi puro con un único acento neón; maqueta tipo periódico con filetes finos. Tampoco un "dashboard" con tarjetas, ni un mapa de Leaflet imitado.
- Sin cajas ni paneles enmarcados: la jerarquía la dan el espacio, la tipografía y la luz.

### 6.2 Componentes

- **El mapa** domina la pantalla. El estado de la ciudad en cada momento se lee en el mapa, no en un panel.
- **La línea de tiempo** recorre el borde inferior y **lleva dentro la curva de población de §4.1**: el control y el gráfico son el mismo objeto. Al arrastrar, se ve a la vez en qué año estás y cuánta gente vivía en la ciudad.
- **El texto del hito**: título, año y 2–4 frases construidas solo con los hechos de §3. Medida de línea ≤ 60 caracteres. Aparece y desaparece con la transición, sin ventanas modales.
- **Contador de población**: el número del censo más cercano, animado al cambiar.
- **Fuentes**: una sección discreta, al final o desplegable, con las fuentes de §8 y el aviso de §4.4.

### 6.3 Suelo de calidad

Sin anunciarlo en la interfaz: responsive hasta móvil (en móvil el texto va debajo del mapa), 60 fps en un portátil normal, `prefers-reduced-motion` respetado (sin cámara ni partículas, transiciones cortas) y contraste suficiente en todas las épocas, incluida la nocturna.

### 6.4 Texto de la interfaz

El texto de la UI es material de diseño, no relleno. Verbos en imperativo (`Reproducir`, `Ver fuentes`), sin mayúsculas de título, sin signos de exclamación. La pantalla inicial invita a arrastrar la línea de tiempo sin necesidad de un tutorial.

## 7. Criterios de aceptación

El one-shot se considera correcto si, al abrirlo:

1. Carga con doble clic, sin errores en consola y sin una sola petición de red.
2. Los 10 hitos están presentes, en orden, con sus hechos de §3 y nada más. **Cero hechos inventados**: se revisa todo el texto visible contra §3 y §4.
3. La curva de población usa exactamente los 10 puntos de §4.1 y vive dentro de la línea de tiempo.
4. Los puntos de §4.2 están en sus posiciones relativas correctas (por ejemplo, Usme al sur, Suba al norte, Fontibón y Bosa al occidente, Monserrate al oriente).
5. Arrastrar la línea de tiempo entre dos hitos muestra un estado intermedio continuo; no hay saltos.
6. Las cuatro épocas de §6.1 se distinguen por su material, y las transiciones entre ellas se ven como transformaciones, no como fundidos.
7. El hito 7 tiene un tono sobrio, y el hito 10 marca el metro como previsto.
8. `#hito-N` en la URL abre la pieza en ese hito; se puede usar entera con teclado.
9. La pieza tiene identidad visual propia y deslumbra: nada en pantalla se lee como una plantilla por defecto.

## 8. Fuentes

Para la sección de fuentes de la pieza y para verificar el criterio 2:

- Fundaciones de 1538 y 1539: [Canal Trece](https://canaltrece.com.co/noticias/fundacion-bogota-historia-6-de-agosto/), [El Tiempo](https://www.eltiempo.com/bogota/historia-de-las-dos-fundaciones-de-santafe-de-bogota-154664)
- Población de Santafé en 1778 y 1800: [Universidad del Rosario, Santafé ilustrada](https://urosario.edu.co/revista-nova-et-vetera/cultura/santafe-ilustrada)
- Censos de 1912 a 2005: [DANE](https://www.dane.gov.co/files/pqr/Respuesta-202510008545.pdf); censo de 2018: [DANE, CNPV 2018](https://sitios.dane.gov.co/cnpv/app/views/informacion/fichas/11001.pdf)
- Tranvía de 1884, 1910 y 1951: [Alcaldía de Bogotá](https://bogota.gov.co/mi-ciudad/movilidad/los-medios-de-transporte-que-han-usado-los-ciudadanos-en-bogota-lo-l)
- Avenida Jiménez: [Alcaldía de Bogotá](https://bogota.gov.co/mi-ciudad/gestion-publica/avenida-jimenez-de-quesada-cumple-80-anos)
- 9 de abril de 1948: [Alcaldía de Bogotá](https://bogota.gov.co/mi-ciudad/gestion-publica/la-historia-del-bogotazo)
- Distrito Especial de 1954: [Hispanopedia, Distrito Especial de Bogotá](https://es.hispanopedia.com/wiki/Distrito_Especial_de_Bogot%C3%A1)
- TransMilenio: [Noticias RCN](https://www.noticiasrcn.com/colombia/transmilenio-celebra-su-cumpleanos-numero-25-este-18-de-diciembre-972880)
- Metro, fecha prevista: [Portafolio](https://www.portafolio.co/economia/infraestructura/metro-de-bogota-galan-revela-la-fecha-en-la-que-iniciaria-la-operacion-de-la-primera-linea-501736)

Hechos de conocimiento general sin cita específica: el 20 de julio de 1810 (hito 4) y el origen muisca del nombre (hito 1).
