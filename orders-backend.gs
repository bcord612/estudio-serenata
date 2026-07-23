/**
 * Estudio Serenata — backend de pedidos (Google Apps Script)
 * Recibe el POST del formulario "Crear mi canción" (cinematic.js) y guarda
 * cada pedido como una fila en Google Sheets, con aviso por correo.
 *
 * CÓMO DESPLEGAR (una sola vez, ~5 minutos):
 * 1. Crea una hoja en sheets.google.com llamada "Pedidos Estudio Serenata".
 *    Copia el ID de la hoja (la cadena larga en la URL, entre /d/ y /edit)
 *    y pégalo abajo en SHEET_ID.
 * 2. Ve a script.google.com → "Nuevo proyecto", borra el contenido y pega
 *    este archivo completo. Ponle nombre al proyecto.
 * 3. Implementar → Nueva implementación → ⚙ tipo "Aplicación web":
 *      - Ejecutar como: Tú (tu cuenta)
 *      - Quién tiene acceso: Cualquier persona
 *    Autoriza los permisos cuando lo pida.
 * 4. Copia la URL que termina en /exec y pégala en ORDER_ENDPOINT
 *    al inicio de la sección de pago en cinematic.js.
 * 5. Prueba: completa el formulario del sitio; debe aparecer una fila nueva
 *    en la hoja y llegar un correo de aviso ANTES de llegar al pago.
 *
 * NOTA: si editas este script después, necesitas "Administrar implementaciones"
 * → editar → nueva versión, para que la URL /exec sirva el código nuevo.
 */

const SHEET_ID = "PEGA_AQUI_EL_ID_DE_LA_HOJA";
const NOTIFY_EMAIL = "billycordero@gmail.com"; // "" para desactivar avisos
const SHEET_NAME = "Pedidos";
const HEADERS = [
  "Fecha", "Order ID", "Estado", "Ocasión", "Para", "Nombre",
  "Género", "Fecha del evento", "Paquete", "Historia", "Página"
];

function doPost(e) {
  let d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, error: "JSON inválido" });
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }

  sh.appendRow([
    d.fecha || new Date().toISOString(),
    d.orderId || "",
    "NUEVO", // el estado avanza a mano o vía Make: PAGADO → EN PRODUCCIÓN → LISTO → ENTREGADO → FAN
    d.ocasion || "",
    d.para || "",
    d.nombre || "",
    d.genero || "",
    d.fechaEvento || "",
    d.paquete || "",
    d.historia || "",
    d.pagina || ""
  ]);

  if (NOTIFY_EMAIL) {
    try {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: "🎶 Nuevo pedido en camino — " + (d.orderId || "sin ID") + " (" + (d.paquete || "?") + ")",
        body:
          "Alguien completó el formulario y va rumbo al pago.\n\n" +
          "Order ID: " + (d.orderId || "") + "\n" +
          "Ocasión:  " + (d.ocasion || "") + "\n" +
          "Para:     " + (d.para || "") + (d.nombre ? " — " + d.nombre : "") + "\n" +
          "Género:   " + (d.genero || "") + "\n" +
          "Fiesta:   " + (d.fechaEvento || "") + "\n" +
          "Paquete:  " + (d.paquete || "") + "\n\n" +
          "Historia:\n" + (d.historia || "(sin historia)") + "\n\n" +
          "Confirma el pago en Stripe buscando este Order ID en client_reference_id."
      });
    } catch (err) { /* el aviso es opcional; la fila ya quedó guardada */ }
  }

  return jsonOut({ ok: true, orderId: d.orderId || null });
}

/* GET de cortesía para probar que el despliegue responde */
function doGet() {
  return jsonOut({ ok: true, servicio: "Estudio Serenata — pedidos" });
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
