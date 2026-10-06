# 🏁 Hackatones

Los hackatones en los que he participado: cada uno vive en su carpeta, con el código tal como quedó el día del evento y su documentación.

| Fecha | Evento | Reto | Stack | Resultado |
|---|---|---|---|---|
| 2026-08 | [Agents Bogotá](2026-08-agents-bogota/) | Analista financiero agéntico para una empresa de logística: informe de rentabilidad por proyecto, evaluado con un benchmark de 7 preguntas | Claude Agent SDK · Chainlit · pandas · Docker · Render | Por registrar |
| 2026-09 | [Fable 5.1](2026-09-fable-5-1/) | Prueba personal del modelo como narrador: *Ashmere*, simulación de mundo determinística en JS con mapa interactivo, donde Claude solo convierte eventos en prosa. Mide consistencia de voz, coherencia causal e impacto visual | HTML + CSS + JS vanilla + SVG · API de Anthropic desde el navegador · caché de prompt | Probado en vivo |
| 2026-10 | [Opus 5.5](2026-10-opus-5-5/) | Prueba personal del modelo en one-shot: *Bacatá → Bogotá*, el crecimiento de la ciudad en 10 hitos como un solo mapa 3D que cambia de materia con la época (oro, papel, ladrillo, luz). Mide impacto visual, ingeniería de la transformación y fidelidad a los hechos | HTML + CSS + JS vanilla · WebGL 2 a mano · Web Audio generativo | Por revisar |

## Estructura

```
hackatones/
├── 2026-08-agents-bogota/   # Un hackatón por carpeta: AAAA-MM-evento
├── 2026-09-fable-5-1/      # Prompt one-shot (definition.md) y su resultado (ashmere.html)
├── 2026-10-opus-5-5/       # Prompt one-shot (definition.md) y su resultado (bogota.html)
└── render.yaml              # Despliegue en Render (cada servicio apunta a su carpeta con rootDir)
```
