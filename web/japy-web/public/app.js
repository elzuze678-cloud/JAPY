/* =========================================================
   JAPY WEB - APP.JS
   ========================================================= */


/* =========================================================
   ESTADO GENERAL
   ========================================================= */

let currentUser = null;
let currentEvents = [];
let pushButton = null;


/* =========================================================
   VOZ - ESTADO
   ========================================================= */

let speechRecognition = null;

const speechSynthesisSupported =
    "speechSynthesis" in window;

const speechRecognitionSupported =
    "SpeechRecognition" in window ||
    "webkitSpeechRecognition" in window;

let voiceEnabled = false;
let isListening = false;
let restartingRecognition = false;

let japyAwake = false;
let japySpeaking = false;

let japyWakeTimeout = null;

let voiceStartupPending = false;


/* =========================================================
   VOZ - CONFIGURACIÓN
   ========================================================= */

const JAPY_AWAKE_TIME =
    3 * 60 * 1000;


/* =========================================================
   WAKE WORDS
   ========================================================= */

const WAKE_WORDS = [
    "japy",
    "japi",

    "yapi",
    "yapy",
    "yabi",

    "ya vi",
    "yavi",

    "hapy",
    "happy",

    "abi",
    "abby",

    "papi",

    "jovi",
    "jovy",
    "jobi",
    "joby",

    "yobi",
    "yoby",

    "javi",
];

/* =========================================================
   ELEMENTOS
   ========================================================= */

const authView =
    document.getElementById("authView");

const dashboardView =
    document.getElementById("dashboardView");

const loginTab =
    document.getElementById("loginTab");

const registerTab =
    document.getElementById("registerTab");

const loginForm =
    document.getElementById("loginForm");

const registerForm =
    document.getElementById("registerForm");

const loginMessage =
    document.getElementById("loginMessage");

const registerMessage =
    document.getElementById("registerMessage");

const userName =
    document.getElementById("userName");

const greeting =
    document.getElementById("greeting");

const eventsList =
    document.getElementById("eventsList");

const logoutButton =
    document.getElementById("logoutButton");

const createEventButton =
    document.getElementById("createEventButton");

const eventModal =
    document.getElementById("eventModal");

const closeEventModal =
    document.getElementById("closeEventModal");

const createEventForm =
    document.getElementById("createEventForm");

const eventTitle =
    document.getElementById("eventTitle");

const eventDate =
    document.getElementById("eventDate");

const eventTime =
    document.getElementById("eventTime");

const eventMessage =
    document.getElementById("eventMessage");

const chatMessages =
    document.getElementById("chatMessages");

const chatForm =
    document.getElementById("chatForm");

const chatInput =
    document.getElementById("chatInput");

const voiceButton =
    document.getElementById("voiceButton");

const googleSignInButton =
    document.getElementById("googleSignInButton");


/* =========================================================
   GOOGLE
   ========================================================= */

const GOOGLE_CLIENT_ID =
    "691280235308-vkkhussogkn6p8kfn0mc3fj3jt1kvclj.apps.googleusercontent.com";


/* =========================================================
   UTILIDADES
   ========================================================= */

function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDate(date) {
    if (!date) {
        return "";
    }

    const parts =
        date.split("-");

    if (parts.length !== 3) {
        return date;
    }

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getUserTimezone() {
    return (
        Intl.DateTimeFormat()
            .resolvedOptions()
            .timeZone ||
        "America/Santiago"
    );
}

function getInputValue(
    form,
    names = [],
    ids = []
) {
    if (!form) {
        return "";
    }

    for (const name of names) {
        const input =
            form.querySelector(
                `[name="${name}"]`
            );

        if (
            input &&
            typeof input.value === "string"
        ) {
            const value =
                input.value.trim();

            if (value) {
                return value;
            }
        }
    }

    for (const id of ids) {
        const input =
            document.getElementById(id);

        if (
            input &&
            typeof input.value === "string"
        ) {
            const value =
                input.value.trim();

            if (value) {
                return value;
            }
        }
    }

    return "";
}


/* =========================================================
   LOGIN / REGISTRO
   ========================================================= */

function showLogin() {
    if (loginTab) {
        loginTab.classList.add("active");
    }

    if (registerTab) {
        registerTab.classList.remove("active");
    }

    if (loginForm) {
        loginForm.classList.remove("hidden");
    }

    if (registerForm) {
        registerForm.classList.add("hidden");
    }
}

function showRegister() {
    if (registerTab) {
        registerTab.classList.add("active");
    }

    if (loginTab) {
        loginTab.classList.remove("active");
    }

    if (registerForm) {
        registerForm.classList.remove("hidden");
    }

    if (loginForm) {
        loginForm.classList.add("hidden");
    }
}

if (loginTab) {
    loginTab.addEventListener(
        "click",
        showLogin
    );
}

if (registerTab) {
    registerTab.addEventListener(
        "click",
        showRegister
    );
}


/* =========================================================
   AUTENTICACIÓN
   ========================================================= */

async function checkSession() {
    try {
        const response =
            await fetch(
                "/api/me",
                {
                    credentials:
                        "include",
                }
            );

        if (!response.ok) {
            showAuth();
            return;
        }

        const data =
            await response.json();

        if (
            data.authenticated &&
            data.user
        ) {
            currentUser =
                data.user;

            showDashboard();

            await loadEvents();

            setTimeout(
                autoStartVoice,
                500
            );

            return;
        }

        showAuth();

    } catch (error) {
        console.error(
            "SESSION ERROR:",
            error
        );

        showAuth();
    }
}

function showAuth() {
    stopVoiceSystem();

    if (authView) {
        authView.classList.remove(
            "hidden"
        );
    }

    if (dashboardView) {
        dashboardView.classList.add(
            "hidden"
        );
    }

    removePushButton();
}

function showDashboard() {
    if (authView) {
        authView.classList.add(
            "hidden"
        );
    }

    if (dashboardView) {
        dashboardView.classList.remove(
            "hidden"
        );
    }

    if (currentUser) {
        if (userName) {
            userName.textContent =
                currentUser.name;
        }

        if (greeting) {
            greeting.textContent =
                `¡Hola, ${currentUser.name}!`;
        }
    }

    createPushButton();
}


/* =========================================================
   LOGIN
   ========================================================= */

if (loginForm) {
    loginForm.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            if (loginMessage) {
                loginMessage.textContent =
                    "";
            }

            const email =
                getInputValue(
                    loginForm,
                    ["email"],
                    [
                        "loginEmail",
                        "email",
                    ]
                );

            const password =
                getInputValue(
                    loginForm,
                    ["password"],
                    [
                        "loginPassword",
                        "password",
                    ]
                );

            if (
                !email ||
                !password
            ) {
                if (loginMessage) {
                    loginMessage.textContent =
                        "Debes llenar todos los campos.";
                }

                return;
            }

            try {
                const response =
                    await fetch(
                        "/api/login",
                        {
                            method:
                                "POST",

                            credentials:
                                "include",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    email,
                                    password,
                                }),
                        }
                    );

                const data =
                    await response.json();

                if (!response.ok) {
                    if (
                        loginMessage
                    ) {
                        loginMessage.textContent =
                            data.error ||
                            "No se pudo iniciar sesión.";
                    }

                    return;
                }

                currentUser =
                    data.user;

                loginForm.reset();

                showDashboard();

                await loadEvents();

                setTimeout(
                    autoStartVoice,
                    500
                );

            } catch (error) {
                console.error(
                    "LOGIN ERROR:",
                    error
                );

                if (
                    loginMessage
                ) {
                    loginMessage.textContent =
                        "No se pudo conectar con JAPY.";
                }
            }
        }
    );
}


/* =========================================================
   REGISTRO
   ========================================================= */

if (registerForm) {
    registerForm.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            if (
                registerMessage
            ) {
                registerMessage.textContent =
                    "";
            }

            const name =
                getInputValue(
                    registerForm,
                    ["name"],
                    [
                        "registerName",
                        "name",
                    ]
                );

            const email =
                getInputValue(
                    registerForm,
                    ["email"],
                    [
                        "registerEmail",
                        "email",
                    ]
                );

            const password =
                getInputValue(
                    registerForm,
                    ["password"],
                    [
                        "registerPassword",
                        "password",
                    ]
                );

            if (
                !name ||
                !email ||
                !password
            ) {
                if (
                    registerMessage
                ) {
                    registerMessage.textContent =
                        "Debes llenar todos los campos.";
                }

                return;
            }

            try {
                const response =
                    await fetch(
                        "/api/register",
                        {
                            method:
                                "POST",

                            credentials:
                                "include",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    name,
                                    email,
                                    password,
                                }),
                        }
                    );

                const data =
                    await response.json();

                if (!response.ok) {
                    if (
                        registerMessage
                    ) {
                        registerMessage.textContent =
                            data.error ||
                            "No se pudo crear la cuenta.";
                    }

                    return;
                }

                registerForm.reset();

                showLogin();

                if (
                    loginMessage
                ) {
                    loginMessage.textContent =
                        "Cuenta creada correctamente. Ahora inicia sesión.";
                }

            } catch (error) {
                console.error(
                    "REGISTER ERROR:",
                    error
                );

                if (
                    registerMessage
                ) {
                    registerMessage.textContent =
                        "No se pudo conectar con JAPY.";
                }
            }
        }
    );
}


/* =========================================================
   GOOGLE - LOGIN
   ========================================================= */

async function handleGoogleCredential(
    response
) {
    if (
        !response ||
        !response.credential
    ) {
        console.error(
            "GOOGLE LOGIN: no se recibió credential."
        );

        if (loginMessage) {
            loginMessage.textContent =
                "Google no pudo completar el inicio de sesión.";
        }

        return;
    }

    if (loginMessage) {
        loginMessage.textContent =
            "Conectando con Google...";
    }

    try {
        const backendResponse =
            await fetch(
                "/api/auth/google",
                {
                    method:
                        "POST",

                    credentials:
                        "include",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body:
                        JSON.stringify({
                            credential:
                                response.credential,
                        }),
                }
            );

        const data =
            await backendResponse.json();

        if (
            !backendResponse.ok
        ) {
            console.error(
                "GOOGLE BACKEND ERROR:",
                data
            );

            if (loginMessage) {
                loginMessage.textContent =
                    data.error ||
                    "No se pudo iniciar sesión con Google.";
            }

            return;
        }

        currentUser =
            data.user;

        if (loginForm) {
            loginForm.reset();
        }

        showDashboard();

        await loadEvents();

        console.log(
            "JAPY GOOGLE: sesión iniciada."
        );

        setTimeout(
            autoStartVoice,
            500
        );

    } catch (error) {
        console.error(
            "GOOGLE LOGIN ERROR:",
            error
        );

        if (loginMessage) {
            loginMessage.textContent =
                "No se pudo conectar con Google.";
        }
    }
}

function initializeGoogleSignIn() {
    if (
        !googleSignInButton
    ) {
        return;
    }

    if (
        !window.google ||
        !window.google.accounts ||
        !window.google.accounts.id
    ) {
        setTimeout(
            initializeGoogleSignIn,
            500
        );

        return;
    }

    try {
        window.google.accounts.id.initialize({
            client_id:
                GOOGLE_CLIENT_ID,

            callback:
                handleGoogleCredential,

            auto_select:
                false,

            cancel_on_tap_outside:
                true,
        });

        googleSignInButton.innerHTML =
            "";

        window.google.accounts.id.renderButton(
            googleSignInButton,
            {
                type:
                    "standard",

                theme:
                    "outline",

                size:
                    "large",

                text:
                    "continue_with",

                shape:
                    "rectangular",

                width:
                    320,

                logo_alignment:
                    "left",
            }
        );

    } catch (error) {
        console.error(
            "GOOGLE INIT ERROR:",
            error
        );
    }
}


/* =========================================================
   LOGOUT
   ========================================================= */

if (logoutButton) {
    logoutButton.addEventListener(
        "click",
        async () => {
            stopVoiceSystem();

            try {
                await fetch(
                    "/api/logout",
                    {
                        method:
                            "POST",

                        credentials:
                            "include",
                    }
                );

            } catch (error) {
                console.error(
                    "LOGOUT ERROR:",
                    error
                );
            }

            currentUser =
                null;

            currentEvents =
                [];

            removePushButton();

            showAuth();
        }
    );
}


/* =========================================================
   EVENTOS
   ========================================================= */

async function loadEvents() {
    try {
        const response =
            await fetch(
                "/api/events",
                {
                    credentials:
                        "include",
                }
            );

        if (!response.ok) {
            return;
        }

        const data =
            await response.json();

        currentEvents =
            data.events ||
            [];

        renderEvents(
            currentEvents
        );

    } catch (error) {
        console.error(
            "LOAD EVENTS ERROR:",
            error
        );
    }
}

function renderEvents(
    events
) {
    if (!eventsList) {
        return;
    }

    if (!events.length) {
        eventsList.innerHTML = `
            <div class="empty-state">
                <p>No tienes eventos todavía.</p>
            </div>
        `;

        return;
    }

    eventsList.innerHTML =
        events
            .map(
                (event) => {
                    return `
                        <div
                            class="event-card"
                            data-event-id="${escapeHtml(event.id)}"
                        >
                            <div class="event-info">
                                <h3>
                                    ${escapeHtml(event.title)}
                                </h3>

                                <p>
                                    📅 ${formatDate(event.date)}

                                    ${
                                        event.time
                                            ? ` · ⏰ ${escapeHtml(event.time)}`
                                            : ""
                                    }
                                </p>
                            </div>

                            <button
                                type="button"
                                class="delete-event-button"
                                data-event-id="${escapeHtml(event.id)}"
                            >
                                🗑️
                            </button>
                        </div>
                    `;
                }
            )
            .join("");

    const deleteButtons =
        eventsList.querySelectorAll(
            ".delete-event-button"
        );

    deleteButtons.forEach(
        (button) => {
            button.addEventListener(
                "click",
                async () => {
                    const eventId =
                        button.dataset
                            .eventId;

                    await deleteEvent(
                        eventId
                    );
                }
            );
        }
    );
}

async function deleteEvent(
    eventId
) {
    try {
        const response =
            await fetch(
                `/api/events/${encodeURIComponent(eventId)}`,
                {
                    method:
                        "DELETE",

                    credentials:
                        "include",
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            alert(
                data.error ||
                "No se pudo eliminar el evento."
            );

            return;
        }

        await loadEvents();

    } catch (error) {
        console.error(
            "DELETE EVENT ERROR:",
            error
        );

        alert(
            "No se pudo conectar con JAPY."
        );
    }
}


/* =========================================================
   MODAL
   ========================================================= */

function openEventModal() {
    if (eventModal) {
        eventModal.classList.remove(
            "hidden"
        );
    }
}

function closeEventModalFunction() {
    if (eventModal) {
        eventModal.classList.add(
            "hidden"
        );
    }

    if (createEventForm) {
        createEventForm.reset();
    }

    if (eventMessage) {
        eventMessage.textContent =
            "";
    }
}

if (createEventButton) {
    createEventButton.addEventListener(
        "click",
        openEventModal
    );
}

if (closeEventModal) {
    closeEventModal.addEventListener(
        "click",
        closeEventModalFunction
    );
}

if (eventModal) {
    eventModal.addEventListener(
        "click",
        (event) => {
            if (
                event.target ===
                eventModal
            ) {
                closeEventModalFunction();
            }
        }
    );
}


/* =========================================================
   CREAR EVENTO
   ========================================================= */

if (createEventForm) {
    createEventForm.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            const title =
                eventTitle?.value?.trim();

            const date =
                eventDate?.value;

            const time =
                eventTime?.value;

            if (
                !title ||
                !date
            ) {
                if (
                    eventMessage
                ) {
                    eventMessage.textContent =
                        "Completa el título y la fecha.";
                }

                return;
            }

            try {
                const response =
                    await fetch(
                        "/api/events",
                        {
                            method:
                                "POST",

                            credentials:
                                "include",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    title,

                                    date,

                                    time:
                                        time ||
                                        null,

                                    timezone:
                                        getUserTimezone(),
                                }),
                        }
                    );

                const data =
                    await response.json();

                if (!response.ok) {
                    if (
                        eventMessage
                    ) {
                        eventMessage.textContent =
                            data.error ||
                            "No se pudo crear el evento.";
                    }

                    return;
                }

                closeEventModalFunction();

                await loadEvents();

            } catch (error) {
                console.error(
                    "CREATE EVENT ERROR:",
                    error
                );

                if (
                    eventMessage
                ) {
                    eventMessage.textContent =
                        "No se pudo conectar con JAPY.";
                }
            }
        }
    );
}


/* =========================================================
   CHAT
   ========================================================= */

function addChatMessage(
    text,
    sender = "japy"
) {
    if (!chatMessages) {
        return;
    }

    const message =
        document.createElement(
            "div"
        );

    message.className =
        `chat-message ${sender}-message`;

    const author =
        sender === "japy"
            ? "JAPY"
            : "Tú";

    message.innerHTML = `
        <div class="chat-author">
            ${author}
        </div>

        <div class="chat-bubble">
            ${escapeHtml(text)}
        </div>
    `;

    chatMessages.appendChild(
        message
    );

    chatMessages.scrollTop =
        chatMessages.scrollHeight;
}


/* =========================================================
   TEXTO → VOZ
   ========================================================= */

function speakText(
    text
) {
    if (
        !speechSynthesisSupported ||
        !text
    ) {
        return Promise.resolve();
    }

    return new Promise(
        (resolve) => {
            try {
                japySpeaking =
                    true;

                pauseRecognitionForSpeech();

                window.speechSynthesis.cancel();

                const utterance =
                    new SpeechSynthesisUtterance(
                        String(text)
                    );

                utterance.lang =
                    "es-ES";

                utterance.rate =
                    1;

                utterance.pitch =
                    1;

                utterance.volume =
                    1;

                utterance.onend =
                    () => {
                        japySpeaking =
                            false;

                        resolve();

                        resumeRecognitionAfterSpeech();
                    };

                utterance.onerror =
                    () => {
                        japySpeaking =
                            false;

                        resolve();

                        resumeRecognitionAfterSpeech();
                    };

                window.speechSynthesis.speak(
                    utterance
                );

            } catch (error) {

                console.error(
                    "TTS ERROR:",
                    error
                );

                japySpeaking =
                    false;

                resolve();

                resumeRecognitionAfterSpeech();
            }
        }
    );
}


/* =========================================================
   CHAT → JAPY
   ========================================================= */

async function sendToJapy(
    text
) {
    const cleanText =
        String(text || "")
            .trim();

    if (!cleanText) {
        return;
    }

    addChatMessage(
        cleanText,
        "user"
    );

    if (japyAwake) {
        refreshJapyAwakeTimer();
    }

    try {
        const response =
            await fetch(
                "/api/chat",
                {
                    method:
                        "POST",

                    credentials:
                        "include",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body:
                        JSON.stringify({
                            message:
                                cleanText,

                            timezone:
                                getUserTimezone(),
                        }),
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            const errorMessage =
                data.error ||
                "No pude procesar tu mensaje.";

            addChatMessage(
                errorMessage,
                "japy"
            );

            if (japyAwake) {
                refreshJapyAwakeTimer();
            }

            await speakText(
                errorMessage
            );

            return;
        }

        const responseText =
            data.response ||
            "Entendido.";

        addChatMessage(
            responseText,
            "japy"
        );

        if (japyAwake) {
            refreshJapyAwakeTimer();
        }

        await speakText(
            responseText
        );

        if (
            japyAwake &&
            voiceEnabled
        ) {
            refreshJapyAwakeTimer();
        }

        if (
            data.type ===
                "event_created" ||
            data.type ===
                "event_deleted" ||
            data.type ===
                "event_updated" ||
            data.type ===
                "events"
        ) {
            await loadEvents();
        }

    } catch (error) {
        console.error(
            "CHAT ERROR:",
            error
        );

        const errorMessage =
            "No pude conectar con JAPY.";

        addChatMessage(
            errorMessage,
            "japy"
        );

        await speakText(
            errorMessage
        );

        if (japyAwake) {
            refreshJapyAwakeTimer();
        }
    }
}


/* =========================================================
   FORMULARIO CHAT
   ========================================================= */

if (chatForm) {
    chatForm.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            const text =
                chatInput?.value?.trim();

            if (!text) {
                return;
            }

            chatInput.value =
                "";

            await sendToJapy(
                text
            );
        }
    );
}


/* =========================================================
   VOZ - NORMALIZACIÓN
   ========================================================= */

function normalizeVoiceText(
    text
) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[¿?¡!.,;:]/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}


/* =========================================================
   VOZ - BUSCAR WAKE WORD
   ========================================================= */

function findWakeWord(
    text
) {
    const originalText =
        String(text || "")
            .trim();

    if (!originalText) {
        return null;
    }

    const originalWords =
        originalText.split(
            /\s+/
        );

    const normalizedWords =
        originalWords.map(
            (word) =>
                normalizeVoiceText(
                    word
                )
        );

    for (
        const wakeWord
        of WAKE_WORDS
    ) {
        const wakeWords =
            normalizeVoiceText(
                wakeWord
            ).split(" ");

        if (!wakeWords.length) {
            continue;
        }

        for (
            let i = 0;
            i <=
                normalizedWords.length -
                    wakeWords.length;
            i++
        ) {
            let matches =
                true;

            for (
                let j = 0;
                j < wakeWords.length;
                j++
            ) {
                if (
                    normalizedWords[
                        i + j
                    ] !==
                    wakeWords[j]
                ) {
                    matches =
                        false;

                    break;
                }
            }

            if (matches) {
                return {
                    wakeWord,

                    startIndex:
                        i,

                    command:
                        originalWords
                            .slice(
                                i +
                                    wakeWords.length
                            )
                            .join(" ")
                            .trim(),
                };
            }
        }
    }

    return null;
}


/* =========================================================
   VOZ - ESTADO VISUAL
   ========================================================= */

function updateVoiceButton() {

    if (!voiceButton) {
        return;
    }

    if (!voiceEnabled) {

        voiceButton.textContent =
            "🎙️ Activar voz";

        voiceButton.classList.remove(
            "voice-active"
        );

        return;
    }

    if (japyAwake) {

        voiceButton.textContent =
            "🟢 JAPY despierto";

        voiceButton.classList.add(
            "voice-active"
        );

        return;
    }

    voiceButton.textContent =
        "😴 JAPY en reposo";

    voiceButton.classList.remove(
        "voice-active"
    );
}


/* =========================================================
   VOZ - DESPERTAR
   ========================================================= */

function wakeJapy() {

    japyAwake =
        true;

    console.log(
        "JAPY VOZ: JAPY despierto."
    );

    updateVoiceButton();

    refreshJapyAwakeTimer();
}


/* =========================================================
   VOZ - TEMPORIZADOR 3 MINUTOS
   ========================================================= */

function refreshJapyAwakeTimer() {

    if (!japyAwake) {
        return;
    }

    clearTimeout(
        japyWakeTimeout
    );

    japyWakeTimeout =
        setTimeout(
            () => {

                sleepJapy();

            },
            JAPY_AWAKE_TIME
        );
}


/* =========================================================
   VOZ - DORMIR
   ========================================================= */

function sleepJapy() {

    japyAwake =
        false;

    clearTimeout(
        japyWakeTimeout
    );

    japyWakeTimeout =
        null;

    console.log(
        "JAPY VOZ: JAPY entra en reposo."
    );

    updateVoiceButton();
}


/* =========================================================
   VOZ - PAUSAR DURANTE TTS
   ========================================================= */

function pauseRecognitionForSpeech() {

    if (!speechRecognition) {
        return;
    }

    try {

        speechRecognition.stop();

    } catch (error) {

        console.warn(
            "JAPY VOZ: no se pudo pausar reconocimiento.",
            error
        );
    }
}


/* =========================================================
   VOZ - REANUDAR DESPUÉS DE TTS
   ========================================================= */

function resumeRecognitionAfterSpeech() {

    if (
        !voiceEnabled ||
        !speechRecognition ||
        japySpeaking
    ) {
        return;
    }

    setTimeout(
        () => {

            if (
                !voiceEnabled ||
                !speechRecognition ||
                japySpeaking ||
                isListening
            ) {
                return;
            }

            try {

                speechRecognition.start();

            } catch (error) {

                console.warn(
                    "JAPY VOZ: no se pudo reanudar reconocimiento.",
                    error
                );
            }

        },
        350
    );
}


/* =========================================================
   VOZ - CREAR RECONOCIMIENTO
   ========================================================= */

function createSpeechRecognition() {

    if (
        !speechRecognitionSupported
    ) {
        return null;
    }

    const Recognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!Recognition) {
        return null;
    }

    const recognition =
        new Recognition();

    recognition.lang =
        "es-ES";

    recognition.continuous =
        true;

    recognition.interimResults =
        true;

    recognition.maxAlternatives =
        1;


    /* =====================================================
       START
       ===================================================== */

    recognition.onstart =
        () => {

            isListening =
                true;

            restartingRecognition =
                false;

            updateVoiceButton();

            console.log(
                "JAPY VOZ: reconocimiento iniciado."
            );
        };


    /* =====================================================
       RESULT
       ===================================================== */

    recognition.onresult =
        async (event) => {

            /*
             * SOLO procesamos resultados finales.
             */

            let finalTranscript =
                "";

            for (
                let i =
                    event.resultIndex;

                i <
                    event.results.length;

                i++
            ) {

                const result =
                    event.results[i];

                if (
                    result &&
                    result.isFinal
                ) {
                    finalTranscript +=
                        result[0]
                            .transcript +
                        " ";
                }
            }

            finalTranscript =
                finalTranscript
                    .trim();

            if (!finalTranscript) {
                return;
            }

            console.log(
                "JAPY VOZ FINAL:",
                finalTranscript
            );


            /*
             * JAPY no debe escuchar
             * su propia voz.
             */

            if (japySpeaking) {
                return;
            }


            /* =================================================
               JAPY DORMIDO
               ================================================= */

            if (!japyAwake) {

                const wakeResult =
                    findWakeWord(
                        finalTranscript
                    );

                if (!wakeResult) {

                    /*
                     * En reposo ignoramos
                     * cualquier cosa que no
                     * sea una Wake Word.
                     */

                    return;
                }


                console.log(
                    "JAPY VOZ: wake word detectada:",
                    wakeResult.wakeWord
                );


                wakeJapy();


                const command =
                    wakeResult.command;


                console.log(
                    "JAPY VOZ: comando extraído:",
                    command ||
                        "(sin comando)"
                );


                /*
                 * SOLO "JAPY"
                 */

                if (!command) {

                    await speakText(
                        "Sí, te escucho."
                    );

                    return;
                }


                /*
                 * "JAPY + COMANDO"
                 */

                await sendToJapy(
                    command
                );

                return;
            }


            /* =================================================
               JAPY DESPIERTO
               ================================================= */

            /*
             * Ya está despierto.
             *
             * NO buscamos Wake Word.
             *
             * Todo resultado final
             * es conversación.
             */

            refreshJapyAwakeTimer();

            await sendToJapy(
                finalTranscript
            );
        };


    /* =====================================================
       ERROR
       ===================================================== */

    recognition.onerror =
        (event) => {

            console.warn(
                "JAPY VOZ ERROR:",
                event.error
            );

            isListening =
                false;


            if (
                event.error ===
                    "not-allowed" ||
                event.error ===
                    "service-not-allowed"
            ) {

                voiceEnabled =
                    false;

                voiceStartupPending =
                    true;

                sleepJapy();

                updateVoiceButton();

                console.warn(
                    "JAPY VOZ: el navegador no permitió el micrófono."
                );

                return;
            }


            if (
                event.error ===
                "no-speech"
            ) {

                return;
            }
        };


    /* =====================================================
       END
       ===================================================== */

    recognition.onend =
        () => {

            isListening =
                false;

            console.log(
                "JAPY VOZ: reconocimiento detenido."
            );


            /*
             * El micrófono debe seguir vivo
             * mientras voiceEnabled sea true.
             */

            if (
                voiceEnabled &&
                !japySpeaking &&
                !restartingRecognition
            ) {

                restartingRecognition =
                    true;

                setTimeout(
                    () => {

                        if (
                            !voiceEnabled ||
                            !speechRecognition ||
                            japySpeaking
                        ) {

                            restartingRecognition =
                                false;

                            return;
                        }

                        try {

                            speechRecognition.start();

                        } catch (error) {

                            console.warn(
                                "JAPY VOZ RESTART:",
                                error
                            );
                        }

                    },
                    350
                );

            } else {

                updateVoiceButton();
            }
        };


    return recognition;
}


/* =========================================================
   VOZ - INICIAR
   ========================================================= */

function startVoiceSystem() {

    if (
        !speechRecognitionSupported
    ) {

        console.warn(
            "JAPY VOZ: el navegador no soporta reconocimiento de voz."
        );

        return false;
    }


    if (!currentUser) {
        return false;
    }


    if (voiceEnabled) {
        return true;
    }


    speechRecognition =
        createSpeechRecognition();


    if (!speechRecognition) {

        console.error(
            "JAPY VOZ: no se pudo crear SpeechRecognition."
        );

        return false;
    }


    voiceEnabled =
        true;

    japyAwake =
        false;


    updateVoiceButton();


    try {

        speechRecognition.start();

        console.log(
            'JAPY VOZ: micrófono activado. Esperando "JAPY".'
        );

        return true;

    } catch (error) {

        console.warn(
            "JAPY VOZ START:",
            error
        );

        voiceEnabled =
            false;

        speechRecognition =
            null;

        updateVoiceButton();

        return false;
    }
}


/* =========================================================
   VOZ - AUTO START
   ========================================================= */

function autoStartVoice() {

    if (!currentUser) {
        return;
    }

    if (voiceEnabled) {
        return;
    }

    const started =
        startVoiceSystem();

    if (started) {

        voiceStartupPending =
            false;

        return;
    }

    /*
     * Si el navegador exige interacción,
     * el siguiente clic o tecla permitirá
     * intentar iniciar el micrófono.
     */

    voiceStartupPending =
        true;

    console.log(
        "JAPY VOZ: esperando interacción para activar el micrófono."
    );
}


/* =========================================================
   VOZ - ACTIVACIÓN DESPUÉS DE INTERACCIÓN
   ========================================================= */

function handleFirstVoiceInteraction() {

    if (
        !voiceStartupPending ||
        !currentUser ||
        voiceEnabled
    ) {
        return;
    }

    voiceStartupPending =
        false;

    const started =
        startVoiceSystem();

    if (!started) {

        voiceStartupPending =
            true;
    }
}

document.addEventListener(
    "pointerdown",
    handleFirstVoiceInteraction,
    {
        passive: true,
    }
);

document.addEventListener(
    "keydown",
    handleFirstVoiceInteraction,
    {
        passive: true,
    }
);


/* =========================================================
   VOZ - DETENER
   ========================================================= */

function stopVoiceSystem() {

    voiceEnabled =
        false;

    isListening =
        false;

    restartingRecognition =
        false;

    japyAwake =
        false;

    japySpeaking =
        false;

    voiceStartupPending =
        false;


    clearTimeout(
        japyWakeTimeout
    );

    japyWakeTimeout =
        null;


    if (speechRecognition) {

        try {

            speechRecognition.stop();

        } catch (error) {

            console.warn(
                "VOICE STOP ERROR:",
                error
            );
        }
    }


    speechRecognition =
        null;


    if (
        speechSynthesisSupported
    ) {

        window.speechSynthesis.cancel();
    }


    updateVoiceButton();
}


/* =========================================================
   VOZ - BOTÓN SECUNDARIO
   ========================================================= */

if (voiceButton) {

    voiceButton.addEventListener(
        "click",
        () => {

            if (voiceEnabled) {

                stopVoiceSystem();

                console.log(
                    "JAPY VOZ: micrófono desactivado manualmente."
                );

                return;
            }

            startVoiceSystem();
        }
    );
}


/* =========================================================
   PUSH - BASE64
   ========================================================= */

function urlBase64ToUint8Array(
    base64String
) {

    const padding =
        "=".repeat(
            (4 -
                (base64String.length %
                    4)) %
                4
        );

    const base64 =
        (
            base64String +
            padding
        )
            .replace(
                /-/g,
                "+"
            )
            .replace(
                /_/g,
                "/"
            );

    const rawData =
        window.atob(
            base64
        );

    const outputArray =
        new Uint8Array(
            rawData.length
        );

    for (
        let i = 0;
        i < rawData.length;
        ++i
    ) {

        outputArray[i] =
            rawData.charCodeAt(i);
    }

    return outputArray;
}


/* =========================================================
   PUSH - CREAR BOTÓN
   ========================================================= */

function createPushButton() {

    if (
        pushButton ||
        !dashboardView ||
        !currentUser
    ) {
        return;
    }

    pushButton =
        document.createElement(
            "button"
        );

    pushButton.type =
        "button";

    pushButton.id =
        "pushNotificationButton";

    pushButton.className =
        "push-notification-button";

    pushButton.textContent =
        "🔔 Activar notificaciones";

    pushButton.addEventListener(
        "click",
        enablePushNotifications
    );

    dashboardView.prepend(
        pushButton
    );

    checkPushSubscriptionStatus();
}


/* =========================================================
   PUSH - ELIMINAR BOTÓN
   ========================================================= */

function removePushButton() {

    if (pushButton) {

        pushButton.remove();

        pushButton =
            null;
    }
}


/* =========================================================
   PUSH - ESTADO
   ========================================================= */

async function checkPushSubscriptionStatus() {

    if (
        !pushButton ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
    ) {
        return;
    }

    try {

        const registration =
            await navigator.serviceWorker.ready;

        const subscription =
            await registration.pushManager
                .getSubscription();

        if (subscription) {

            pushButton.textContent =
                "🔔 Notificaciones activadas";

            pushButton.disabled =
                true;
        }

    } catch (error) {

        console.error(
            "PUSH STATUS ERROR:",
            error
        );
    }
}


/* =========================================================
   PUSH - ACTIVAR
   ========================================================= */

async function enablePushNotifications() {

    if (
        !("serviceWorker" in navigator)
    ) {

        alert(
            "Este navegador no soporta Service Workers."
        );

        return;
    }


    if (
        !("PushManager" in window)
    ) {

        alert(
            "Este navegador no soporta notificaciones Push."
        );

        return;
    }


    if (!pushButton) {
        return;
    }


    pushButton.disabled =
        true;

    pushButton.textContent =
        "🔔 Activando...";


    try {

        const permission =
            await Notification.requestPermission();


        if (
            permission !==
            "granted"
        ) {

            pushButton.disabled =
                false;

            pushButton.textContent =
                "🔔 Activar notificaciones";

            alert(
                "No se activaron las notificaciones."
            );

            return;
        }


        const keyResponse =
            await fetch(
                "/api/push/public-key",
                {
                    credentials:
                        "include",
                }
            );


        const keyData =
            await keyResponse.json();


        if (
            !keyResponse.ok ||
            !keyData.publicKey
        ) {

            throw new Error(
                keyData.error ||
                "No se pudo obtener la clave pública VAPID."
            );
        }


        const registration =
            await navigator.serviceWorker.ready;


        let subscription =
            await registration.pushManager
                .getSubscription();


        if (!subscription) {

            subscription =
                await registration.pushManager
                    .subscribe({

                        userVisibleOnly:
                            true,

                        applicationServerKey:
                            urlBase64ToUint8Array(
                                keyData.publicKey
                            ),
                    });
        }


        const response =
            await fetch(
                "/api/push/subscribe",
                {
                    method:
                        "POST",

                    credentials:
                        "include",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body:
                        JSON.stringify({
                            subscription:
                                subscription.toJSON(),
                        }),
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "No se pudo registrar el dispositivo."
            );
        }


        pushButton.textContent =
            "🔔 Notificaciones activadas";

        pushButton.disabled =
            true;


        console.log(
            "JAPY PUSH: suscripción registrada."
        );

    } catch (error) {

        console.error(
            "PUSH ERROR:",
            error
        );

        pushButton.disabled =
            false;

        pushButton.textContent =
            "🔔 Activar notificaciones";


        alert(
            `No se pudieron activar las notificaciones: ${error.message}`
        );
    }
}


/* =========================================================
   SERVICE WORKER
   ========================================================= */

async function registerServiceWorker() {

    if (
        !("serviceWorker" in navigator)
    ) {

        console.warn(
            "Service Worker no compatible."
        );

        return null;
    }


    try {

        const registration =
            await navigator.serviceWorker.register(
                "/sw.js"
            );


        console.log(
            "JAPY Service Worker registrado:",
            registration.scope
        );


        return registration;

    } catch (error) {

        console.error(
            "SERVICE WORKER ERROR:",
            error
        );

        return null;
    }
}


/* =========================================================
   INICIO
   ========================================================= */

registerServiceWorker();

checkSession();

initializeGoogleSignIn();