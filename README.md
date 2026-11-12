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
- [x] Testimonios ilustrativos quitados del sitio — nov 11 2026. Agregar reseñas reales (con permiso) cuando existan.
- [x] Subir muestras MP3 reales (vals / cumbia / balada) — jul 2026:
      "Mi Niña, Mi Reina" 4:26 · "Cincuenta Primaveras" 3:10 ·
      "Veinte Otoños" 3:53 (convertidas de WAV a MP3 192 kbps)
- [x] Héroe cinematográfico definitivo — jul 23 2026: guitarra pintada de
      rosas nítida en primer plano con la fiesta de quince borrosa detrás
      (Higgsfield soul_2 + kling3_0_turbo). Capas: foto póster (~230-270KB,
      `img/hero-portrait.jpg` / `hero-landscape.jpg`) → vídeo cinemagráfico
      en bucle (~0.3-0.4MB, `hero-loop-portrait.mp4` / `hero-loop-landscape.mp4`)
      → partículas generativas (melodía → corazón → pétalos) encima, con
      Ken Burns ligado al scroll y scrim progresivo. saveData/2g: escena
      generativa pura sin descargas; reduced-motion: foto fija.
      El clip viejo de guitarra (`frames/hero/`) se quitó del repo para el
      despliegue; sigue en el historial: `git checkout da9be23 -- frames/`.
- [x] Conectar el flujo "Crear mi canción" al checkout — jul 16 2026:
      Stripe Payment Links en vivo (Verso/Serenata/Gran Gala) con códigos
      ESTRENO15 (15%, expira 15 ago), HOYSI10 ($10) y AMIGA20 ($20).
      El paso 4 redirige a Stripe con `client_reference_id` = Order ID,
      `locale=es` y ESTRENO15 pre-aplicado; WhatsApp quedó como opción
      secundaria "¿Prefieres hablar primero?".
- [x] Desplegar `orders-backend.gs` — nov 2026: Apps Script vinculado a la hoja
      "Pedidos Estudio Serenata" (cuenta william@songstorylab.com), avisos por
      correo a william@songstorylab.com. El sitio ahora LEE la respuesta
      `{ok:true}` (antes no-cors): si la hoja falla, se activa el respaldo por
      WhatsApp. Valida el Order ID, neutraliza fórmulas, guarda el idioma.
      Compra real de prueba ($39 Verso, ES-MW9DAJWU-KF1W) verificada de punta a punta.
- [x] Nombre público de Stripe = "Estudio Serenata" (verificado en el checkout).
- [x] Descuento de lanzamiento renovado: ESTRENO15 venció el 15 ago sin que el
      banner se actualizara. Ahora ESTRENO20 (20%, cupón "Lanzamiento 20%"),
      vence el 4 feb 2027 23:59 ET; banner y `PREFILL_PROMO` apuntan a él.
      **Al vencer: quitar el banner de index.html y vaciar PREFILL_PROMO.**
- [x] Página de gracias propia — nov 9 2026: `gracias.html` (servida en /gracias).
      Los 3 Payment Links redirigen ahí al pagar (after_completion = redirect).
      Promete confirmación por WhatsApp en 48 h, entrega 7–10 días (Gran Gala 72 h)
      por correo, y muestra Order ID, nombre y el correo de entrega.
- [x] Formulario completo — nov 9 2026: 8 pasos con contacto (correo + WhatsApp,
      obligatorios) y todos los detalles de la canción (sonido, historia guiada).
      Obligatorios: nombre, género, correo, WhatsApp; el resto con aviso suave.
      Backend v2 escribe por nombre de encabezado (columnas reordenables;
      no renombrar encabezados).
- [ ] La hoja registra pedidos ANTES del pago: quien abandona el checkout también
      deja fila. Falta marcar PAGADO automáticamente (webhook de Stripe
      checkout.session.completed → buscar el Order ID en la hoja).
- [x] Poner el número real de WhatsApp en los enlaces `wa.me` — jul 23 2026:
      407.205.7707 (provisional, centralizado en `WA_NUMBER` de cinematic.js;
      los tres enlaces estáticos de index.html también apuntan ahí)
- [ ] Versión en inglés en `/en/` con etiquetas hreflang

## Novedades nov 11 2026 (tras estudiar ForeverSongs)

- Registro "tú" en todo el sitio, el formulario y /gracias.
- Entrega: 48 h estándar (Verso y Serenata), 24 h prioritaria (Gran Gala). El paso
  "La fecha" ahora tiene "En menos de 48 horas" como opción urgente (índice 0).
- Transparencia: el sitio dice que las canciones se hacen con herramientas de IA y
  que una persona revisa cada una (FAQ, paso 2, meta description, términos).
- Reembolso: revisiones primero; reembolso del 100% si se pide dentro de 14 días
  de la entrega. Verso ahora incluye 1 revisión.
- Páginas nuevas: /privacidad y /terminos (ES/EN), enlazadas en el pie.
- Géneros y ocasiones para PR/Miami: salsa, merengue, plena, aguinaldo navideño;
  ocasiones Navidad y "Te amo / Porque sí". og:locale es_US.
- Quitada la nota de desarrollador sobre `audio/*.mp3` (los MP3 reales ya existen).
- [ ] Revisar que las descripciones de los productos en Stripe no prometan 7–10 días.
- [ ] Que un abogado revise /privacidad y /terminos; agregar un correo de contacto.
