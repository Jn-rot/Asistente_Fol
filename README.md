# Fol — Asistente de escritorio

Asistente conversacional flotante con interfaz tipo *Claude Code*, construido con **Electron**. Incluye chat con IA, reconocimiento de voz, generación de imágenes, descarga de archivos y almacenamiento local cifrado de conversaciones.

> Repositorio: <https://github.com/Jn-rot/Asistente_Fol>

---

## Características

- Burbuja flotante que se transforma en panel de chat (morph).
- Chat con modelos de **Groq** (`openai/gpt-oss-120b`) en streaming.
- Dictado por voz con **Whisper** (`whisper-large-v3-turbo`).
- Generación de imágenes vía Pollinations.
- Descarga de imágenes y de archivos generados por el asistente.
- Barra lateral con sesiones, búsqueda y creación de conversaciones.
- **Conversaciones guardadas localmente y cifradas** (`safeStorage` del sistema).
- **Ajustes de la cara**: color principal, brillo/aura, ojos y boca.
- API key propia, guardada cifrada en el equipo del usuario.
- Autoactualización mediante GitHub Releases (`electron-updater`).

---

## Requisitos

- **Linux**: AppImage (sin instalación) o paquete `.deb`.
- **Windows**: instalador NSIS (generado por GitHub Actions).
- Para desarrollo: Node.js 20 o superior y npm.

---

## Instalación

### Linux (AppImage)

1. Descarga el archivo `Fol-<versión>.AppImage` desde la sección **Releases**.
2. Dale permisos de ejecución:
   ```bash
   chmod +x Fol-*.AppImage
   ```
3. Ejecútalo:
   ```bash
   ./Fol-*.AppImage
   ```

### Windows

1. Descarga `Fol-Setup-<versión>.exe` desde **Releases**.
2. Ejecuta el instalador y sigue el asistente.
3. Windows puede mostrar una advertencia de SmartScreen por no estar firmado; selecciona *Más información → Ejecutar de todas formas*.

---

## Configurar la API key

Los instaladores publicados en **Releases** ya salen con una key configurada
(inyectada durante el build desde el secreto `GROQ_API_KEY`), así que funcionan
directamente. Aun así, cada usuario puede usar su propia key:

1. Crea una cuenta en <https://console.groq.com>.
2. Ve a **API Keys** → **Create API Key**.
3. Abre la app, pulsa el engranaje **⚙** en la barra superior.
4. Pega la key (`gsk_...`) en **API key de Groq** y pulsa **Guardar**.

La key se almacena cifrada en el equipo (nunca se sube al repositorio).

> Solo para desarrollo: crea un `config.js` en la raíz con:
> ```js
> const API_KEY = 'gsk_tu_clave'
> module.exports = { API_KEY }
> ```
> Ese archivo está excluido de Git mediante `.gitignore`.

---

## Uso

- **Clic** en la burbuja: abre el chat.
- **Arrastrar** la burbuja: mueve la ventana.
- **Rueda/barra superior**: arrastra el panel para moverlo.
- **Botón ⚙**: colores de la cara y API key.
- **Botón ∨**: colapsa el panel de vuelta a la burbuja.
- **Ctrl + `-` / `+` / `0`**: zoom.
- **Nueva conversación**: inicia una sesión nueva; se guarda automáticamente.

---

## Desarrollo

```bash
git clone https://github.com/Jn-rot/Asistente_Fol.git
cd Asistente_Fol
npm install
npm start
```

### Scripts

| Script | Descripción |
| --- | --- |
| `npm start` | Ejecuta la app en modo desarrollo |
| `npm run dist:linux` | Genera AppImage y `.deb` |
| `npm run dist:win` | Genera instalador NSIS para Windows |
| `npm run release` | Compila y publica en GitHub Releases |

---

## Estructura del proyecto

```
Asistente_Fol/
├── main.js            # Proceso principal de Electron (ventana, IPC, cifrado)
├── index.html         # Interfaz (burbuja, panel, ajustes)
├── config.example.js  # Plantilla de API key para desarrollo
├── css/
│   ├── style.css      # Burbuja, morph y cara
│   ├── claude.css     # Panel de chat y ajustes
│   └── face.css       # Expresiones y variables de color
├── js/
│   └── chat.js        # Lógica de chat, sesiones, voz y ajustes
└── .github/workflows/ # CI/CD de releases
```

---

## Releases y actualizaciones

Las versiones se publican con etiquetas (`tags`) con formato `v1.0.0`:

```bash
npm version patch        # o minor / major
git push --follow-tags
```

El workflow de GitHub Actions compila Linux y Windows y publica los artefactos en **Releases**. Las apps instaladas consultan esas releases al iniciar y se actualizan automáticamente.

---

## Seguridad y privacidad

- Las conversaciones se guardan en `~/.config/asistentefinal/` (Linux) o `%APPDATA%/asistentefinal/` (Windows).
- Los archivos `sesiones.bin` y `apikey.bin` usan cifrado del sistema (`safeStorage`) y permisos restringidos (`0600`). Si el llavero no está disponible, se guardan en texto plano con permisos restringidos.
- `config.js` **nunca** se sube al repositorio; en CI se genera desde el secreto `GROQ_API_KEY` solo durante el build.
- La key incluida en los instaladores puede extraerse del binario (igual que cualquier app de escritorio). Si se filtra, revócala en Groq y publica una nueva versión.
- No se envían conversaciones a servidores propios: el chat va directo a Groq y las imágenes a Pollinations.

---

## Licencia

MIT © 2026 Jannel ([Jn-rot](https://github.com/Jn-rot))
