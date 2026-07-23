# Estudio Serenata — sitio cinemático

Prototipo de sitio "scroll-cinematic" para el negocio de canciones
personalizadas (rebrand propuesto de songstorylab.com), enfocado al
mercado hispano: quinceañeras, bodas, aniversarios, tributos.

## Ver el sitio

**Opción A (doble clic):** abre `index.html` directamente en el navegador.
**Opción B (recomendada):**

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
# abre http://localhost:8765
```

## Qué tiene de especial

- **Héroe scroll-scrubbed:** al hacer scroll, la escena se "reproduce" como
  película (la técnica de los sitios de Apple). Hoy usa una escena generativa
  en canvas (polvo dorado → onda de sonido → corazón → pétalos). Cuando
  agregues fotogramas de Higgsfield en `frames/hero/`, los usa automáticamente
  — ver `frames/hero/AGREGA-TUS-FRAMES.md`.
- **Reproductores reales:** los botones de muestra SÍ suenan — sintetizan
  guitarra (Karplus–Strong) en el navegador con visualizador en vivo.
  Coloca tus MP3 reales en `audio/vals.mp3`, `audio/cumbia.mp3`,
  `audio/balada.mp3` y el sitio los usa en lugar del demo.
- **Español impecable:** todos los acentos y la ñ donde van.
- **Cero dependencias de build:** HTML + CSS + JS planos + Lenis por CDN.
  Se puede hospedar en cualquier hosting estático (Vercel, Netlify,
  Cloudflare Pages, Replit static).

## Novedades v2 (jul 2026)

- **Corregido:** los MP3 reales en `audio/` ahora sí se reproducen (el
  detector anterior con `canplaythrough` nunca disparaba porque el navegador
  aborta la descarga del probe; ahora usa `loadedmetadata`). La nota de
  "demos sintetizados" se oculta sola cuando hay archivos reales.
- **Móvil estilo cash.app:** barra CTA fija inferior ("Crear mi canción →"
  + WhatsApp) que se oculta durante la película del héroe y cuando el CTA
  final ya está en pantalla; ocasiones en cuadrícula bento de 2 columnas;
  el paquete Serenata aparece primero.
- **Rendimiento:** los 179 fotogramas (~20 MB) ya no se descargan de golpe —
  carga progresiva (dispersos primero, huecos después, 6 a la vez) con
  fotograma más cercano como respaldo mientras llegan.
- **Accesibilidad:** respeta `prefers-reduced-motion` (sin scroll suave,
  película y grano estáticos).
- **SEO:** favicon, `theme-color`, `og:locale` y datos estructurados
  FAQPage (JSON-LD).
- **Flujo guiado "Crear mi canción":** todos los botones `#crear` abren un
  cuestionario de 4 pasos estilo cash.app (ocasión → persona → género →
  paquete + historia) que termina en WhatsApp con el resumen ya escrito.
  Las tarjetas de paquete preseleccionan su paquete. El número está en
  `WA_NUMBER` dentro de `cinematic.js` (¡cambiarlo por el real!).

## Novedades v3 (jul 2026)

- **Fotos emotivas** en `img/` (generadas con Higgsfield, estética de velas
  y vino/oro): tarjeta Quinceañera y Bodas con foto de fondo, y fotos sobre
  los dos testimonios. Marcadas como ilustrativas — igual que los
  testimonios, reemplazar con fotos de clientes reales al lanzar.
- **Barra de progreso en los reproductores:** tiempo transcurrido/total y
  clic para saltar a cualquier punto (solo con MP3 reales). Pausar y volver
  a reproducir ahora reanuda donde quedó.

## Pendientes antes de lanzar

- [ ] Decidir el nombre final y comprar dominio (ver conversación de marcas)
- [ ] Reemplazar testimonios ilustrativos por clientes reales
- [x] Subir muestras MP3 reales (vals / cumbia / balada) — jul 2026:
      "Mi Niña, Mi Reina" 4:26 · "Cincuenta Primaveras" 3:10 ·
      "Veinte Otoños" 3:53 (convertidas de WAV a MP3 192 kbps)
- [x] Héroe: escena generativa como versión definitiva — jul 23 2026: el
      clip de guitarra se veía desenfocado y barato; la escena generativa
      (polvo de oro → melodía → corazón → pétalos) pesa 0 bytes y es nítida
      en cualquier pantalla. Los fotogramas siguen en `frames/hero/`;
      `USE_HERO_FRAMES` en cinematic.js los reactiva si hace falta.
- [x] Conectar el flujo "Crear mi canción" al checkout — jul 16 2026:
      Stripe Payment Links en vivo (Verso/Serenata/Gran Gala) con códigos
      ESTRENO15 (15%, expira 15 ago), HOYSI10 ($10) y AMIGA20 ($20).
      El paso 4 redirige a Stripe con `client_reference_id` = Order ID,
      `locale=es` y ESTRENO15 pre-aplicado; WhatsApp quedó como opción
      secundaria "¿Prefieres hablar primero?".
- [ ] Desplegar `orders-backend.gs` (Apps Script → Google Sheet) y pegar la
      URL /exec en `ORDER_ENDPOINT` (cinematic.js) — mientras esté vacío,
      el flujo exige enviar el resumen por WhatsApp antes del pago para
      que el encargo nunca se pierda (jul 23 2026)
- [ ] Cambiar el nombre público de la cuenta Stripe a "Estudio Serenata"
      (hoy el checkout muestra "William Cordero"): Dashboard → Settings →
      Business details → Public business name (y statement descriptor)
- [x] Poner el número real de WhatsApp en los enlaces `wa.me` — jul 23 2026:
      407.205.7707 (provisional, centralizado en `WA_NUMBER` de cinematic.js;
      los tres enlaces estáticos de index.html también apuntan ahí)
- [ ] Versión en inglés en `/en/` con etiquetas hreflang
