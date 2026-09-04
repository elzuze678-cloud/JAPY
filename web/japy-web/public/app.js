/* =========================================================
   JAPY WEB - APP.JS
   ========================================================= */

let currentUser = null;
let currentEvents = [];

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


/* =========================================================
   CAMBIO LOGIN / REGISTRO
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
                    credentials: "include",
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

            const formData =
                new FormData(loginForm);

            const email =
                formData.get("email");

            const password =
                formData.get("password");

            try {
                const response =
                    await fetch(
                        "/api/login",
                        {
                            method: "POST",

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
                    if (loginMessage) {
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

            } catch (error) {
                console.error(
                    "LOGIN ERROR:",
                    error
                );

                if (loginMessage) {
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

            if (registerMessage) {
                registerMessage.textContent =
                    "";
            }

            const formData =
                new FormData(
                    registerForm
                );

            const name =
                formData.get("name");

            const email =
                formData.get("email");

            const password =
                formData.get("password");

            try {
                const response =
                    await fetch(
                        "/api/register",
                        {
                            method: "POST",

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
                    if (registerMessage) {
                        registerMessage.textContent =
                            data.error ||
                            "No se pudo crear la cuenta.";
                    }

                    return;
                }

                registerForm.reset();

                showLogin();

                if (loginMessage) {
                    loginMessage.textContent =
                        "Cuenta creada correctamente. Ahora inicia sesión.";
                }

            } catch (error) {
                console.error(
                    "REGISTER ERROR:",
                    error
                );

                if (registerMessage) {
                    registerMessage.textContent =
                        "No se pudo conectar con JAPY.";
                }
            }
        }
    );
}


/* =========================================================
   LOGOUT
   ========================================================= */

if (logoutButton) {
    logoutButton.addEventListener(
        "click",
        async () => {
            try {
                await fetch(
                    "/api/logout",
                    {
                        method: "POST",
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

            currentUser = null;
            currentEvents = [];

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
                    credentials: "include",
                }
            );

        if (!response.ok) {
            return;
        }

        const data =
            await response.json();

        currentEvents =
            data.events || [];

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

function renderEvents(events) {
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
            .map((event) => {
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
            })
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
                        button.dataset.eventId;

                    await deleteEvent(
                        eventId
                    );
                }
            );
        }
    );
}

async function deleteEvent(eventId) {
    try {
        const response =
            await fetch(
                `/api/events/${encodeURIComponent(eventId)}`,
                {
                    method: "DELETE",
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
   MODAL CREAR EVENTO
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
   CREAR EVENTO DESDE FORMULARIO
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

            if (!title || !date) {
                if (eventMessage) {
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
                            method: "POST",

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
                                }),
                        }
                    );

                const data =
                    await response.json();

                if (!response.ok) {
                    if (eventMessage) {
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

                if (eventMessage) {
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

async function sendToJapy(text) {
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

    try {
        const response =
            await fetch(
                "/api/chat",
                {
                    method: "POST",

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
            addChatMessage(
                data.error ||
                    "No pude procesar tu mensaje.",
                "japy"
            );

            return;
        }

        addChatMessage(
            data.response ||
                "Entendido.",
            "japy"
        );

        /*
         * Actualizar agenda automáticamente
         * después de cambios.
         */

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

        addChatMessage(
            "No pude conectar con JAPY.",
            "japy"
        );
    }
}


/* =========================================================
   FORMULARIO DEL CHAT
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

            chatInput.value = "";

            await sendToJapy(
                text
            );
        }
    );
}


/* =========================================================
   VOZ
   ========================================================= */

if (voiceButton) {
    voiceButton.addEventListener(
        "click",
        () => {
            addChatMessage(
                "La entrada de voz estará conectada al mismo sistema de JAPY próximamente. 🎙️",
                "japy"
            );
        }
    );
}


/* =========================================================
   INICIO
   ========================================================= */

checkSession();