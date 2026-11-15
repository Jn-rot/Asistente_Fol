const {
    app,
    BrowserWindow,
    ipcMain,
    screen,
    dialog,
    safeStorage
} = require("electron")

const fs = require("fs")
const path = require("path")
const { execFile } = require("child_process")

let autoUpdater = null
try {
    autoUpdater = require("electron-updater").autoUpdater
} catch (err) {
    console.warn("[updater] electron-updater no disponible:", err && err.message)
}

app.disableHardwareAcceleration()

function aplicarReglasHyprland() {
    if (process.platform !== "linux") return
    if (!process.env.HYPRLAND_INSTANCE_SIGNATURE) return

    const regla =
        'hl.window_rule({ name = "asistentefinal-transparente", ' +
        'match = { class = "asistentefinal" }, ' +
        'float = true, center = false, no_blur = true, no_shadow = true, ' +
        'opacity = "1.0 override 1.0" })'

    const sinBarra =
        'hl.window_rule({ match = { class = "asistentefinal" }, ' +
        '["hyprbars:no_bar"] = true })'

    execFile("hyprctl", ["eval", regla], { timeout: 2000 }, (err) => {
        if (err) console.error("[main] hyprctl eval:", err.message)
    })
    execFile("hyprctl", ["eval", sinBarra], { timeout: 2000 }, (err) => {
        if (err) console.error("[main] hyprctl eval:", err.message)
    })
}

let win

let isExpanded = false

let savedPosition = {
x: null,
y: null
}

let pendingExpand = null

function createWindow() {

const { x: ax, y: ay, width: sw, height: sh } =
    screen.getPrimaryDisplay().workArea

const x0 = ax + sw - 125
const y0 = ay + sh - 125

win = new BrowserWindow({

    width: 85,
    height: 85,

    x: x0,
    y: y0,

    transparent: true,

    frame: false,

    backgroundColor: "#00000000",

    alwaysOnTop: true,

    skipTaskbar: true,



    webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        devTools: true
    }
})

win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || !input.control || input.alt || input.meta) return
    const k = input.key
    const z = win.webContents.getZoomFactor()
    if (k === "-" || k === "Subtract") {
        event.preventDefault()
        win.webContents.setZoomFactor(Math.max(0.25, Math.round((z - 0.1) * 100) / 100))
    } else if (k === "+" || k === "=" || k === "Add") {
        event.preventDefault()
        win.webContents.setZoomFactor(Math.min(5, Math.round((z + 0.1) * 100) / 100))
    } else if (k === "0") {
        event.preventDefault()
        win.webContents.setZoomFactor(1)
    }
})

win.setMinimumSize(85, 85)
win.setMaximumSize(85, 85)
win.setHasShadow(false)

win.loadFile("index.html")

win.once("ready-to-show", () => {
    win.show()
    setTimeout(() => {
        if (!win || win.isDestroyed() || isExpanded) return
        const [cx, cy] = win.getPosition()
        if (cx !== x0 || cy !== y0) win.setPosition(x0, y0)
    }, 150)
})

}

app.whenReady().then(() => {
    aplicarReglasHyprland()
    createWindow()

    if (autoUpdater && app.isPackaged) {
        autoUpdater.autoDownload = true
        autoUpdater.on("error", (err) => {
            console.error("[updater]", err && err.message)
        })
        autoUpdater.checkForUpdatesAndNotify().catch((err) => {
            console.error("[updater]", err && err.message)
        })
    }
})

/* =========================
MOVER VENTANA
========================= */

ipcMain.on(
"move-window",
(e, dx, dy) => {

    if (!win) return

    const [x, y] =
        win.getPosition()

    win.setPosition(
        x + dx,
        y + dy
    )
}

)

/* =========================
EXPANDIR
========================= */

ipcMain.on(
"expandir",
(e) => {

    if (!win) return
    if (isExpanded) return

    const [x, y] =
        win.getPosition()

    savedPosition = {
        x,
        y
    }

    const { x: ax, y: ay, width: sw, height: sh } =
        screen.getDisplayNearestPoint({ x: x + 42, y: y + 42 }).workArea

    const PANEL_W = 540
    const PANEL_H = 650

    // espacio disponible a la derecha y abajo de la burbuja
    let ew = Math.round(Math.min(PANEL_W, ax + sw - 5 - x))
    let eh = Math.round(Math.min(PANEL_H, ay + sh - 5 - y))

    // si no alcanza, el panel se abre hacia el interior del monitor
    let nx = x
    let ny = y
    if (ew < PANEL_W) {
        nx = Math.round(Math.max(ax + 5, Math.min(x, ax + sw - 5 - PANEL_W)))
        ew = Math.round(Math.min(PANEL_W, ax + sw - 5 - nx))
    }
    if (eh < PANEL_H) {
        ny = Math.round(Math.max(ay + 5, Math.min(y, ay + sh - 5 - PANEL_H)))
        eh = Math.round(Math.min(PANEL_H, ay + sh - 5 - ny))
    }

    const ox = x - nx
    const oy = y - ny

    // la ventana aún NO se mueve: primero la esfera se dibuja
    // donde está la burbuja y se anuncia el desplazamiento del morph
    pendingExpand = {
        ew,
        eh,
        nx,
        ny,
        maxW: sw,
        maxH: sh
    }

    e.sender.send("expansion-size", ew, eh, ox, oy)
}

)

ipcMain.on(
"expandir-go",
() => {

    if (!win) return
    if (isExpanded) return
    if (!pendingExpand) return

    const { ew, eh, nx, ny, maxW, maxH } = pendingExpand
    pendingExpand = null

    win.webContents.setZoomFactor(1)
    win.setMinimumSize(240, 340)
    win.setMaximumSize(maxW, maxH)
    win.setBounds({ width: ew, height: eh, x: nx, y: ny })
    isExpanded = true
}

)

/* =========================
CONTRAER
========================= */

ipcMain.on(
"contraer",
(e) => {

    if (!win) return
    if (!isExpanded) return

    win.setMinimumSize(85, 85)
    win.setMaximumSize(85, 85)
    win.webContents.setZoomFactor(1)
    win.setBounds({
        width: 85,
        height: 85,
        x: Math.round(savedPosition.x),
        y: Math.round(savedPosition.y)
    })
    isExpanded = false

    // la ventana ya es una burbuja de nuevo: la renderer ancla la esfera a su esquina
    e.sender.send("collapse-done")
}

)

/* =========================
RESIZE
========================= */

ipcMain.on(
"resize-window",
(e, w, h) => {
    if (!win || !isExpanded) return
    const zoom = win.webContents.getZoomFactor()
    const [maxW, maxH] = win.getMaximumSize()
    w = Math.max(240, Math.min(Math.round(w * zoom), maxW))
    h = Math.max(340, Math.min(Math.round(h * zoom), maxH))
    let [x, y] = win.getPosition()
    // nunca salir del monitor: si no cabe, se recoloca hacia el interior
    const { x: ax, y: ay, width: sw, height: sh } =
        screen.getDisplayNearestPoint({ x: x + 42, y: y + 42 }).workArea
    x = Math.min(x, ax + sw - 5 - w)
    y = Math.min(y, ay + sh - 5 - h)
    win.setBounds({
        width: w,
        height: h,
        x: Math.round(x),
        y: Math.round(y)
    })
}

)

/* =========================
OJOS: SEGUIMIENTO GLOBAL DEL MOUSE EN TODO EL MONITOR
========================= */

let ojosTimer = null

ipcMain.on(
"ojos-activar",
() => {

    if (ojosTimer) return
    if (!win) return

    ojosTimer = setInterval(() => {

        if (!win || win.isDestroyed()) {
            clearInterval(ojosTimer)
            ojosTimer = null
            return
        }

        const p = screen.getCursorScreenPoint()

        const { x: ax, y: ay, width: sw, height: sh } =
            screen.getDisplayNearestPoint(p).workArea

        const dx = (p.x - (ax + sw / 2)) / (sw / 2)
        const dy = (p.y - (ay + sh / 2)) / (sh / 2)

        win.webContents.send("ojos-pos", dx, dy)
    }, 33)
}

)

/* =========================
DESCARGAR ARCHIVO (imagen o texto)
========================= */

ipcMain.handle(
"descargar-archivo",
async (e, { nombre, bytes, texto }) => {

    if (!win) return false

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
        defaultPath: nombre || "archivo.txt"
    })

    if (canceled || !filePath) return false

    try {
        if (bytes) {
            fs.writeFileSync(filePath, Buffer.from(bytes))
        } else {
            fs.writeFileSync(filePath, texto ?? "", "utf8")
        }
        return true
    } catch (err) {
        console.error("[main] descargar-archivo:", err && err.message)
        return false
    }
}

)

/* =========================
SESIONES (guardado local cifrado)
======================== */

function rutaSesiones() {
    return path.join(app.getPath("userData"), "sesiones.bin")
}

ipcMain.handle("sesiones-cargar", () => {
    try {
        const p = rutaSesiones()
        if (!fs.existsSync(p)) return []
        const raw = fs.readFileSync(p)
        let json
        if (raw.slice(0, 4).toString("utf8") === "ENC:") {
            const buf = Buffer.from(raw.slice(4).toString("utf8"), "base64")
            json = safeStorage.decryptString(buf)
        } else {
            json = raw.toString("utf8")
        }
        const data = JSON.parse(json)
        return Array.isArray(data) ? data : []
    } catch (err) {
        console.error("[main] sesiones-cargar:", err && err.message)
        return []
    }
})

ipcMain.handle("sesiones-guardar", (e, sesiones) => {
    try {
        const p = rutaSesiones()
        fs.mkdirSync(path.dirname(p), { recursive: true })
        const json = JSON.stringify(Array.isArray(sesiones) ? sesiones : [])

        let out
        if (safeStorage.isEncryptionAvailable()) {
            const cifrado = safeStorage.encryptString(json).toString("base64")
            out = Buffer.from("ENC:" + cifrado, "utf8")
        } else {
            out = Buffer.from(json, "utf8")
        }

        const tmp = p + ".tmp"
        fs.writeFileSync(tmp, out, { mode: 0o600 })
        fs.renameSync(tmp, p)
        try { fs.chmodSync(p, 0o600) } catch { }
        return true
    } catch (err) {
        console.error("[main] sesiones-guardar:", err && err.message)
        return false
    }
})

/* =========================
API KEY (guardado local cifrado)
======================== */

function rutaApiKey() {
    return path.join(app.getPath("userData"), "apikey.bin")
}

function leerCifrado(p) {
    if (!fs.existsSync(p)) return null
    const raw = fs.readFileSync(p)
    if (raw.slice(0, 4).toString("utf8") === "ENC:") {
        return safeStorage.decryptString(Buffer.from(raw.slice(4).toString("utf8"), "base64"))
    }
    return raw.toString("utf8")
}

function escribirCifrado(p, texto) {
    fs.mkdirSync(path.dirname(p), { recursive: true })
    let out
    if (safeStorage.isEncryptionAvailable()) {
        out = Buffer.from("ENC:" + safeStorage.encryptString(texto).toString("base64"), "utf8")
    } else {
        out = Buffer.from(texto, "utf8")
    }
    const tmp = p + ".tmp"
    fs.writeFileSync(tmp, out, { mode: 0o600 })
    fs.renameSync(tmp, p)
    try { fs.chmodSync(p, 0o600) } catch { }
}

ipcMain.handle("apikey-cargar", () => {
    try {
        return leerCifrado(rutaApiKey()) || ""
    } catch (err) {
        console.error("[main] apikey-cargar:", err && err.message)
        return ""
    }
})

ipcMain.handle("apikey-guardar", (e, key) => {
    try {
        const limpia = String(key || "").trim()
        if (!limpia) {
            try { fs.unlinkSync(rutaApiKey()) } catch { }
            return true
        }
        escribirCifrado(rutaApiKey(), limpia)
        return true
    } catch (err) {
        console.error("[main] apikey-guardar:", err && err.message)
        return false
    }
})

/* =========================
CERRAR APP
========================= */

app.on(
"window-all-closed",
() => {
    if (ojosTimer) {
        clearInterval(ojosTimer)
        ojosTimer = null
    }
    app.quit()
}
)

process.on("uncaughtException", (err) => {
    console.error("[main] uncaughtException:", err && err.message)
})