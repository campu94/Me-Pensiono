/**
 * Backend de la app de finanzas personales.
 * Se pega en el editor de Apps Script vinculado a la Google Sheet
 * y se despliega como Web App (ver README.md para el paso a paso).
 */

// ---- Configuración ----
// El token se guarda en Propiedades del script, NO en este código,
// para que no quede expuesto si compartes el archivo. Ver README.
function getToken_() {
  return PropertiesService.getScriptProperties().getProperty('APP_TOKEN');
}

const SHEETS = {
  gastos: 'Gastos',
  ingresos: 'Ingresos',
  hipotecas: 'Hipotecas',
  pagosHipoteca: 'Pagos_Hipoteca',
  inversiones: 'Inversiones',
  uvr: 'UVR',
};

const HEADERS = {
  Gastos: ['ID', 'Fecha', 'Concepto', 'Descripcion', 'Monto', 'Categoria'],
  Ingresos: ['ID', 'Fecha', 'Concepto', 'Descripcion', 'Monto'],
  Hipotecas: ['ID', 'Nombre', 'Entidad', 'Monto Original', 'Tasa Interes Anual %', 'Plazo Meses', 'Cuota Mensual', 'Fecha Inicio', 'Saldo Actual', 'Monto Original UVR', 'Saldo Capital UVR'],
  Pagos_Hipoteca: ['ID', 'Fecha', 'Hipoteca ID', 'Monto Pago', 'Abono Capital', 'Abono Interes', 'Saldo Despues', 'Abono Capital UVR', 'Saldo UVR Despues'],
  Inversiones: ['ID', 'Nombre', 'Tipo', 'Monto Invertido', 'Fecha Inversion', 'Valor Actual', 'Fecha Actualizacion'],
  UVR: ['ID', 'Fecha', 'Valor UVR'],
};

function getSs_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet_(name) {
  const ss = getSs_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS[name]);
    sh.setFrozenRows(1);
  } else {
    ensureHeaders_(sh, name);
  }
  return sh;
}

// Agrega al final de la fila de encabezados cualquier columna nueva que se
// haya sumado a HEADERS después de que la hoja ya tenía datos, sin tocar
// las columnas ni filas existentes.
function ensureHeaders_(sh, name) {
  const wanted = HEADERS[name];
  if (!wanted) return;
  const lastCol = sh.getLastColumn();
  const current = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  const missing = wanted.filter((h) => current.indexOf(h) === -1);
  if (missing.length) {
    sh.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
}

function getLatestUVR_() {
  const sh = getOrCreateSheet_('UVR');
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return null;
  const idxValor = HEADERS.UVR.indexOf('Valor UVR');
  const last = data[data.length - 1];
  const val = Number(last[idxValor]);
  return val > 0 ? val : null;
}

function setupSheets() {
  Object.values(SHEETS).forEach(getOrCreateSheet_);
  buildResumenSheet_();
}

function buildResumenSheet_() {
  const ss = getSs_();
  let sh = ss.getSheetByName('Resumen');
  if (!sh) sh = ss.insertSheet('Resumen');
  sh.clear();
  sh.getRange('A1').setValue('Resumen Financiero');
  sh.getRange('A1').setFontWeight('bold').setFontSize(14);

  const rows = [
    ['Total Ingresos', '=SUM(Ingresos!E2:E)'],
    ['Total Gastos', '=SUM(Gastos!E2:E)'],
    ['Balance (Ingresos - Gastos)', '=B2-B3'],
    ['Deuda Hipotecaria Total', '=SUM(Hipotecas!I2:I)'],
    ['Valor Total Inversiones', '=SUM(Inversiones!F2:F)'],
    ['Monto Invertido (costo)', '=SUM(Inversiones!D2:D)'],
    ['Rendimiento Inversiones', '=B6-B7'],
    ['Patrimonio Neto (Balance + Inversiones - Deuda)', '=B4+B6-B5'],
  ];
  sh.getRange(2, 1, rows.length, 2).setValues(rows);
  sh.getRange(2, 1, rows.length, 1).setFontWeight('bold');
  sh.autoResizeColumns(1, 2);
}

// ---- Utilidades ----
function newId_() {
  return Utilities.getUuid();
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function checkAuth_(params) {
  const token = getToken_();
  if (!token) return true; // sin token configurado: sin protección (no recomendado)
  return params.token === token;
}

function appendRow_(sheetName, values) {
  const sh = getOrCreateSheet_(sheetName);
  sh.appendRow(values);
}

function sheetToObjects_(sheetName) {
  const sh = getOrCreateSheet_(sheetName);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i]));
    return obj;
  });
}

// ---- Entradas HTTP ----
function doGet(e) {
  const params = e.parameter || {};
  if (!checkAuth_(params)) return jsonOut_({ error: 'No autorizado' });

  const action = params.action;
  try {
    if (action === 'resumen') {
      const sh = getSs_().getSheetByName('Resumen');
      const data = sh.getRange('A2:B9').getValues();
      return jsonOut_({ ok: true, resumen: data.map(r => ({ label: r[0], value: r[1] })) });
    }
    if (action === 'list') {
      const which = params.sheet;
      const map = { gastos: 'Gastos', ingresos: 'Ingresos', hipotecas: 'Hipotecas', pagos: 'Pagos_Hipoteca', inversiones: 'Inversiones', uvr: 'UVR' };
      if (!map[which]) return jsonOut_({ error: 'Hoja desconocida' });
      return jsonOut_({ ok: true, data: sheetToObjects_(map[which]) });
    }
    return jsonOut_({ error: 'Acción desconocida' });
  } catch (err) {
    return jsonOut_({ error: err.message });
  }
}

function doPost(e) {
  let params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ error: 'JSON inválido' });
  }
  if (!checkAuth_(params)) return jsonOut_({ error: 'No autorizado' });

  const action = params.action;
  try {
    switch (action) {
      case 'addGasto':
        return addGasto_(params);
      case 'addIngreso':
        return addIngreso_(params);
      case 'addHipoteca':
        return addHipoteca_(params);
      case 'addPagoHipoteca':
        return addPagoHipoteca_(params);
      case 'addInversion':
        return addInversion_(params);
      case 'updateInversionValor':
        return updateInversionValor_(params);
      case 'addCotizacionUVR':
        return addCotizacionUVR_(params);
      case 'setSaldoUVR':
        return setSaldoUVR_(params);
      default:
        return jsonOut_({ error: 'Acción desconocida' });
    }
  } catch (err) {
    return jsonOut_({ error: err.message });
  }
}

// ---- Acciones ----
function addGasto_(p) {
  const id = newId_();
  appendRow_('Gastos', [id, p.fecha, p.concepto, p.descripcion || '', Number(p.monto), p.categoria || '']);
  return jsonOut_({ ok: true, id });
}

function addIngreso_(p) {
  const id = newId_();
  appendRow_('Ingresos', [id, p.fecha, p.concepto, p.descripcion || '', Number(p.monto)]);
  return jsonOut_({ ok: true, id });
}

function addHipoteca_(p) {
  const id = newId_();
  const montoOriginal = Number(p.montoOriginal);
  const montoOriginalUVR = Number(p.montoOriginalUVR) || '';
  const saldoUVR = montoOriginalUVR || '';
  appendRow_('Hipotecas', [
    id, p.nombre, p.entidad || '', montoOriginal, Number(p.tasaInteres) || 0,
    Number(p.plazoMeses) || 0, Number(p.cuotaMensual) || 0, p.fechaInicio, montoOriginal,
    montoOriginalUVR, saldoUVR,
  ]);
  return jsonOut_({ ok: true, id });
}

// Fija directamente el saldo en UVR de una hipoteca ya existente (para
// migrar créditos creados antes de que se agregara el seguimiento en UVR,
// usando los datos de un estado de cuenta real).
function setSaldoUVR_(p) {
  const sh = getOrCreateSheet_('Hipotecas');
  const data = sh.getDataRange().getValues();
  const idxId = HEADERS.Hipotecas.indexOf('ID');
  const idxMontoUVR = HEADERS.Hipotecas.indexOf('Monto Original UVR');
  const idxSaldoUVR = HEADERS.Hipotecas.indexOf('Saldo Capital UVR');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idxId] === p.hipotecaId) {
      if (p.montoOriginalUVR !== undefined) sh.getRange(i + 1, idxMontoUVR + 1).setValue(Number(p.montoOriginalUVR));
      sh.getRange(i + 1, idxSaldoUVR + 1).setValue(Number(p.saldoUVR));
      return jsonOut_({ ok: true });
    }
  }
  return jsonOut_({ error: 'Hipoteca no encontrada' });
}

function addPagoHipoteca_(p) {
  const sh = getOrCreateSheet_('Hipotecas');
  const data = sh.getDataRange().getValues();
  const idxId = HEADERS.Hipotecas.indexOf('ID');
  const idxSaldo = HEADERS.Hipotecas.indexOf('Saldo Actual');
  const idxSaldoUVR = HEADERS.Hipotecas.indexOf('Saldo Capital UVR');
  let rowIndex = -1;
  let saldoActual = 0;
  let saldoUVR = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][idxId] === p.hipotecaId) {
      rowIndex = i + 1;
      saldoActual = Number(data[i][idxSaldo]);
      saldoUVR = Number(data[i][idxSaldoUVR]) || 0;
      break;
    }
  }
  if (rowIndex === -1) return jsonOut_({ error: 'Hipoteca no encontrada' });

  const abonoCapital = Number(p.abonoCapital) || 0;
  const abonoInteres = Number(p.abonoInteres) || 0;
  const tieneAbonoUVR = p.abonoCapitalUVR !== undefined && p.abonoCapitalUVR !== '';
  const abonoCapitalUVR = tieneAbonoUVR ? Number(p.abonoCapitalUVR) : '';

  let nuevoSaldoUVR = saldoUVR;
  let nuevoSaldo;
  if (tieneAbonoUVR && saldoUVR > 0) {
    nuevoSaldoUVR = saldoUVR - Number(abonoCapitalUVR);
    const ultimaUVR = getLatestUVR_();
    nuevoSaldo = ultimaUVR ? nuevoSaldoUVR * ultimaUVR : saldoActual - abonoCapital;
  } else {
    nuevoSaldo = saldoActual - abonoCapital;
  }

  const id = newId_();
  appendRow_('Pagos_Hipoteca', [
    id, p.fecha, p.hipotecaId, Number(p.montoPago), abonoCapital, abonoInteres, nuevoSaldo,
    abonoCapitalUVR, tieneAbonoUVR && saldoUVR > 0 ? nuevoSaldoUVR : '',
  ]);
  sh.getRange(rowIndex, idxSaldo + 1).setValue(nuevoSaldo);
  if (tieneAbonoUVR && saldoUVR > 0) sh.getRange(rowIndex, idxSaldoUVR + 1).setValue(nuevoSaldoUVR);
  return jsonOut_({ ok: true, id, saldoActual: nuevoSaldo });
}

// Registra una nueva cotización de la UVR y recalcula en pesos el saldo de
// todas las hipotecas que llevan seguimiento en UVR (Saldo Capital UVR > 0).
function addCotizacionUVR_(p) {
  const id = newId_();
  const valorUVR = Number(p.valorUVR);
  appendRow_('UVR', [id, p.fecha, valorUVR]);

  const sh = getOrCreateSheet_('Hipotecas');
  const data = sh.getDataRange().getValues();
  const idxSaldo = HEADERS.Hipotecas.indexOf('Saldo Actual');
  const idxSaldoUVR = HEADERS.Hipotecas.indexOf('Saldo Capital UVR');
  let actualizadas = 0;
  for (let i = 1; i < data.length; i++) {
    const saldoUVR = Number(data[i][idxSaldoUVR]);
    if (saldoUVR > 0) {
      sh.getRange(i + 1, idxSaldo + 1).setValue(saldoUVR * valorUVR);
      actualizadas++;
    }
  }
  return jsonOut_({ ok: true, id, actualizadas });
}

function addInversion_(p) {
  const id = newId_();
  const monto = Number(p.montoInvertido);
  appendRow_('Inversiones', [id, p.nombre, p.tipo || '', monto, p.fechaInversion, monto, p.fechaInversion]);
  return jsonOut_({ ok: true, id });
}

function updateInversionValor_(p) {
  const sh = getOrCreateSheet_('Inversiones');
  const data = sh.getDataRange().getValues();
  const idxId = HEADERS.Inversiones.indexOf('ID');
  const idxValor = HEADERS.Inversiones.indexOf('Valor Actual');
  const idxFecha = HEADERS.Inversiones.indexOf('Fecha Actualizacion');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idxId] === p.inversionId) {
      sh.getRange(i + 1, idxValor + 1).setValue(Number(p.valorActual));
      sh.getRange(i + 1, idxFecha + 1).setValue(p.fecha || new Date());
      return jsonOut_({ ok: true });
    }
  }
  return jsonOut_({ error: 'Inversión no encontrada' });
}
