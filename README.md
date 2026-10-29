# emergycl.co

Sitio de producto de **Emergycl**: monitoreo y acceso remoto de la infraestructura de todas sus sedes (UPS, datacenter, PCs, red), sin abrir puertos. Incluye una **demo interactiva** del panel que corre en el navegador con datos simulados.

Es HTML, CSS y JavaScript sin frameworks ni dependencias. Se publica con GitHub Pages en `https://emergycl.co`.

## Estructura

| Ruta | Qué es |
|---|---|
| `site/index.html` | La página |
| `site/css/styles.css` | Estilos |
| `site/js/demo-data.js` | Datos y lógica de la demo (sin DOM; lo prueban los tests) |
| `site/js/demo.js` | Interfaz de la demo del panel |
| `site/js/main.js` | Reloj de Bogotá, menú, animación, formulario de contacto |
| `site/assets/video/` | Video opcional de la demo |
| `site/CNAME` | Dominio de GitHub Pages |
| `tests/` | Pruebas (`node:test`) |
| `.github/workflows/pages.yml` | Corre las pruebas y publica `site/` |

## Ver en local

```bash
npm start          # http://localhost:4173
npm test           # pruebas
```

Requiere Node.js 20 o superior. No hay `npm install`: no hay dependencias.

## La demo

Simula seis sedes ficticias. Cada 100 segundos se repite el mismo guion:

| Segundo | Qué pasa |
|---|---|
| 20 | Corte de energía en Clínica Norte: la UPS pasa a batería, llega el aviso a "Telegram" y 3 s después el diagnóstico de la IA |
| 45 | Vuelve la red; aviso de recuperación con el tiempo en batería |
| 60 | La planta de Funza deja de enviar latidos; a los 8 s (tiempo de gracia) llega la alerta |
| 80 | La planta se reconecta; aviso con el tiempo caído |
| 86 | Apertura de la puerta del datacenter validada con huella |

El guion, los umbrales y las respuestas del asistente y de la terminal están en `site/js/demo-data.js`.

## Agregar el video de la demo

1. Grabe el panel real (p. ej. con OBS o la grabadora de Windows `Win + Alt + R`) y expórtelo en **MP4 (H.264)**, idealmente 1080p y menos de 50 MB (GitHub rechaza archivos de más de 100 MB).
2. Guárdelo como `site/assets/video/demo.mp4`.
3. Opcional: cambie la portada `site/assets/video/poster.svg` por una captura (`poster.jpg`) y actualice el atributo `poster` en `index.html`.
4. Haga commit y push. Cuando el video existe, la sección de demo muestra el selector **Demo en vivo / Video**; si no existe, solo se ve la demo en vivo.

## Publicar en emergycl.co

1. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. En el DNS del dominio `emergycl.co`:
   - Registros `A` del dominio raíz hacia GitHub Pages: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - Opcional `AAAA`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
   - `CNAME` de `www` hacia `infraestructura-it.github.io`
3. En **Settings → Pages**, escriba `emergycl.co` en *Custom domain* y active **Enforce HTTPS** cuando GitHub emita el certificado.

Cada push a `main` corre las pruebas y, si pasan, publica.

## Formulario de contacto

GitHub Pages no ejecuta código de servidor, así que el formulario abre el correo del visitante con la solicitud lista para `contacto@emergycl.co` (constante `CONTACT_EMAIL` en `site/js/main.js`). Para recibir las solicitudes sin depender del correo del visitante, se puede apuntar el formulario a un webhook de Node-RED o a un servicio como Formspree.
