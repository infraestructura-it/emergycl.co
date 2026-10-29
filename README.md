# emergycl.co

Sitio de producto de **Emergycl**: monitoreo y acceso remoto de la infraestructura de todas sus sedes (UPS, datacenter, PCs, red), sin abrir puertos. Incluye una **demo interactiva** del panel que corre en el navegador con datos simulados.

Es HTML, CSS y JavaScript sin frameworks ni dependencias. Se publica con GitHub Pages desde la rama `main` (carpeta raíz): hoy en https://infraestructura-it.com/emergycl.co/ y, cuando se configure el dominio, en `https://emergycl.co`.

## Estructura

| Ruta | Qué es |
|---|---|
| `index.html` | La página |
| `css/styles.css` | Estilos |
| `js/demo-data.js` | Datos y lógica de la demo (sin DOM; lo prueban los tests) |
| `js/demo.js` | Interfaz de la demo del panel |
| `js/main.js` | Reloj de Bogotá, menú, animación, formulario de contacto |
| `assets/video/` | Video opcional de la demo |
| `.nojekyll` | Hace que GitHub Pages sirva los archivos sin procesarlos con Jekyll |
| `tests/` | Pruebas (`node:test`) |
| `.github/workflows/tests.yml` | Corre las pruebas en cada push y pull request |

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

El guion, los umbrales y las respuestas del asistente y de la terminal están en `js/demo-data.js`.

## Agregar el video de la demo

1. Grabe el panel real (p. ej. con OBS o la grabadora de Windows `Win + Alt + R`) y expórtelo en **MP4 (H.264)**, idealmente 1080p y menos de 50 MB (GitHub rechaza archivos de más de 100 MB).
2. Guárdelo como `assets/video/demo.mp4`.
3. Opcional: cambie la portada `assets/video/poster.svg` por una captura (`poster.jpg`) y actualice el atributo `poster` en `index.html`.
4. Haga commit y push. Cuando el video existe, la sección de demo muestra el selector **Demo en vivo / Video**; si no existe, solo se ve la demo en vivo.

## Publicación

GitHub Pages publica la raíz de la rama `main` en cada push (Settings → Pages → *Deploy from a branch*). Todas las rutas son relativas, así que el sitio funciona igual en `infraestructura-it.com/emergycl.co/` que en un dominio propio.

### Pasar a emergycl.co

1. En el DNS de `emergycl.co`:
   - Registros `A` del dominio raíz: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` de `www` hacia `infraestructura-it.github.io`
2. En **Settings → Pages → Custom domain** escriba `emergycl.co` (GitHub crea el archivo `CNAME`) y active **Enforce HTTPS** cuando aparezca el certificado.

Mientras el DNS no apunte a GitHub, no agregue el dominio: el sitio dejaría de verse en la dirección actual.

## Formulario de contacto

GitHub Pages no ejecuta código de servidor, así que el formulario abre el correo del visitante con la solicitud lista para `contacto@emergycl.co` (constante `CONTACT_EMAIL` en `js/main.js`). Para recibir las solicitudes sin depender del correo del visitante, se puede apuntar el formulario a un webhook de Node-RED o a un servicio como Formspree.
