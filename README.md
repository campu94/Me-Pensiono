# Mis Finanzas — App + Excel/Sheet consolidado

App móvil (PWA) para registrar gastos, ingresos, hipotecas e inversiones,
todo consolidado en vivo en una Google Sheet (el "Excel" que pediste,
en Google Drive, con fórmulas de resumen que se recalculan solas).

## Cómo está armado

- `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.json`, `icons/`,
  `config.js` — la app en sí: HTML/CSS/JS puro, instalable en el celular como
  ícono de pantalla de inicio (PWA). No necesita build ni frameworks. Están en
  la raíz del proyecto (no en una subcarpeta) para que GitHub Pages pueda
  servir `index.html` directamente.
- `apps-script/Code.gs` — el backend, corre gratis dentro de Google Apps Script,
  pegado a tu Google Sheet. Recibe lo que registras en la app y lo escribe
  en las pestañas de la hoja.

La Sheet tendrá estas pestañas (se crean solas la primera vez que uses la app):
`Gastos`, `Ingresos`, `Hipotecas`, `Pagos_Hipoteca`, `Inversiones`, `Resumen`.

---

## Paso 1 — Crear la Google Sheet y el backend

1. Ve a [sheets.google.com](https://sheets.google.com) y crea una hoja nueva,
   llámala por ejemplo **"Finanzas Personales"**.
2. Menú **Extensiones → Apps Script**.
3. Borra el contenido de `Code.gs` que aparece por defecto y pega ahí todo
   el contenido de [`apps-script/Code.gs`](apps-script/Code.gs) de este proyecto.
4. En el editor de Apps Script, arriba a la izquierda, en el selector de
   funciones elige **`setupSheets`** y dale a **Ejecutar** (▶). La primera vez
   te va a pedir autorizar permisos — acéptalos (es tu propio script, sobre tu
   propia hoja). Esto crea todas las pestañas con encabezados y la hoja
   **Resumen** con las fórmulas.
5. Define un token secreto para que nadie más pueda escribir en tu hoja aunque
   adivine la URL:
   - Menú del proyecto (ícono de engranaje) → **Propiedades del proyecto** →
     pestaña **Propiedades del script** → **Agregar propiedad del script**.
   - Nombre: `APP_TOKEN`. Valor: cualquier clave larga que inventes
     (ej. `mifinanzas-8f2a91-secreta`). Guarda.

## Paso 2 — Publicar el backend como Web App

1. Arriba a la derecha, botón **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. "Ejecutar como": **Yo (tu correo)**.
4. "Quién tiene acceso": **Cualquier usuario**. (No es un riesgo grande: sin el
   `APP_TOKEN` correcto, el script rechaza cualquier lectura/escritura.)
5. Dale a **Implementar**, autoriza si te lo vuelve a pedir, y copia la
   **URL de la aplicación web** que te entrega (termina en `/exec`).

Cada vez que edites `Code.gs`, tienes que hacer **Implementar → Administrar
implementaciones → ✏️ → Nueva versión → Implementar** para que los cambios
se reflejen en esa misma URL.

## Paso 3 — Conectar la app con tu backend

1. Abre [`config.js`](config.js) en este proyecto.
2. Reemplaza:
   ```js
   window.APP_CONFIG = {
     SCRIPT_URL: 'https://script.google.com/macros/s/XXXXX/exec', // tu URL del paso 2
     TOKEN: 'mifinanzas-8f2a91-secreta', // el mismo APP_TOKEN del paso 1
   };
   ```

## Paso 4 — Probar en tu celular

**Opción rápida (sin subir a internet):** en este PC, corre un servidor local
apuntando a la ruta completa del proyecto (ajusta si tu usuario de Windows no
es `USER`):

```powershell
cd "C:\Users\USER\OneDrive - Uniban\Escritorio\Claude_Campu\Finanzas_App"
python -m http.server 8000
```

Si `cd` falla con "no existe", es que la terminal no empezó ahí — usa la ruta
completa entre comillas como arriba, no una ruta relativa.

Y abre `http://TU-IP-LOCAL:8000` desde el navegador del celular (mismo wifi).
Sirve para probar, pero solo funciona mientras el PC esté prendido y en esa red.

**Uso real: GitHub Pages**

1. Crea un repositorio **público** en GitHub (ej. `finanzas-app`), sin
   README ni .gitignore iniciales.
2. Se sube el contenido de esta carpeta (`Finanzas_App/`) a ese repositorio.
3. Se activa GitHub Pages para ese repo: **Settings → Pages → Source: Deploy
   from a branch → Branch: `main` / `(root)`**.
4. Te da una URL pública tipo `https://tuusuario.github.io/finanzas-app/`.
5. Ábrela desde el celular → menú del navegador → **Agregar a pantalla de
   inicio**. Queda como una app más, con ícono propio.

Como el repo es público, cualquiera con el link puede ver el código —
incluidos `SCRIPT_URL` y `TOKEN` de `config.js`. Ver la nota de
**Seguridad / privacidad** más abajo.

## Uso diario

- **Resumen**: balance, deuda hipotecaria, valor de inversiones y patrimonio
  neto, calculado en vivo desde la Sheet.
- **Gastos / Ingresos**: fecha, concepto, descripción y monto.
- **Hipotecas**: registras el crédito (monto, tasa, cuota) y luego cada pago
  (abono a capital / interés); el saldo se actualiza solo.
- **Inversiones**: registras el monto invertido y luego actualizas el "valor
  actual" cuando quieras, para ver el rendimiento.

Todo lo que registras en la app aparece de inmediato en la Google Sheet — la
puedes abrir desde Sheets o descargarla como `.xlsx` (Archivo → Descargar →
Microsoft Excel) cuando quieras, siempre estará al día.

## Seguridad / privacidad

Es un proyecto personal simple, no un banco: el único control de acceso es
el `APP_TOKEN`. Con el repo público en GitHub Pages, ese token queda visible
en el código fuente para quien tenga el link — en el peor caso alguien podría
meter filas falsas en tu Sheet, no puede leer ni borrar nada. Para que ese
riesgo se mantenga bajo:

- No compartas ni publiques el link de la app.
- El nombre del repo y de la Sheet no revelan que son tuyos por sí solos,
  pero evita ponerles tu nombre completo.
- Si más adelante quieres cerrar esa puerta del todo, cambia el `APP_TOKEN`
  (Apps Script → Propiedades del script) por uno largo y aleatorio y
  actualízalo en `config.js` — así deja de ser adivinable aunque el código
  sea público.
