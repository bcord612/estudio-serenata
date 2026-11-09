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
 * CÓMO DESPLEGAR (una sola vez, ~5 minutos):
 * 1. En sheets.google.com crea una hoja nueva: "Pedidos Estudio Serenata".
 * 2. En esa hoja: Extensiones → Apps Script. Borra el contenido y pega este
 *    archivo completo. Guarda (💾).
 *    (El script queda VINCULADO a la hoja: no hace falta copiar ningún ID.)
 * 3. Implementar → Nueva implementación → ⚙ tipo "Aplicación web":
 *      - Ejecutar como: Yo (tu cuenta)
 *      - Quién tiene acceso: Cualquier usuario
 *    Autoriza los permisos. Google avisará "app no verificada": es tu propio
 *    script → Configuración avanzada → Ir a (nombre del proyecto).
 * 4. Copia la URL que termina en /exec y pégala en ORDER_ENDPOINT (cinematic.js).
 * 5. Prueba: abre la URL /exec en el navegador → debe responder {"ok":true,...}.
 *
 * Si editas este script después: Implementar → Administrar implementaciones →
 * ✏ editar → Versión: "Nueva versión". Así la URL /exec sigue siendo la misma.
 *
 * @OnlyCurrentDoc limita el permiso a ESTA hoja (no a todo tu Drive).
 */

const NOTIFY_EMAIL = "william@songstorylab.com"; // "" para desactivar avisos
const SHEET_NAME = "Pedidos";
const HEADERS = [
  "Recibido", "Order ID", "Estado", "Ocasión", "Para", "Nombre",
  "Género", "Fecha del evento", "Paquete", "Idioma", "Historia", "Página"
];
const ORDER_ID_RE = /^ES-[A-Z0-9]+-[A-Z0-9]{1,4}$/; // formato de newOrderId() en cinematic.js
const MAX_LEN = 300;           // límite por campo
const MAX_LEN_HISTORIA = 4000; // la historia puede ser larga

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

  const row = [
    new Date(), // hora del servidor: la del navegador del cliente puede estar mal
    clean(d.orderId),
    "NUEVO", // avanza a mano: PAGADO → EN PRODUCCIÓN → LISTO → ENTREGADO
    clean(d.ocasion),
    clean(d.para),
    clean(d.nombre),
    clean(d.genero),
    clean(d.fechaEvento),
    clean(d.paquete),
    clean(d.idioma),
    clean(d.historia, MAX_LEN_HISTORIA),
    clean(d.pagina)
  ];

  let saved = false;
  try {
    getSheet().appendRow(row);
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
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

/* Texto seguro para la hoja: recorta el largo y neutraliza fórmulas.
   Sin esto, una "historia" que empiece con = + - @ se ejecutaría como fórmula
   (p. ej. =IMPORTXML(...)). El apóstrofo inicial la guarda como texto y no se ve. */
function clean(v, max) {
  let s = (v == null ? "" : String(v)).slice(0, max || MAX_LEN).trim();
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function notify(d, saved) {
  if (!NOTIFY_EMAIL) return;
  const id = String(d.orderId || "sin ID");
  const subject = saved
    ? "🎶 Nuevo pedido registrado — " + id + " (" + (d.paquete || "?") + ")"
    : "⚠ Pedido NO guardado en la hoja — " + id + " — revísalo";
  const lead = saved
    ? "Alguien completó el formulario y va rumbo al pago.\nTodavía NO está pagado: confírmalo en Stripe."
    : "La hoja NO pudo guardar este pedido. Aquí van todos los datos para que no se pierda.\n" +
      "El cliente fue enviado a WhatsApp antes del pago. Revisa la hoja y el registro de ejecuciones del script.";
  try {
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: subject,
      body:
        lead + "\n\n" +
        "Order ID: " + id + "\n" +
        "Ocasión:  " + (d.ocasion || "") + "\n" +
        "Para:     " + (d.para || "") + (d.nombre ? " — " + d.nombre : "") + "\n" +
        "Género:   " + (d.genero || "") + "\n" +
        "Fiesta:   " + (d.fechaEvento || "") + "\n" +
        "Paquete:  " + (d.paquete || "") + "\n" +
        "Idioma:   " + (d.idioma || "") + "\n\n" +
        "Historia:\n" + (d.historia || "(sin historia)") + "\n\n" +
        "Busca este Order ID en Stripe → Pagos (client_reference_id) para confirmar el pago."
    });
  } catch (err) {
    console.error("No se pudo enviar el aviso de " + id + ": " + err);
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
