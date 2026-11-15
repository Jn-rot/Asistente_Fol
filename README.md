# Fol — Asistente de escritorio

Asistente conversacional flotante con interfaz tipo *Claude Code*, construido con **Electron**. Incluye chat con IA, reconocimiento de voz, generación de imágenes, descarga de archivos y almacenamiento local cifrado de conversaciones.

> Repositorio: <https://github.com/Jn-rot/Asistente_Fol>

---

## ⬇️ Descargar

Los instaladores están en **Releases** (no en la lista de archivos del repositorio):

- **Página de descargas:** <https://github.com/Jn-rot/Asistente_Fol/releases/latest>
- **Windows:** [Fol-Setup-1.0.2.exe](https://github.com/Jn-rot/Asistente_Fol/releases/download/v1.0.2/Fol-Setup-1.0.2.exe)
- **Linux AppImage:** [Fol-1.0.2.AppImage](https://github.com/Jn-rot/Asistente_Fol/releases/download/v1.0.2/Fol-1.0.2.AppImage)
- **Linux .deb:** [asistentefinal_1.0.2_amd64.deb](https://github.com/Jn-rot/Asistente_Fol/releases/download/v1.0.2/asistentefinal_1.0.2_amd64.deb)

> Los instaladores **no incluyen** ninguna API key. Al abrir la app por primera vez, entra en **Ajustes ⚙** y pega la key que te haya compartido el autor (o usa la tuya propia de Groq).

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

La app necesita una API key de Groq para el chat y la voz. Los instaladores
publicados **no incluyen ninguna key**: pide la key al autor o crea la tuya.

1. Crea una cuenta en <https://console.groq.com>.
2. Ve a **API Keys** → **Create API Key**.
3. Abre la app, pulsa el engranaje **⚙** en la barra superior.
4. Pega la key (`gsk_...`) en **API key de Groq** y pulsa **Guardar**.

La key se almacena cifrada en el equipo y solo hay que configurarla una vez.

> Solo para desarrollo: crea un `config.js` en la raíz con:
> ```js
> const API_KEY = 'gsk_tu_clave'
> module.exports = { API_KEY }
> ```
> Ese archivo está excluido de Git y de los instaladores publicados.

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
- `config.js` **nunca** se sube al repositorio ni se incluye en los instaladores publicados.
- Los instaladores salen sin key: cada usuario pega una en Ajustes y queda cifrada en su equipo.
- No se envían conversaciones a servidores propios: el chat va directo a Groq y las imágenes a Pollinations.

---

## Licencia

MIT © 2026 Jannel ([Jn-rot](https://github.com/Jn-rot))
