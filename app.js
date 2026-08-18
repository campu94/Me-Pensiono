const CFG = window.APP_CONFIG;
const money = (n) => (Number(n) || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const moneyUVR = (n) => (Number(n) || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 4, maximumFractionDigits: 4 });
const todayISO = () => new Date().toISOString().slice(0, 10);

function toast(msg, isError) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => (el.className = 'toast'), 2600);
}

function configReady() {
  return CFG.SCRIPT_URL && !CFG.SCRIPT_URL.startsWith('PEGA_AQUI');
}

async function apiGet(action, extraParams) {
  const params = new URLSearchParams({ action, token: CFG.TOKEN, ...extraParams });
  const res = await fetch(`${CFG.SCRIPT_URL}?${params.toString()}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

async function apiPost(action, payload) {
  const res = await fetch(CFG.SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS con Apps Script
    body: JSON.stringify({ action, token: CFG.TOKEN, ...payload }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

// ---- Navegación por pestañas ----
const titles = { resumen: 'Resumen', gastos: 'Gastos', ingresos: 'Ingresos', hipotecas: 'Hipotecas', inversiones: 'Inversiones' };

function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelectorAll('nav.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  document.getElementById('view-title').textContent = titles[name];
  refreshView(name);
}

document.querySelectorAll('nav.tabbar button').forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

function refreshView(name) {
  if (!configReady()) {
    toast('Falta configurar config.js con la URL del backend', true);
    return;
  }
  if (name === 'resumen') loadResumen();
  if (name === 'gastos') loadGastos();
  if (name === 'ingresos') loadIngresos();
  if (name === 'hipotecas') loadHipotecas();
  if (name === 'inversiones') loadInversiones();
}

// ---- Resumen ----
async function loadResumen() {
  const liquidezGrid = document.getElementById('liquidez-grid');
  const patrimonioGrid = document.getElementById('patrimonio-grid');
  try {
    const { resumen } = await apiGet('resumen');
    const get = (label) => resumen.find((r) => r.label === label)?.value || 0;
    const balance = get('Balance (Ingresos - Gastos)');
    const patrimonio = get('Patrimonio Neto (Balance + Inversiones - Deuda)');

    liquidezGrid.innerHTML = `
      <div class="summary-tile"><div class="label">Ingresos</div><div class="value positive">${money(get('Total Ingresos'))}</div></div>
      <div class="summary-tile"><div class="label">Gastos</div><div class="value negative">${money(get('Total Gastos'))}</div></div>
      <div class="summary-tile wide"><div class="label">Balance</div><div class="value ${balance >= 0 ? 'positive' : 'negative'}" style="font-size:1.5rem">${money(balance)}</div></div>
    `;

    const deudaUVR = get('Deuda Hipotecaria UVR');
    patrimonioGrid.innerHTML = `
      <div class="summary-tile">
        <div class="label">Deuda hipotecaria</div>
        <div class="value negative">${money(get('Deuda Hipotecaria Total'))}</div>
        ${deudaUVR ? `<div class="tile-sub">${deudaUVR.toLocaleString('es-CO', { maximumFractionDigits: 2 })} UVR</div>` : ''}
      </div>
      <div class="summary-tile"><div class="label">Valor inversiones</div><div class="value positive">${money(get('Valor Total Inversiones'))}</div></div>
      <div class="summary-tile wide"><div class="label">Rendimiento inversiones</div><div class="value ${get('Rendimiento Inversiones') >= 0 ? 'positive' : 'negative'}">${money(get('Rendimiento Inversiones'))}</div></div>
      <div class="summary-tile wide"><div class="label">Patrimonio neto</div><div class="value ${patrimonio >= 0 ? 'positive' : 'negative'}" style="font-size:1.5rem">${money(patrimonio)}</div></div>
    `;
  } catch (err) {
    liquidezGrid.innerHTML = `<div class="empty-state">Error cargando resumen: ${err.message}</div>`;
    patrimonioGrid.innerHTML = '';
  }

  try {
    const [gastos, ingresos] = await Promise.all([apiGet('list', { sheet: 'gastos' }), apiGet('list', { sheet: 'ingresos' })]);
    const movs = [
      ...gastos.data.map((g) => ({ ...g, tipo: 'gasto' })),
      ...ingresos.data.map((i) => ({ ...i, tipo: 'ingreso' })),
    ]
      .sort((a, b) => new Date(b.Fecha) - new Date(a.Fecha))
      .slice(0, 8);
    const cont = document.getElementById('ultimos-movimientos');
    cont.innerHTML = movs.length
      ? movs.map((m) => movItemHtml(m, m.tipo)).join('')
      : '<div class="empty-state">Sin movimientos aún</div>';
  } catch (err) {
    // silencioso, ya se mostró error arriba si aplica
  }
}

function movItemHtml(m, tipo) {
  const sign = tipo === 'gasto' ? '-' : '+';
  return `
    <div class="list-item">
      <div class="meta">
        <span class="concepto">${escapeHtml(m.Concepto)}</span>
        ${m.Descripcion ? `<span class="desc">${escapeHtml(m.Descripcion)}</span>` : ''}
        <span class="fecha">${formatDate(m.Fecha)}</span>
      </div>
      <div class="monto ${tipo}">${sign}${money(m.Monto)}</div>
    </div>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return String(d);
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---- Gastos ----
document.getElementById('form-gasto').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await apiPost('addGasto', {
      fecha: document.getElementById('gasto-fecha').value,
      concepto: document.getElementById('gasto-concepto').value,
      descripcion: document.getElementById('gasto-descripcion').value,
      categoria: document.getElementById('gasto-categoria').value,
      monto: document.getElementById('gasto-monto').value,
    });
    e.target.reset();
    document.getElementById('gasto-fecha').value = todayISO();
    toast('Gasto guardado');
    loadGastos();
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
});

async function loadGastos() {
  const cont = document.getElementById('lista-gastos');
  try {
    const { data } = await apiGet('list', { sheet: 'gastos' });
    const items = data.sort((a, b) => new Date(b.Fecha) - new Date(a.Fecha)).slice(0, 30);
    cont.innerHTML = items.length ? items.map((g) => movItemHtml(g, 'gasto')).join('') : '<div class="empty-state">Sin gastos registrados</div>';
  } catch (err) {
    cont.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

// ---- Ingresos ----
document.getElementById('form-ingreso').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await apiPost('addIngreso', {
      fecha: document.getElementById('ingreso-fecha').value,
      concepto: document.getElementById('ingreso-concepto').value,
      descripcion: document.getElementById('ingreso-descripcion').value,
      monto: document.getElementById('ingreso-monto').value,
    });
    e.target.reset();
    document.getElementById('ingreso-fecha').value = todayISO();
    toast('Ingreso guardado');
    loadIngresos();
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
});

async function loadIngresos() {
  const cont = document.getElementById('lista-ingresos');
  try {
    const { data } = await apiGet('list', { sheet: 'ingresos' });
    const items = data.sort((a, b) => new Date(b.Fecha) - new Date(a.Fecha)).slice(0, 30);
    cont.innerHTML = items.length ? items.map((i) => movItemHtml(i, 'ingreso')).join('') : '<div class="empty-state">Sin ingresos registrados</div>';
  } catch (err) {
    cont.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

// ---- Hipotecas ----
document.getElementById('form-hipoteca').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await apiPost('addHipoteca', {
      nombre: document.getElementById('hip-nombre').value,
      entidad: document.getElementById('hip-entidad').value,
      montoOriginal: document.getElementById('hip-monto').value,
      tasaInteres: document.getElementById('hip-tasa').value,
      plazoMeses: document.getElementById('hip-plazo').value,
      cuotaMensual: document.getElementById('hip-cuota').value,
      fechaInicio: document.getElementById('hip-fecha').value,
    });
    e.target.reset();
    toast('Hipoteca guardada');
    loadHipotecas();
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
});

document.getElementById('form-pago-hipoteca').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const payload = {
      hipotecaId: document.getElementById('pago-hipoteca').value,
      fecha: document.getElementById('pago-fecha').value,
      montoPago: document.getElementById('pago-monto').value,
      abonoCapital: document.getElementById('pago-capital').value,
      abonoInteres: document.getElementById('pago-interes').value,
    };
    const abonoUVR = document.getElementById('pago-capital-uvr').value;
    if (abonoUVR) payload.abonoCapitalUVR = abonoUVR;
    await apiPost('addPagoHipoteca', payload);
    e.target.reset();
    document.getElementById('pago-fecha').value = todayISO();
    toast('Pago registrado');
    loadHipotecas();
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
});

document.getElementById('form-uvr').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const { actualizadas } = await apiPost('addCotizacionUVR', {
      fecha: document.getElementById('uvr-fecha').value,
      valorUVR: document.getElementById('uvr-valor').value,
    });
    e.target.reset();
    document.getElementById('uvr-fecha').value = todayISO();
    toast(`Cotización actualizada · ${actualizadas} hipoteca(s) recalculada(s)`);
    loadHipotecas();
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
});

async function loadHipotecas() {
  const cont = document.getElementById('lista-hipotecas');
  const select = document.getElementById('pago-hipoteca');
  const uvrInfo = document.getElementById('uvr-ultima');
  try {
    const [{ data }, uvrRes] = await Promise.all([
      apiGet('list', { sheet: 'hipotecas' }),
      apiGet('list', { sheet: 'uvr' }),
    ]);
    const uvrHist = uvrRes.data;
    const ultimaUVR = uvrHist.length ? uvrHist[uvrHist.length - 1] : null;
    uvrInfo.textContent = ultimaUVR
      ? `Última cotización: ${moneyUVR(ultimaUVR['Valor UVR'])} (${formatDate(ultimaUVR.Fecha)})`
      : 'Aún no has registrado ninguna cotización.';

    select.innerHTML = data.map((h) => `<option value="${h.ID}">${escapeHtml(h.Nombre)}</option>`).join('');
    cont.innerHTML = data.length
      ? data
          .map((h) => {
            const original = Number(h['Monto Original']) || 1;
            const saldo = Number(h['Saldo Actual']);
            const montoOriginalUVR = Number(h['Monto Original UVR']) || 0;
            const saldoUVR = Number(h['Saldo Capital UVR']) || 0;
            // El % pagado se calcula sobre UVR cuando el crédito lleva ese
            // seguimiento: en pesos el saldo puede subir por indexación
            // aunque sí se esté abonando capital real.
            const pagadoPct = montoOriginalUVR > 0
              ? Math.max(0, Math.min(100, ((montoOriginalUVR - saldoUVR) / montoOriginalUVR) * 100))
              : Math.max(0, Math.min(100, ((original - saldo) / original) * 100));
            const uvrLine = saldoUVR
              ? `<div class="hip-sub">Saldo en UVR: <strong style="color:var(--text)">${saldoUVR.toLocaleString('es-CO', { maximumFractionDigits: 4 })} UVR</strong></div>`
              : '';
            return `
            <div class="hip-card">
              <div class="hip-title">${escapeHtml(h.Nombre)}</div>
              <div class="hip-sub">${escapeHtml(h.Entidad || '')} · Cuota ${money(h['Cuota Mensual'])} · ${pagadoPct.toFixed(0)}% pagado</div>
              <div class="bar"><div class="bar-fill" style="width:${pagadoPct}%"></div></div>
              <div class="hip-sub">Saldo actual: <strong style="color:var(--text)">${money(saldo)}</strong> de ${money(original)}</div>
              ${uvrLine}
            </div>`;
          })
          .join('')
      : '<div class="empty-state">Sin hipotecas registradas</div>';
  } catch (err) {
    cont.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

// ---- Inversiones ----
document.getElementById('form-inversion').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await apiPost('addInversion', {
      nombre: document.getElementById('inv-nombre').value,
      tipo: document.getElementById('inv-tipo').value,
      montoInvertido: document.getElementById('inv-monto').value,
      fechaInversion: document.getElementById('inv-fecha').value,
    });
    e.target.reset();
    toast('Inversión guardada');
    loadInversiones();
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
});

document.getElementById('form-valor-inversion').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await apiPost('updateInversionValor', {
      inversionId: document.getElementById('valor-inversion').value,
      valorActual: document.getElementById('valor-actual').value,
      fecha: todayISO(),
    });
    e.target.reset();
    toast('Valor actualizado');
    loadInversiones();
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
});

async function loadInversiones() {
  const cont = document.getElementById('lista-inversiones');
  const select = document.getElementById('valor-inversion');
  try {
    const { data } = await apiGet('list', { sheet: 'inversiones' });
    select.innerHTML = data.map((i) => `<option value="${i.ID}">${escapeHtml(i.Nombre)}</option>`).join('');
    cont.innerHTML = data.length
      ? data
          .map((i) => {
            const invertido = Number(i['Monto Invertido']);
            const actual = Number(i['Valor Actual']);
            const rendimiento = actual - invertido;
            const pct = invertido ? (rendimiento / invertido) * 100 : 0;
            return `
            <div class="list-item">
              <div class="meta">
                <span class="concepto">${escapeHtml(i.Nombre)}</span>
                <span class="desc">${escapeHtml(i.Tipo || '')} · invertido ${money(invertido)}</span>
              </div>
              <div class="monto ${rendimiento >= 0 ? 'ingreso' : 'gasto'}">${money(actual)}<br><span style="font-size:.7rem">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</span></div>
            </div>`;
          })
          .join('')
      : '<div class="empty-state">Sin inversiones registradas</div>';
  } catch (err) {
    cont.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

// ---- Inicialización ----
document.getElementById('gasto-fecha').value = todayISO();
document.getElementById('ingreso-fecha').value = todayISO();
document.getElementById('pago-fecha').value = todayISO();
document.getElementById('uvr-fecha').value = todayISO();
document.getElementById('inv-fecha').value = todayISO();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

refreshView('resumen');
