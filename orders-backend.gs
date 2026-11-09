/**
 * @OnlyCurrentDoc
 *
 * Estudio Serenata — backend de pedidos (Google Apps Script)
 * Recibe el POST del formulario "Crear mi canción" (cinematic.js) y guarda
 * cada pedido como una fila en Google Sheets, con aviso por correo.
 *
 * IMPORTANTE: cada fila es un pedido REGISTRADO antes del pago, no un pedido
 * pagado. Quien abandona el checkout de Stripe también deja su fila. Para saber
 * si se pagó, busca el Order ID en Stripe (client_reference_id).
 *
 * COLUMNAS: se escriben POR NOMBRE de encabezado (lista FIELDS abajo).
 *   - Puede MOVER columnas en la hoja como quiera: los pedidos siguen cayendo bien.
 *   - NO cambie el TEXTO de un encabezado: se crearía una columna nueva.
 *   - Si falta un encabezado, se agrega solo al final de la fila 1.
 *
 * CÓMO DESPLEGAR (la primera vez, ~5 minutos):
 * 1. En sheets.google.com crea una hoja nueva: "Pedidos Estudio Serenata".
 * 2. En esa hoja: Extensiones → Apps Script. Borra el contenido y pega este
 *    archivo completo. Guarda (💾).
 * 3. Implementar → Nueva implementación → ⚙ tipo "Aplicación web":
 *      - Ejecutar como: Yo (tu cuenta)
 *      - Quién tiene acceso: Cualquier usuario
 *    Autoriza los permisos.
 * 4. Copia la URL que termina en /exec y pégala en ORDER_ENDPOINT (cinematic.js).
 *
 * PARA ACTUALIZAR este script (la URL /exec sigue siendo la misma):
 *   pega el código nuevo → Guarda → Implementar → Administrar implementaciones →
 *   ✏ editar → Versión: "Nueva versión" → Implementar.
 *
 * @OnlyCurrentDoc limita el permiso a ESTA hoja (no a todo tu Drive).
 */

const NOTIFY_EMAIL = "william@songstorylab.com"; // "" para desactivar avisos
const SHEET_NAME = "Pedidos";
const ORDER_ID_RE = /^ES-[A-Z0-9]+-[A-Z0-9]{1,4}$/; // formato de newOrderId() en cinematic.js
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;
const MAX_LEN = 300; // límite por campo, salvo los textos largos de la historia

/* Encabezado → valor. El orden solo importa en una hoja nueva (vacía). */
const FIELDS = [
  { h: "Recibido",             v: () => new Date() }, // hora del servidor
  { h: "Order ID",             v: d => clean(d.orderId) },
  { h: "Estado",               v: () => "NUEVO" },   // a mano: PAGADO → EN PRODUCCIÓN → LISTO → ENTREGADO
  { h: "Ocasión",              v: d => clean(d.ocasion) },
  { h: "Para",                 v: d => clean(d.para) },
  { h: "Nombre",               v: d => clean(d.nombre) },
  { h: "Apodo",                v: d => clean(d.apodo) },
  { h: "De parte de",          v: d => clean(d.deParte) },
  { h: "Email",                v: d => clean(d.email, 120) },
  { h: "WhatsApp",             v: d => clean(d.telefono, 30) },
  { h: "Género",               v: d => clean(d.genero) },
  { h: "Ánimo",                v: d => clean(d.animo) },
  { h: "Voz",                  v: d => clean(d.voz) },
  { h: "Idioma de la canción", v: d => clean(d.idiomaCancion) },
  { h: "Fecha del evento",     v: d => clean(d.fechaEvento) },
  { h: "Paquete",              v: d => clean(d.paquete) },
  { h: "Historia",             v: d => clean(d.historia, 1000) },
  { h: "Qué la hace especial", v: d => clean(d.especial, 800) },
  { h: "Frases",               v: d => clean(d.frases, 600) },
  { h: "Otros nombres",        v: d => clean(d.otrosNombres) },
  { h: "Evitar",               v: d => clean(d.evitar) },
  { h: "Idioma",               v: d => clean(d.idioma) }, // idioma en que el cliente usó el sitio
  { h: "Página",               v: d => clean(d.pagina) }
];

function doPost(e) {
  let d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, error: "json" });
  }
  /* endpoint público: solo aceptamos pedidos con el formato que genera el sitio */
  if (!d || !ORDER_ID_RE.test(String(d.orderId || ""))) {
    return jsonOut({ ok: false, error: "orderId" });
  }

  let saved = false;
  try {
    appendOrder(getSheet(), d);
    saved = true;
  } catch (err) {
    console.error("No se pudo guardar el pedido " + d.orderId + ": " + err);
  }

  /* El correo es el canal de respaldo: si la hoja falla, el pedido completo
     llega igual por correo y nada se pierde. */
  notify(d, saved);

  /* ok:false hace que el sitio active el respaldo obligatorio por WhatsApp
     antes del pago. Nunca respondemos ok:true si la fila no quedó guardada. */
  return jsonOut(saved ? { ok: true, orderId: d.orderId } : { ok: false, error: "sheet" });
}

/* Prueba de salud: abre la URL /exec en el navegador.
   Verifica de verdad que la hoja es accesible (no solo que el script responde). */
function doGet() {
  try {
    getSheet();
    return jsonOut({ ok: true, servicio: "Estudio Serenata — pedidos" });
  } catch (err) {
    console.error("Prueba de salud falló: " + err);
    return jsonOut({ ok: false, error: "sheet" });
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("El script no está vinculado a una hoja (créalo desde Extensiones → Apps Script)");
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(FIELDS.map(f => f.h));
    sh.setFrozenRows(1);
  }
  return sh;
}

/* Escribe el pedido según los encabezados de la fila 1 (no según la posición). */
function appendOrder(sh, d) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  FIELDS.forEach(f => {
    if (headers.indexOf(f.h) === -1) {
      headers.push(f.h);
      sh.getRange(1, headers.length).setValue(f.h);
    }
  });
  const row = headers.map(h => {
    const f = FIELDS.find(x => x.h === h);
    return f ? f.v(d) : "";
  });
  sh.appendRow(row);
}

/* Texto seguro para la hoja: recorta el largo y neutraliza fórmulas.
   Sin esto, un texto que empiece con = + - @ se ejecutaría como fórmula
   (p. ej. =IMPORTXML(...)). El apóstrofo inicial lo guarda como texto y no se ve. */
function clean(v, max) {
  let s = (v == null ? "" : String(v)).slice(0, max || MAX_LEN).trim();
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function notify(d, saved) {
  if (!NOTIFY_EMAIL) return;
  const id = String(d.orderId || "sin ID");
  const customerEmail = String(d.email || "").trim();
  const canReply = EMAIL_RE.test(customerEmail);
  const subject = saved
    ? "🎶 Nuevo pedido registrado — " + id + " (" + (d.paquete || "?") + ")"
    : "⚠ Pedido NO guardado en la hoja — " + id + " — revísalo";
  const lead = saved
    ? "Alguien completó el formulario y va rumbo al pago.\nTodavía NO está pagado: confírmalo en Stripe."
    : "La hoja NO pudo guardar este pedido. Aquí van todos los datos para que no se pierda.\n" +
      "El cliente fue enviado a WhatsApp antes del pago. Revisa la hoja y el registro de ejecuciones del script.";
  const line = (label, value) => value ? label + value + "\n" : "";
  const block = (label, value) => value ? "\n" + label + "\n" + value + "\n" : "";
  const para = (d.para || "") + (d.nombre ? " — " + d.nombre : "") + (d.apodo ? " (" + d.apodo + ")" : "");
  const body =
    lead + "\n\n" +
    (canReply ? "↩ Responde a este correo para escribirle directo al cliente.\n\n" : "") +
    "Order ID: " + id + "\n" +
    line("Paquete:  ", d.paquete) +
    line("Ocasión:  ", d.ocasion) +
    line("Para:     ", para) +
    line("De parte: ", d.deParte) +
    line("Fiesta:   ", d.fechaEvento) +
    "\nCONTACTO\n" +
    line("Email:    ", customerEmail) +
    line("WhatsApp: ", d.telefono) +
    "\nSONIDO\n" +
    line("Género:   ", d.genero) +
    line("Ánimo:    ", d.animo) +
    line("Voz:      ", d.voz) +
    line("Idioma:   ", d.idiomaCancion) +
    block("HISTORIA", d.historia || "(sin historia)") +
    block("QUÉ LA HACE ESPECIAL", d.especial) +
    block("FRASES / DICHOS", d.frases) +
    block("OTROS NOMBRES", d.otrosNombres) +
    block("EVITAR", d.evitar) +
    "\nBusca este Order ID en Stripe → Pagos (client_reference_id) para confirmar el pago.";
  const mail = { to: NOTIFY_EMAIL, subject: subject, body: body };
  if (canReply) mail.replyTo = customerEmail;
  try {
    MailApp.sendEmail(mail);
  } catch (err) {
    console.error("No se pudo enviar el aviso de " + id + ": " + err);
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
