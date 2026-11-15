const { ipcRenderer } = require("electron")

let API_KEY = ""

async function cargarApiKey() {
    try {
        const guardada = await ipcRenderer.invoke("apikey-cargar")
        if (guardada) {
            API_KEY = guardada
            return
        }
    } catch { }
    try {
        const local = require("./config.js")
        if (local && local.API_KEY) API_KEY = local.API_KEY
    } catch { }
}

const entidad = document.getElementById("entidad")
const minBtn = document.getElementById("minBtn")
const input = document.getElementById("msg-input")
const sendBtn = document.getElementById("send-btn")
const micBtn = document.getElementById("mic")
const chatEl = document.getElementById("chat")
const sidebar = document.getElementById("sidebar")
const rail = document.getElementById("rail")
const mainEl = document.getElementById("main")
const sessionsEl = document.getElementById("sessions")
const searchInput = document.getElementById("search-sessions")

let expandida = false
let morfando = false
let historial = [
    {
        role: "system",
        content: "Te llamas Fol. Eres un asistente amable en español, dentro de una interfaz estilo terminal tipo Claude Code. Responde de forma breve, directa y técnica. Cuando el usuario pida una imagen o foto, responde EXCLUSIVAMENTE con una imagen generada en formato Markdown usando Pollinations: ![descripcion](https://image.pollinations.ai/prompt/DESCRIPCION EN INGLES breve con espacios libres?width=768&height=768&nologo=true). NUNCA inventes rutas de archivos ni uses Unsplash u otras URLs: usa SIEMPRE image.pollinations.ai. La descripcion debe ser corta (3 a 8 palabras) y en ingles. Cuando el usuario te pida un archivo descargable (codigo, lista, nota, csv, json, html, etc.), responde con un bloque de archivo con este formato EXACTO:\n<<<archivo: nombre-del-archivo.con-extencion\ncontenido del archivo\n>>>\nEl bloque genera un boton de descarga. Si te adjuntan archivos, leelos y usalos para responder."
    }
]
let sessions = []
let curSession = null
let offX = 0
let offY = 0
let guardarTimer = null

function guardarSesiones() {
    clearTimeout(guardarTimer)
    guardarTimer = setTimeout(() => {
        ipcRenderer.invoke("sesiones-guardar", sessions).catch(() => { })
    }, 350)
}

async function cargarSesionesGuardadas() {
    try {
        const data = await ipcRenderer.invoke("sesiones-cargar")
        if (Array.isArray(data) && data.length) {
            sessions = data.map(s => ({
                id: s.id || Date.now() + Math.random(),
                title: s.title || "Conversación",
                time: s.time || "",
                msgs: Array.isArray(s.msgs) ? s.msgs : []
            }))
            renderSesiones("")
        }
    } catch { }
}

/* =============================================
AJUSTES DE LA CARA (colores)
============================================= */

const FACE_DEFAULTS = {
    face: "#1fb8a8",
    glow: "#3cf0d2",
    eye: "#06453f",
    mouth: "#d7ebff"
}

let faceSettings = { ...FACE_DEFAULTS }

function hexToRgb(hex) {
    const h = hex.replace("#", "")
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16)
    }
}

function rgbToHex(r, g, b) {
    const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")
    return "#" + c(r) + c(g) + c(b)
}

function aclarar(hex, factor) {
    const { r, g, b } = hexToRgb(hex)
    return rgbToHex(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor)
}

function oscurecer(hex, factor) {
    const { r, g, b } = hexToRgb(hex)
    return rgbToHex(r * (1 - factor), g * (1 - factor), b * (1 - factor))
}

function aplicarCara(a) {
    const root = document.documentElement.style
    root.setProperty("--face-1", aclarar(a.face, 0.45))
    root.setProperty("--face-2", a.face)
    root.setProperty("--face-3", oscurecer(a.face, 0.45))
    root.setProperty("--face-4", oscurecer(a.face, 0.72))
    root.setProperty("--face-glow", a.glow)
    root.setProperty("--face-eye", a.eye)
    root.setProperty("--face-mouth", a.mouth)

    document.querySelectorAll("#v-grad stop").forEach((stop, i) => {
        const colores = [
            aclarar(a.face, 0.45),
            a.face,
            oscurecer(a.face, 0.45),
            oscurecer(a.face, 0.72)
        ]
        stop.setAttribute("stop-color", colores[i] || a.face)
    })
}

function guardarCara() {
    try { localStorage.setItem("fol.face", JSON.stringify(faceSettings)) } catch { }
}

function cargarCara() {
    try {
        const raw = localStorage.getItem("fol.face")
        if (raw) faceSettings = { ...FACE_DEFAULTS, ...JSON.parse(raw) }
    } catch { }
    aplicarCara(faceSettings)
}

function sincronizarInputsCara() {
    const ids = { face: "set-face", glow: "set-glow", eye: "set-eye", mouth: "set-mouth" }
    Object.entries(ids).forEach(([clave, id]) => {
        const el = document.getElementById(id)
        if (el) el.value = faceSettings[clave]
    })
    refrescarSwatches()
}

const PALETA_CARA = [
    "#7ff5e0", "#3cf0d2", "#1fb8a8", "#62dcff",
    "#4f86ff", "#8b7bff", "#ff7ac8", "#ffb86b",
    "#ff6b6b", "#d7ebff", "#f1ede6", "#06453f"
]

function refrescarSwatches() {
    document.querySelectorAll(".color-swatches").forEach(box => {
        const input = document.getElementById(box.dataset.target)
        const actual = (input ? input.value : "").toLowerCase()
        box.querySelectorAll(".color-swatch").forEach(b => {
            b.classList.toggle("sel", (b.dataset.color || "").toLowerCase() === actual)
        })
    })
}

const MORF_DURATION = 1000

/* =============================================
OJOS QUE SIGUEN AL RATÓN (burbuja + estado vacío)
============================================= */

const OJOS_MAX_X = 18
const OJOS_MAX_Y = 13

function moverOjos(x, y) {
    document.querySelectorAll(".eye-core").forEach(eye => {
        const wrap = eye.closest(".eye-wrap")
        const box = wrap ? wrap.parentElement : null
        if (!box || !box.isConnected) return
        const rect = box.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = (x - cx) / (window.innerWidth / 2)
        const dy = (y - cy) / (window.innerHeight / 2)
        const ox = Math.max(-1, Math.min(1, dx)) * OJOS_MAX_X
        const oy = Math.max(-1, Math.min(1, dy)) * OJOS_MAX_Y
        eye.style.transform = `translate(${ox}px, ${oy}px)`
    })
}

ipcRenderer.on("ojos-pos", (e, dxN, dyN) => {
    const ox = Math.max(-1, Math.min(1, dxN)) * OJOS_MAX_X
    const oy = Math.max(-1, Math.min(1, dyN)) * OJOS_MAX_Y
    const t = `translate(${ox}px, ${oy}px)`
    document.querySelectorAll(".eye-core").forEach(eye => {
        eye.style.transform = t
    })
})

window.addEventListener("touchmove", (e) => {
    if (e.touches[0]) moverOjos(e.touches[0].clientX, e.touches[0].clientY)
})

ipcRenderer.send("ojos-activar")


/* ========= ESTADOS FACIALES ========= */
function setFaceState(state) {
  const core = document.getElementById("empty-core");
  if (!core) return;
  core.classList.remove("face-idle","face-thinking","face-searching","face-listening","face-speaking","face-working","face-happy","face-error","face-sleeping");
  core.classList.remove("shake");
  ["face-scan","face-dots","face-eq","face-bar","face-z"].forEach(id=>{
    const el=document.querySelector("#empty-core ."+id);
    if(el) el.style.display="none";
  });
  const mouth=document.querySelector("#empty-core .face-mouth");
  if(mouth) mouth.style.display="block";
  const ex=document.querySelector("#empty-core .eye-x");
  if(ex) ex.style.display="none";
  document.querySelectorAll("#empty-core .eye-core").forEach(e=>{e.style.display="flex"});
  core.classList.add("face-"+state);
  if(state==="thinking"){
    document.querySelectorAll("#empty-core .face-dots").forEach(e=>e.style.display="flex");
  }else if(state==="searching"){
    const sc=document.querySelector("#empty-core .face-scan"); if(sc) sc.style.display="block";
  }else if(state==="listening"){
    document.querySelectorAll("#empty-core .face-eq").forEach(e=>e.style.display="flex");
  }else if(state==="working"){
    const b=document.querySelector("#empty-core .face-bar"); if(b) b.style.display="block";
  }else if(state==="happy"){
    if(mouth) mouth.style.display="block";
  }else if(state==="error"){
    document.querySelectorAll("#empty-core .eye-core").forEach(e=>e.style.display="none");
    if(ex) ex.style.display="block";
    setTimeout(()=>core.classList.add("shake"),10);
  }else if(state==="sleeping"){
    document.querySelectorAll("#empty-core .face-z").forEach(e=>e.style.display="flex");
  }
}

function programarParpadeo() {
    const delay = 2500 + Math.random() * 4000
    setTimeout(() => {
        document.querySelectorAll(".eye-core").forEach(eye => {
            eye.classList.add("blink")
        })
        setTimeout(() => {
            document.querySelectorAll(".eye-core").forEach(eye => {
                eye.classList.remove("blink")
            })
        }, 140)
        programarParpadeo()
    }, delay)
}
programarParpadeo()
setFaceState("idle")

const I = {
    check: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M20 6 9 17l-5-5"/></svg>`,
    bot: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="14" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.4" fill="currentColor" stroke="none"/></svg>`,
    descarga: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>`,
    carpeta: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>`,
    x: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
}

/* =============================================
SIDEBAR + SESIONES (solo conversaciones reales)
============================================= */

function nuevaConversacion() {
    curSession = null
    historial = [historial[0]]
    chatEl.innerHTML = emptyStateHtml()
    const dots = document.querySelector(".typing")
    if (dots) dots.remove()
}

function emptyStateHtml() {
    return `
    <div class="empty-state">
        <div class="empty-aura">
            <div class="empty-scene">
                <div class="empty-orbit">
                    <div id="empty-core" class="folio-core" style="position:absolute;top:50%;left:50%;width:190px;height:190px;margin:-95px 0 0 -95px;border-radius:50%;animation:pulse 3.2s ease-in-out infinite">
                        <div class="eye-wrap">
                            <div class="eye-core" id="empty-eyeL"></div>
                            <div class="eye-core" id="empty-eyeR"></div>
                        </div>
                        <div style="position:absolute;top:18%;left:22%;width:34%;height:22%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.55),transparent 70%);filter:blur(2px)"></div>
                    </div>
                    <div class="ring" style="width:340px;height:340px;top:50%;left:50%;margin:-170px 0 0 -170px;transform:rotateX(70deg) rotateZ(0deg);animation:spinZ 9s linear infinite">
                        <div class="ringband"></div>
                        <div class="node" style="top:-15px;left:50%;margin-left:-24px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg></div>
                        <div class="node" style="bottom:-15px;left:50%;margin-left:-24px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
                    </div>
                    <div class="ring" style="width:300px;height:300px;top:50%;left:50%;margin:-150px 0 0 -150px;transform:rotateX(20deg) rotateY(70deg);animation:spinY 7s linear infinite">
                        <div class="ringband" style="border-color:#8fd4ff"></div>
                        <div class="node" style="top:50%;left:-15px;margin-top:-24px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg></div>
                        <div class="node" style="top:50%;right:-15px;margin-top:-24px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg></div>
                    </div>
                    <div style="position:absolute;top:50%;left:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#dff;box-shadow:0 0 18px 6px rgba(150,255,230,.9);z-index:5"></div>
                </div>
            </div>
        </div>
        <div style="font-size:13.5px; color:var(--text-mid); font-weight:600;">Fol</div>
        <div style="font-size:12px; max-width:280px;">¿En qué puedo ayudarte?</div>
    </div>`
}

function startSesion(texto) {
    curSession = {
        id: Date.now(),
        title: texto.trim().slice(0, 32) + (texto.trim().length > 32 ? "…" : ""),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        msgs: []
    }
    sessions.unshift(curSession)
    renderSesiones("")
    guardarSesiones()
}

function cargarSesion(s) {
    if (morfando) return
    curSession = s
    historial = [historial[0]]
    chatEl.innerHTML = `<div class="chat-inner" id="chat-inner"></div>`
    const inner = document.getElementById("chat-inner")
    s.msgs.forEach(m => inner.appendChild(renderMessage(m)))
    chatEl.scrollTop = chatEl.scrollHeight
    renderSesiones("")
}

function renderSesiones(filtro) {
    if (!sessionsEl) return
    sessionsEl.innerHTML = ""
    const q = (filtro || "").toLowerCase()
    const visibles = sessions.filter(s => !q || s.title.toLowerCase().includes(q))
    if (visibles.length === 0) return
    visibles.forEach(s => {
        const row = document.createElement("div")
        row.className = "session-item" + (s === curSession ? " active" : "")
        row.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <div class="session-info">
                <div class="session-title"></div>
                <div class="session-time"></div>
            </div>`
        row.querySelector(".session-title").textContent = s.title
        row.querySelector(".session-time").textContent = s.time
        row.addEventListener("click", () => cargarSesion(s))
        sessionsEl.appendChild(row)
    })
}

document.getElementById("new-chat").addEventListener("click", () => {
    nuevaConversacion()
    renderSesiones(searchInput ? searchInput.value : "")
})

document.getElementById("rail-new").addEventListener("click", () => {
    nuevaConversacion()
    renderSesiones(searchInput ? searchInput.value : "")
})

function contraerSidebar() {
    sidebar.classList.add("collapsed")
    rail.classList.add("show")
}

function expandirSidebar() {
    sidebar.classList.remove("collapsed")
    rail.classList.remove("show")
}

document.getElementById("rail-expand").addEventListener("click", () => {
    expandirSidebar()
    if (searchInput) searchInput.focus()
})

document.getElementById("collapse-btn").addEventListener("click", contraerSidebar)

document.getElementById("rail-search").addEventListener("click", () => {
    expandirSidebar()
    if (searchInput) searchInput.focus()
})

mainEl.addEventListener("click", () => {
    if (!sidebar.classList.contains("collapsed")) contraerSidebar()
})

if (searchInput) {
    searchInput.addEventListener("input", () => renderSesiones(searchInput.value))
}

/* =============================================
EXPANDIR / CONTRAER (morph burbuja <-> panel)
============================================= */

function abrirPanel() {
    if (expandida || morfando) return
    expandida = true
    contraerSidebar()
    ipcRenderer.send("expandir")
}

ipcRenderer.on("expansion-size", (e, w, h, ox, oy) => {
    if (!expandida) return
    morfando = true
    offX = ox || 0
    offY = oy || 0

    entidad.style.transition = "none"
    entidad.style.left = offX + "px"
    entidad.style.top = offY + "px"
    entidad.style.width = "85px"
    entidad.style.height = "85px"
    entidad.style.borderRadius = "50%"

    void entidad.offsetWidth

    entidad.style.transition = ""
    entidad.style.left = "0px"
    entidad.style.top = "0px"
    entidad.style.width = "100%"
    entidad.style.height = "100%"
    entidad.style.borderRadius = "27px"
    entidad.classList.add("open")

    requestAnimationFrame(() => {
        ipcRenderer.send("expandir-go")
    })

    setTimeout(() => {
        morfando = false
        if (expandida) input.focus()
    }, MORF_DURATION)
})

function cerrarPanel() {
    if (!expandida || morfando) return
    expandida = false
    morfando = true

    entidad.style.left = offX + "px"
    entidad.style.top = offY + "px"
    entidad.style.width = "85px"
    entidad.style.height = "85px"
    entidad.style.borderRadius = "50%"
    entidad.classList.remove("open")

    setTimeout(() => {
        ipcRenderer.send("contraer")
    }, MORF_DURATION)
}

ipcRenderer.on("collapse-done", () => {
    entidad.style.transition = "none"
    entidad.style.left = "0px"
    entidad.style.top = "0px"
    void entidad.offsetWidth
    entidad.style.transition = ""
    morfando = false
})

minBtn.addEventListener("click", cerrarPanel)

/* =============================================
DRAG DEL PANEL EXPANDIDO (barra superior)
(sin -webkit-app-region: los clics se comían a los botones)
============================================= */

const topbarEl = document.getElementById("topbar")
let tbDrag = false
let tbMoved = false
let tbStartX = 0, tbStartY = 0
let tbLastX = 0, tbLastY = 0

topbarEl.addEventListener("mousedown", (e) => {
    if (!expandida || morfando) return
    if (e.target.closest("button, input, textarea, select, a")) return
    tbDrag = true
    tbMoved = false
    tbStartX = e.screenX
    tbStartY = e.screenY
    tbLastX = e.screenX
    tbLastY = e.screenY
})

window.addEventListener("mousemove", (e) => {
    if (!tbDrag) return
    if (!tbMoved && (Math.abs(e.screenX - tbStartX) > 4 || Math.abs(e.screenY - tbStartY) > 4)) {
        tbMoved = true
    }
    if (tbMoved) {
        ipcRenderer.send("move-window", e.screenX - tbLastX, e.screenY - tbLastY)
        tbLastX = e.screenX
        tbLastY = e.screenY
    }
})

window.addEventListener("mouseup", () => {
    tbDrag = false
})

/* =============================================
DRAG + CLIC (burbuja)
============================================= */

let dragging = false
let moved = false
let pressX = 0, pressY = 0
let startX = 0, startY = 0
const DRAG_SLOP = 18

entidad.addEventListener("mousedown", (e) => {
    if (expandida) return
    dragging = true
    moved = false
    pressX = e.screenX
    pressY = e.screenY
    startX = e.screenX
    startY = e.screenY
})

window.addEventListener("mousemove", (e) => {
    if (!dragging || expandida) return
    if (!moved && (Math.abs(e.screenX - pressX) > DRAG_SLOP || Math.abs(e.screenY - pressY) > DRAG_SLOP)) {
        moved = true
    }
    if (moved) {
        ipcRenderer.send("move-window", e.screenX - startX, e.screenY - startY)
        startX = e.screenX
        startY = e.screenY
    }
})

window.addEventListener("mouseup", () => {
    if (!dragging) return
    dragging = false
    if (!moved) {
        abrirPanel()
    }
})

entidad.addEventListener("click", () => {
    if (!moved) abrirPanel()
})

/* =============================================
REDIMENSIONAR (ventana expandida)
============================================= */

let resizeTimer = null
window.addEventListener("resize", () => {
    if (!expandida) return
    if (morfando) return
    if (!entidad.classList.contains("open")) return

    entidad.style.transition = "border-radius .25s ease, background .3s ease"

    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
        entidad.style.transition = ""
    }, 200)
})

let resizing = false
let rType = null
let rStartX = 0, rStartY = 0, rW = 0, rH = 0

document.querySelectorAll(".rh").forEach(handle => {
    handle.addEventListener("mousedown", (e) => {
        if (!expandida) return
        resizing = true
        rType = handle.classList.contains("rh-corner")
            ? "corner"
            : handle.classList.contains("rh-bottom") ? "bottom" : "right"
        rStartX = e.screenX
        rStartY = e.screenY
        rW = window.innerWidth
        rH = window.innerHeight
        e.preventDefault()
        e.stopPropagation()
        entidad.style.transition = "border-radius .25s ease, background .3s ease"
    })
})

window.addEventListener("mousemove", (e) => {
    if (!resizing || !expandida) return
    let w = rW
    let h = rH
    if (rType !== "bottom") w = rW + (e.screenX - rStartX)
    if (rType !== "right") h = rH + (e.screenY - rStartY)
    ipcRenderer.send("resize-window", Math.round(w), Math.round(h))
})

window.addEventListener("mouseup", () => {
    if (!resizing) return
    resizing = false
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
        entidad.style.transition = ""
    }, 200)
})

/* =============================================
RENDER CHAT
============================================= */

function pushMensaje(m) {
    let inner = document.getElementById("chat-inner")
    if (!inner) {
        chatEl.innerHTML = `<div class="chat-inner" id="chat-inner"></div>`
        inner = document.getElementById("chat-inner")
    }
    inner.appendChild(renderMessage(m))
    chatEl.scrollTop = chatEl.scrollHeight
    if (m.role === "user" && !curSession) {
        startSesion(m.text)
        curSession.msgs.push(m)
        guardarSesiones()
        renderSesiones(searchInput ? searchInput.value : "")
    } else if (curSession) {
        curSession.msgs.push(m)
        guardarSesiones()
        renderSesiones(searchInput ? searchInput.value : "")
    }
}

function renderMessage(m) {
    const wrap = document.createElement("div")
    wrap.className = "msg " + m.role

    const avatar = document.createElement("div")
    avatar.className = "msg-avatar"
    avatar.innerHTML = m.role === "user" ? "Yo" : I.bot
    if (m.role === "user") {
        avatar.style.fontSize = "10.5px"
        avatar.style.fontWeight = "700"
    }
    wrap.appendChild(avatar)

    const body = document.createElement("div")
    body.className = "msg-body"

    if (m.role === "user") {
        const b = document.createElement("div")
        b.className = "msg-bubble-user"
        b.textContent = m.text
        body.appendChild(b)
    } else {
        const name = document.createElement("div")
        name.className = "msg-name"
        name.textContent = "Fol"
        body.appendChild(name)

        const t = document.createElement("div")
        t.className = "msg-text"
        t.innerHTML = toHtml(m.text)
        body.appendChild(t)
    }
    wrap.appendChild(body)
    return wrap
}

/* mini-markdown seguro: imagenes, enlaces, negrita, italica y codigo */
function esc(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}

function toHtml(text) {
    const piezas = []
    const fichRe = /<<<archivo:\s*([^\n]+)\n([\s\S]*?)>>>/g
    const imgRe = /!\[([^\]]*)\]\((https?:\/\/[^)\n]+)\)/g

    text = text.replace(fichRe, (all, nombre, contenido) => {
        const k = "__FICH" + piezas.length + "__"
        piezas.push(
            `<div class="archivo-card">` +
            `<span class="archivo-icono">${I.carpeta}</span>` +
            `<span class="archivo-nombre">${esc(nombre)}</span>` +
            `<button class="archivo-dl" data-nombre="${esc(nombre)}" data-contenido="${encodeURIComponent(contenido)}" title="Descargar">${I.descarga}</button>` +
            `</div>`
        )
        return k
    })

    text = text.replace(imgRe, (all, alt, url) => {
        const k = "__IMG" + piezas.length + "__"
        piezas.push(
            `<div class="gen-img">` +
            `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy">` +
            `<button class="gen-dl" data-src="${esc(url)}" title="Descargar imagen">${I.descarga}</button>` +
            `</div>`
        )
        return k
    })

    const html = esc(text)
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\n]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\n/g, "<br>")

    return html.replace(/__(FICH|IMG)(\d+)__/g, (m, tipo, idx) => {
        return piezas[+idx] || m
    })
}

chatEl.addEventListener("click", async (e) => {
    const dl = e.target.closest(".gen-dl, .archivo-dl")
    if (!dl) return
    if (dl.dataset.cargando) return
    dl.dataset.cargando = "1"
    dl.classList.add("descargando")
    const mostrarEstado = (texto) => {
        const s = document.createElement("span")
        s.className = "dl-status"
        s.textContent = texto
        dl.parentElement.style.position = "relative"
        dl.parentElement.appendChild(s)
        setTimeout(() => s.remove(), 2200)
    }
    try {
        if (dl.classList.contains("gen-dl")) {
            const url = dl.dataset.src
            const res = await fetch(url)
            const buf = await res.arrayBuffer()
            const nombre = (url.split("/").pop().split("?")[0]) || "imagen.png"
            const ok = await ipcRenderer.invoke("descargar-archivo", {
                nombre,
                bytes: Array.from(new Uint8Array(buf))
            })
            mostrarEstado(ok ? "Descargado ✓" : "Cancelado")
        } else {
            const contenido = decodeURIComponent(dl.dataset.contenido)
            const ok = await ipcRenderer.invoke("descargar-archivo", {
                nombre: dl.dataset.nombre,
                texto: contenido
            })
            mostrarEstado(ok ? "Descargado ✓" : "Cancelado")
        }
    } catch (err) {
        mostrarEstado("Error")
    }
    delete dl.dataset.cargando
    dl.classList.remove("descargando")
})

/* =============================================
INPUT
============================================= */

input.addEventListener("input", () => {
    input.style.height = "auto"
    input.style.height = Math.min(input.scrollHeight, 160) + "px"
    sendBtn.disabled = input.value.trim().length === 0
})

input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        setFaceState("thinking")
        enviarMensaje()
    }
})

sendBtn.addEventListener("click", ()=>{setFaceState("thinking"); enviarMensaje()})

/* =============================================
IA (Groq streaming)
============================================= */

async function preguntarGroq(mensajes, onToken) {
    historial.push({ role: "user", content: mensajes })
    historial = historial.slice(-20)
    try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-120b",
                messages: historial,
                temperature: 0.7,
                stream: true
            })
        })
        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error?.message || "HTTP " + res.status)
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let respuesta = ""
        for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            let idx
            while ((idx = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, idx).trim()
                buffer = buffer.slice(idx + 1)
                if (!line.startsWith("data: ")) continue
                const data = line.slice(6)
                if (data === "[DONE]") continue
                try {
                    const json = JSON.parse(data)
                    const token = json.choices?.[0]?.delta?.content || ""
                    if (token) {
                        respuesta += token
                        if (onToken) onToken(token)
                    }
                } catch { }
            }
        }
        historial.push({ role: "assistant", content: respuesta })
        return respuesta
    } catch (err) {
        setFaceState("error")
        setTimeout(()=>setFaceState("idle"), 1000)
        return "❌ " + err.message
    }
}

async function enviarMensaje() {
    const mensaje = input.value.trim()
    if (!mensaje) return

    if (!API_KEY) {
        pushMensaje({ role: "user", text: mensaje })
        pushMensaje({ role: "assistant", text: "Antes de chatear, abre Ajustes (⚙) y guarda tu API key de Groq." })
        input.value = ""
        input.style.height = "auto"
        sendBtn.disabled = true
        return
    }

    pushMensaje({ role: "user", text: mensaje })
    input.value = ""
    input.style.height = "auto"
    sendBtn.disabled = true

    const inner = document.getElementById("chat-inner")
    const typingWrap = document.createElement("div")
    typingWrap.className = "msg assistant"
    typingWrap.innerHTML = `<div class="msg-avatar">${I.bot}</div><div class="msg-body"><div class="msg-name">Fol</div><div class="typing"><span></span><span></span><span></span></div></div>`
    inner.appendChild(typingWrap)
    chatEl.scrollTop = chatEl.scrollHeight

    let acumulado = ""
    const textEl = document.createElement("div")
    textEl.className = "msg-text"

    setFaceState("speaking")
    const respuesta = await preguntarGroq(mensaje, (token) => {
        acumulado += token
        textEl.textContent = acumulado
        if (!textEl.isConnected) {
            typingWrap.querySelector(".typing").replaceWith(textEl)
        }
        chatEl.scrollTop = chatEl.scrollHeight
    })

    const typingEl = typingWrap.querySelector(".typing")
    if (typingEl) typingEl.replaceWith(textEl)
    textEl.innerHTML = toHtml(acumulado || respuesta)
    chatEl.scrollTop = chatEl.scrollHeight
    setFaceState("idle")
    if (curSession) {
        curSession.msgs.push({ role: "assistant", text: acumulado || respuesta })
        guardarSesiones()
        renderSesiones(searchInput ? searchInput.value : "")
    }
}

/* =============================================
VOZ (transcripción Whisper de Groq)
============================================= */

let mediaRec = null
let micChunks = []
let grabando = false

micBtn.addEventListener("click", async () => {
    if (!API_KEY) {
        pushMensaje({ role: "assistant", text: "Configura tu API key de Groq en Ajustes (⚙) para usar la voz." })
        return
    }
    if (grabando) {
        mediaRec.stop()
        return
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaRec = new MediaRecorder(stream)
        grabando = true
        setFaceState("listening")
        micBtn.classList.add("grabando")
        micChunks = []
        mediaRec.ondataavailable = e => { if (e.data.size) micChunks.push(e.data) }
        mediaRec.onstop = async () => {
            grabando = false
            micBtn.classList.remove("grabando")
            stream.getTracks().forEach(t => t.stop())
            setFaceState("idle")
            const blob = new Blob(micChunks, { type: "audio/webm" })
            const fd = new FormData()
            fd.append("file", blob, "audio.webm")
            fd.append("model", "whisper-large-v3-turbo")
            try {
                const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${API_KEY}` },
                    body: fd
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error?.message)
                const texto = (data.text || "").trim()
                if (!texto) throw new Error("No se entendió el audio")
                input.value = texto
                input.style.height = "auto"
                input.style.height = Math.min(input.scrollHeight, 160) + "px"
                sendBtn.disabled = false
                setFaceState("thinking"); enviarMensaje()
            } catch (err) {
                pushMensaje({ role: "user", text: "❌ " + err.message })
            }
        }
        mediaRec.start()
    } catch (err) {
        pushMensaje({ role: "user", text: "❌ Micrófono no disponible: " + err.message })
    }
})

/* =============================================
AJUSTES: PANEL DE COLORES
============================================= */

const settingsOverlay = document.getElementById("settings-overlay")

function abrirAjustes() {
    sincronizarInputsCara()
    const keyInput = document.getElementById("set-apikey")
    if (keyInput) keyInput.value = API_KEY || ""
    if (settingsOverlay) settingsOverlay.classList.add("show")
}

function cerrarAjustes() {
    if (settingsOverlay) settingsOverlay.classList.remove("show")
}

const settingsBtn = document.getElementById("settings-btn")
if (settingsBtn) {
    settingsBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        abrirAjustes()
    })
}

document.getElementById("settings-close")?.addEventListener("click", cerrarAjustes)
document.getElementById("settings-done")?.addEventListener("click", cerrarAjustes)

document.getElementById("settings-reset")?.addEventListener("click", () => {
    faceSettings = { ...FACE_DEFAULTS }
    aplicarCara(faceSettings)
    sincronizarInputsCara()
    guardarCara()
})

settingsOverlay?.addEventListener("click", (e) => {
    if (e.target === settingsOverlay) cerrarAjustes()
})

const saveKeyBtn = document.getElementById("settings-save-key")
if (saveKeyBtn) {
    saveKeyBtn.addEventListener("click", async () => {
        const el = document.getElementById("set-apikey")
        const estado = document.getElementById("apikey-estado")
        if (!el) return
        const key = el.value.trim()
        const ok = await ipcRenderer.invoke("apikey-guardar", key)
        if (ok) {
            API_KEY = key
            if (estado) {
                estado.textContent = key ? "Key guardada ✓" : "Key eliminada"
                estado.style.color = "var(--accent-hi)"
            }
        } else if (estado) {
            estado.textContent = "No se pudo guardar la key"
            estado.style.color = "#ff6b6b"
        }
        setTimeout(() => {
            if (estado) {
                estado.textContent = "Se guarda cifrada en este equipo. Sin key el chat no funciona."
                estado.style.color = ""
            }
        }, 2600)
    })
}

const CAMPOS_CARA = [
    ["set-face", "face"],
    ["set-glow", "glow"],
    ["set-eye", "eye"],
    ["set-mouth", "mouth"]
]

CAMPOS_CARA.forEach(([id, clave]) => {
    const el = document.getElementById(id)
    if (!el) return

    const aplicarSiValido = (guardar) => {
        let v = el.value.trim().toLowerCase()
        if (/^[0-9a-f]{6}$/.test(v)) v = "#" + v
        if (!/^#[0-9a-f]{6}$/.test(v)) return false
        el.value = v
        faceSettings[clave] = v
        aplicarCara(faceSettings)
        refrescarSwatches()
        if (guardar) guardarCara()
        return true
    }

    el.addEventListener("input", () => aplicarSiValido(true))
    el.addEventListener("blur", () => {
        aplicarSiValido(false)
        el.value = faceSettings[clave]
    })
    el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") el.blur()
    })
})

document.querySelectorAll(".color-swatches").forEach(box => {
    const input = document.getElementById(box.dataset.target)
    const par = CAMPOS_CARA.find(([id]) => id === box.dataset.target)
    if (!input || !par) return
    const clave = par[1]

    PALETA_CARA.forEach(color => {
        const b = document.createElement("button")
        b.type = "button"
        b.className = "color-swatch"
        b.style.background = color
        b.dataset.color = color
        b.title = color
        b.addEventListener("click", () => {
            input.value = color
            faceSettings[clave] = color
            aplicarCara(faceSettings)
            guardarCara()
            refrescarSwatches()
        })
        box.appendChild(b)
    })
})

/* =============================================
INIT
============================================= */

cargarCara()
cargarApiKey()
chatEl.innerHTML = emptyStateHtml()
renderSesiones("")
cargarSesionesGuardadas()