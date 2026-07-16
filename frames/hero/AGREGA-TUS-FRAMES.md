# Cómo agregar el video cinemático de Higgsfield

El héroe del sitio funciona en dos modos:

1. **Modo generativo (actual):** sin archivos, el canvas dibuja la escena
   de partículas doradas (polvo → onda de sonido → corazón → pétalos).
2. **Modo fotogramas:** si este folder contiene `frame_0001.jpg` …
   `frame_0179.jpg`, el sitio los detecta automáticamente y el scroll
   "reproduce" tu clip de Higgsfield — sin tocar código.

## Pipeline (con el skill scroll-cinematic + Higgsfield MCP)

1. Genera el keyframe con `generate_image` (modelo `nano_banana_pro`, 16:9):
   > "Cinematic Latin serenade: a vintage Spanish guitar resting on a candlelit
   > quinceañera ballroom table, rose petals, golden bokeh, deep plum and wine
   > tones, gold accents, ultra sharp, photorealistic, 8k, editorial"

2. Genera el clip con `generate_video` (modelo `seedance_2_0`, 1080p, 16:9, 6s,
   start_image = keyframe). Movimiento sugerido:
   > "slow continuous dolly around the guitar as golden dust rises and swirls
   > into the air, candle flames flicker, rose petals drift, smooth camera,
   > deep parallax, no cuts"

3. Extrae y comprime los fotogramas (requiere ffmpeg — `winget install ffmpeg`):
   ```
   ffmpeg -i clip.mp4 -vf "fps=179/6,scale=1600:-2" -q:v 2 frame_%04d.jpg
   ```
   Coloca los JPG resultantes en este folder. Listo — recarga la página.

> Nota: ~180 fotogramas a 1600px / calidad q2-q3 ≈ 12–15 MB total. No subas
> más grande; el preload es lo que hace fluido el efecto.
