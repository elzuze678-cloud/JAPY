import { v4 as uuidv4 } from "uuid";

/* =========================================================
   JAPY WEB
   Backend principal
   ========================================================= */

/* =========================================================
   PROCESAR NOTIFICACIONES
   ========================================================= */

async function processNotifications(env) {
    const now = new Date().toISOString();

    const result =
        await env.japy_db
            .prepare(
                `
                SELECT
                    id,
                    user_id,
                    event_id,
                    title,
                    message,
                    remind_at,
                    status
                FROM notifications
                WHERE status = 'pending'
                AND remind_at <= ?
                ORDER BY remind_at ASC
                LIMIT 100
                `
            )
            .bind(now)
            .all();

    const notifications =
        result.results || [];

    if (!notifications.length) {
        console.log(
            "JAPY SCHEDULER: no hay notificaciones pendientes."
        );

        return {
            processed: 0,
            notifications: [],
        };
    }

    const processed = [];

    for (const notification of notifications) {
        try {
            /*
             * Todavía no enviamos Push.
             *
             * READY significa que la notificación
             * ya llegó a su momento y está preparada
             * para el futuro sistema Push.
             */

            await env.japy_db
                .prepare(
                    `
                    UPDATE notifications
                    SET status = 'ready'
                    WHERE id = ?
                    AND status = 'pending'
                    `
                )
                .bind(notification.id)
                .run();

            processed.push({
                id:
                    notification.id,

                title:
                    notification.title,

                message:
                    notification.message,

                remind_at:
                    notification.remind_at,

                status:
                    "ready",
            });

            console.log(
                "JAPY SCHEDULER: notificación lista:",
                notification.title
            );

        } catch (error) {
            console.error(
                "JAPY SCHEDULER NOTIFICATION ERROR:",
                notification.id,
                error
            );
        }
    }

    return {
        processed:
            processed.length,

        notifications:
            processed,
    };
}


/* =========================================================
   UTILIDADES
   ========================================================= */

function json(data, status = 200, headers = {}) {
    return new Response(
        JSON.stringify(data),
        {
            status,

            headers: {
                "Content-Type":
                    "application/json; charset=utf-8",

                ...headers,
            },
        }
    );
}

function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}

function getCookie(
    request,
    name
) {
    const cookieHeader =
        request.headers.get("Cookie") ||
        "";

    const cookies =
        cookieHeader.split(";");

    for (
        const cookie
        of cookies
    ) {
        const [
            key,
            ...valueParts
        ] =
            cookie
                .trim()
                .split("=");

        if (
            key === name
        ) {
            return decodeURIComponent(
                valueParts.join("=")
            );
        }
    }

    return null;
}


/* =========================================================
   CONTRASEÑAS
   ========================================================= */

async function hashPassword(password) {
    const data =
        new TextEncoder().encode(
            password
        );

    const hashBuffer =
        await crypto.subtle.digest(
            "SHA-256",
            data
        );

    return Array.from(
        new Uint8Array(hashBuffer)
    )
        .map(
            (byte) =>
                byte
                    .toString(16)
                    .padStart(
                        2,
                        "0"
                    )
        )
        .join("");
}

async function verifyPassword(
    password,
    passwordHash
) {
    const hash =
        await hashPassword(
            password
        );

    return hash ===
        passwordHash;
}


/* =========================================================
   FECHAS
   ========================================================= */

function getLocalDateParts(
    timeZone = "America/Santiago"
) {
    let formatter;

    try {
        formatter =
            new Intl.DateTimeFormat(
                "en-CA",
                {
                    timeZone,

                    year:
                        "numeric",

                    month:
                        "2-digit",

                    day:
                        "2-digit",
                }
            );
    } catch {
        formatter =
            new Intl.DateTimeFormat(
                "en-CA",
                {
                    timeZone:
                        "America/Santiago",

                    year:
                        "numeric",

                    month:
                        "2-digit",

                    day:
                        "2-digit",
                }
            );
    }

    const parts =
        formatter.formatToParts(
            new Date()
        );

    const result = {};

    for (
        const part
        of parts
    ) {
        if (
            part.type !==
            "literal"
        ) {
            result[
                part.type
            ] =
                part.value;
        }
    }

    return {
        year:
            Number(
                result.year
            ),

        month:
            Number(
                result.month
            ),

        day:
            Number(
                result.day
            ),
    };
}

function formatDate(
    year,
    month,
    day
) {
    return [
        year,

        String(month)
            .padStart(
                2,
                "0"
            ),

        String(day)
            .padStart(
                2,
                "0"
            ),
    ].join("-");
}

function addDays(
    year,
    month,
    day,
    amount
) {
    const date =
        new Date(
            Date.UTC(
                year,
                month - 1,
                day
            )
        );

    date.setUTCDate(
        date.getUTCDate() +
            amount
    );

    return {
        year:
            date.getUTCFullYear(),

        month:
            date.getUTCMonth() +
            1,

        day:
            date.getUTCDate(),
    };
}

function getTomorrow(
    timeZone = "America/Santiago"
) {
    const today =
        getLocalDateParts(
            timeZone
        );

    return addDays(
        today.year,
        today.month,
        today.day,
        1
    );
}


/* =========================================================
   DÍAS DE LA SEMANA
   ========================================================= */

const WEEKDAYS = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    miércoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
    sábado: 6,
};

function getDayOfWeekDate(
    dayName,
    timeZone = "America/Santiago"
) {
    const normalized =
        normalizeText(
            dayName
        );

    const targetDay =
        WEEKDAYS[
            normalized
        ];

    if (
        targetDay ===
        undefined
    ) {
        return null;
    }

    const today =
        getLocalDateParts(
            timeZone
        );

    const currentDate =
        new Date(
            Date.UTC(
                today.year,
                today.month - 1,
                today.day
            )
        );

    const currentDay =
        currentDate.getUTCDay();

    let difference =
        targetDay -
        currentDay;

    if (
        difference <= 0
    ) {
        difference += 7;
    }

    currentDate.setUTCDate(
        currentDate.getUTCDate() +
            difference
    );

    return formatDate(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth() +
            1,
        currentDate.getUTCDate()
    );
}


/* =========================================================
   PARSER DE FECHAS
   ========================================================= */

function parseDateFromText(
    text,
    timeZone = "America/Santiago"
) {
    const normalized =
        normalizeText(text);

    const today =
        getLocalDateParts(
            timeZone
        );

    /* HOY */

    if (
        /\bhoy\b/i.test(
            normalized
        )
    ) {
        return formatDate(
            today.year,
            today.month,
            today.day
        );
    }

    /* PASADO MAÑANA */

    if (
        /\bpasado\s+manana\b/i.test(
            normalized
        )
    ) {
        const date =
            addDays(
                today.year,
                today.month,
                today.day,
                2
            );

        return formatDate(
            date.year,
            date.month,
            date.day
        );
    }

    /* MAÑANA */

    if (
        /\bmanana\b/i.test(
            normalized
        )
    ) {
        const tomorrow =
            getTomorrow(
                timeZone
            );

        return formatDate(
            tomorrow.year,
            tomorrow.month,
            tomorrow.day
        );
    }

    /* EN X DÍAS */

    const daysMatch =
        normalized.match(
            /\ben\s+(\d+)\s+d[ií]as?\b/i
        );

    if (
        daysMatch
    ) {
        const amount =
            Number(
                daysMatch[1]
            );

        const date =
            addDays(
                today.year,
                today.month,
                today.day,
                amount
            );

        return formatDate(
            date.year,
            date.month,
            date.day
        );
    }

    /* FECHA NUMÉRICA */

    const dateMatch =
        normalized.match(
            /\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?\b/
        );

    if (
        dateMatch
    ) {
        const day =
            Number(
                dateMatch[1]
            );

        const month =
            Number(
                dateMatch[2]
            );

        const year =
            dateMatch[3]
                ? Number(
                      dateMatch[3]
                  )
                : today.year;

        return formatDate(
            year,
            month,
            day
        );
    }

    /* DÍA DE LA SEMANA */

    const weekdayPattern =
        normalized.match(
            /\b(?:(?:el|este|proximo|próximo|siguiente|que\s+viene)\s+)?(domingo|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado)\b/i
        );

    if (
        weekdayPattern
    ) {
        return getDayOfWeekDate(
            weekdayPattern[1],
            timeZone
        );
    }

    /* PRÓXIMA SEMANA */

    if (
        /\bproxima\s+semana\b/i.test(
            normalized
        ) ||
        /\bsemana\s+que\s+viene\b/i.test(
            normalized
        ) ||
        /\bsemana\s+siguiente\b/i.test(
            normalized
        )
    ) {
        const date =
            addDays(
                today.year,
                today.month,
                today.day,
                7
            );

        return formatDate(
            date.year,
            date.month,
            date.day
        );
    }

    return null;
}


/* =========================================================
   REFERENCIAS
   ========================================================= */

function isSameTimeReference(
    text
) {
    const normalized =
        normalizeText(text);

    return (
        /\bmisma\s+hora\b/i.test(
            normalized
        ) ||

        /\ba\s+esa\s+hora\b/i.test(
            normalized
        ) ||

        /\ba\s+la\s+misma\b/i.test(
            normalized
        ) ||

        /\bmanten\s+la\s+hora\b/i.test(
            normalized
        ) ||

        /\bmantener\s+la\s+hora\b/i.test(
            normalized
        ) ||

        /\bsin\s+cambiar\s+la\s+hora\b/i.test(
            normalized
        ) ||

        normalized ===
            "a la misma" ||

        normalized ===
            "misma" ||

        normalized ===
            "igual hora"
    );
}

function isSameDateReference(
    text
) {
    const normalized =
        normalizeText(text);

    return (
        /\bmismo\s+dia\b/i.test(
            normalized
        ) ||

        /\bmisma\s+fecha\b/i.test(
            normalized
        ) ||

        /\ba\s+la\s+misma\s+fecha\b/i.test(
            normalized
        ) ||

        /\bsin\s+cambiar\s+la\s+fecha\b/i.test(
            normalized
        ) ||

        /\bmanten\s+la\s+fecha\b/i.test(
            normalized
        ) ||

        /\bmantener\s+la\s+fecha\b/i.test(
            normalized
        )
    );
}


/* =========================================================
   PARSER DE HORAS
   ========================================================= */

function parseTimeFromText(
    text
) {
    const normalized =
        normalizeText(text);

    if (
        isSameTimeReference(
            normalized
        )
    ) {
        return null;
    }

    const naturalMatch =
        normalized.match(
            /\b(?:a las|a la|las|a)\s+(\d{1,2})(?::(\d{2}))?\s*(?:horas|hora)?\b/i
        );

    if (
        naturalMatch
    ) {
        let hour =
            Number(
                naturalMatch[1]
            );

        const minute =
            naturalMatch[2]
                ? Number(
                      naturalMatch[2]
                  )
                : 0;

        const context =
            normalized.slice(
                naturalMatch.index,
                naturalMatch.index +
                    naturalMatch[0].length +
                    45
            );

        if (
            /\bde\s+la\s+tarde\b/i.test(
                context
            ) ||
            /\bde\s+la\s+noche\b/i.test(
                context
            )
        ) {
            if (
                hour < 12
            ) {
                hour += 12;
            }
        }

        if (
            hour >= 0 &&
            hour <= 23 &&
            minute >= 0 &&
            minute <= 59
        ) {
            return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        }
    }

    const directMatch =
        normalized.match(
            /\b(\d{1,2}):(\d{2})\b/
        );

    if (
        directMatch
    ) {
        const hour =
            Number(
                directMatch[1]
            );

        const minute =
            Number(
                directMatch[2]
            );

        if (
            hour >= 0 &&
            hour <= 23 &&
            minute >= 0 &&
            minute <= 59
        ) {
            return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        }
    }

    return null;
}


/* =========================================================
   EXTRACTOR DE TÍTULO
   ========================================================= */

function extractEventTitle(
    text
) {
    let title =
        String(text || "")
            .trim();

    title =
        title.replace(
            /^(japy\s*)/i,
            ""
        );

    title =
        title.replace(
            /^(creame\s+(?:un|el)?\s*evento|créame\s+(?:un|el)?\s*evento|crea\s+(?:un|el)?\s*evento|crear\s+(?:un|el)?\s*evento)\s*/i,
            ""
        );

    title =
        title.replace(
            /^(el\s+evento|un\s+evento|evento)\s*/i,
            ""
        );

    const temporalPatterns = [
        /\bpasado\s+mañana\b/i,
        /\bpasado\s+manana\b/i,

        /\bmañana\b/i,
        /\bmanana\b/i,
        /\bhoy\b/i,

        /\b(?:el|este|próximo|proximo|siguiente|que\s+viene)\s+(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b/i,

        /\b(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b/i,

        /\b(?:la\s+)?(?:próxima|proxima)\s+semana\b/i,

        /\b(?:la\s+)?semana\s+(?:que\s+viene|siguiente)\b/i,

        /\ben\s+\d+\s+d[ií]as?\b/i,

        /\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{4})?\b/i,

        /\ba\s+las?\s+\d{1,2}(?::\d{2})?(?:\s+(?:horas?|de\s+la\s+(?:mañana|tarde|noche)))?\b/i,

        /\blas\s+\d{1,2}(?::\d{2})?(?:\s+(?:horas?|de\s+la\s+(?:mañana|tarde|noche)))?\b/i,

        /\b\d{1,2}:\d{2}\b/i,
    ];

    let cutPosition =
        title.length;

    for (
        const pattern
        of temporalPatterns
    ) {
        const match =
            pattern.exec(
                title
            );

        if (
            match &&
            match.index <
                cutPosition
        ) {
            cutPosition =
                match.index;
        }
    }

    title =
        title
            .substring(
                0,
                cutPosition
            )
            .trim();

    title =
        title.replace(
            /\s+(?:para|el|al|a|en|de|del|este|la)$/i,
            ""
        );

    return title
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}


/* =========================================================
   AUTENTICACIÓN
   ========================================================= */

async function getAuthenticatedUser(
    request,
    env
) {
    const sessionId =
        getCookie(
            request,
            "japy_session"
        );

    if (!sessionId) {
        return null;
    }

    const session =
        await env.japy_db
            .prepare(
                `
                SELECT
                    sessions.id,
                    sessions.user_id,
                    sessions.expires_at,
                    users.name,
                    users.email
                FROM sessions
                JOIN users
                    ON users.id = sessions.user_id
                WHERE sessions.id = ?
                `
            )
            .bind(sessionId)
            .first();

    if (!session) {
        return null;
    }

    const expiresAt =
        new Date(
            session.expires_at
        );

    if (
        expiresAt <=
        new Date()
    ) {
        await env.japy_db
            .prepare(
                "DELETE FROM sessions WHERE id = ?"
            )
            .bind(sessionId)
            .run();

        return null;
    }

    return {
        id:
            session.user_id,

        name:
            session.name,

        email:
            session.email,

        sessionId,

        expiresAt:
            session.expires_at,
    };
}


/* =========================================================
   CONTEXTO CONVERSACIONAL
   ========================================================= */

async function getConversationContext(
    userId,
    env
) {
    const row =
        await env.japy_db
            .prepare(
                `
                SELECT
                    user_id,
                    state,
                    updated_at
                FROM conversation_context
                WHERE user_id = ?
                `
            )
            .bind(userId)
            .first();

    if (!row) {
        return null;
    }

    try {
        return JSON.parse(
            row.state
        );
    } catch (error) {
        console.error(
            "CONTEXT PARSE ERROR:",
            error
        );

        return null;
    }
}

async function saveConversationContext(
    userId,
    context,
    env
) {
    const updatedAt =
        new Date().toISOString();

    await env.japy_db
        .prepare(
            `
            INSERT INTO conversation_context (
                user_id,
                state,
                updated_at
            )
            VALUES (?, ?, ?)
            ON CONFLICT(user_id)
            DO UPDATE SET
                state = excluded.state,
                updated_at = excluded.updated_at
            `
        )
        .bind(
            userId,
            JSON.stringify(
                context
            ),
            updatedAt
        )
        .run();
}

async function clearConversationContext(
    userId,
    env
) {
    await env.japy_db
        .prepare(
            `
            DELETE FROM conversation_context
            WHERE user_id = ?
            `
        )
        .bind(userId)
        .run();
}


/* =========================================================
   FECHA/HORA LOCAL → UTC
   ========================================================= */

function localDateTimeToUTC(
    date,
    time,
    timeZone =
        "America/Santiago"
) {
    const [
        year,
        month,
        day,
    ] =
        date
            .split("-")
            .map(Number);

    const [
        hour,
        minute,
    ] =
        time
            .split(":")
            .map(Number);

    const initialUTC =
        Date.UTC(
            year,
            month - 1,
            day,
            hour,
            minute,
            0
        );

    const formatter =
        new Intl.DateTimeFormat(
            "en-US",
            {
                timeZone,

                year:
                    "numeric",

                month:
                    "2-digit",

                day:
                    "2-digit",

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                second:
                    "2-digit",

                hourCycle:
                    "h23",
            }
        );

    const parts =
        formatter.formatToParts(
            new Date(
                initialUTC
            )
        );

    const values = {};

    for (
        const part
        of parts
    ) {
        if (
            part.type !==
            "literal"
        ) {
            values[
                part.type
            ] =
                Number(
                    part.value
                );
        }
    }

    const displayedUTC =
        Date.UTC(
            values.year,
            values.month - 1,
            values.day,
            values.hour,
            values.minute,
            values.second
        );

    const offset =
        displayedUTC -
        initialUTC;

    const actualUTC =
        initialUTC -
        offset;

    return new Date(
        actualUTC
    );
}


/* =========================================================
   CREAR EVENTO + RECORDATORIO
   ========================================================= */

async function createEvent(
    userId,
    title,
    date,
    time,
    env,
    timeZone =
        "America/Santiago"
) {
    const eventId =
        uuidv4();

    const createdAt =
        new Date().toISOString();

    /*
     * Crear evento.
     */

    await env.japy_db
        .prepare(
            `
            INSERT INTO events (
                id,
                user_id,
                title,
                date,
                time,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `
        )
        .bind(
            eventId,
            userId,
            title,
            date,
            time,
            createdAt
        )
        .run();

    let notification =
        null;

    /*
     * Crear recordatorio 30 minutos antes.
     */

    if (
        time
    ) {
        try {
            const eventDateTime =
                localDateTimeToUTC(
                    date,
                    time,
                    timeZone
                );

            const remindAt =
                new Date(
                    eventDateTime.getTime() -
                        30 *
                            60 *
                            1000
                );

            const notificationId =
                uuidv4();

            const notificationTitle =
                `Recordatorio: ${title}`;

            const notificationMessage =
                `En 30 minutos tienes "${title}".`;

            await env.japy_db
                .prepare(
                    `
                    INSERT INTO notifications (
                        id,
                        user_id,
                        event_id,
                        remind_at,
                        title,
                        message,
                        status,
                        created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
                    `
                )
                .bind(
                    notificationId,
                    userId,
                    eventId,
                    remindAt.toISOString(),
                    notificationTitle,
                    notificationMessage,
                    createdAt
                )
                .run();

            notification = {
                id:
                    notificationId,

                remind_at:
                    remindAt.toISOString(),

                status:
                    "pending",
            };

        } catch (error) {
            console.error(
                "NOTIFICATION CREATE ERROR:",
                error
            );
        }
    }

    return {
        id:
            eventId,

        title,

        date,

        time,

        notification,
    };
}


/* =========================================================
   EDITAR EVENTO
   ========================================================= */

async function editEvent(
    userId,
    eventId,
    date,
    time,
    env
) {
    const event =
        await env.japy_db
            .prepare(
                `
                SELECT
                    id,
                    title,
                    date,
                    time
                FROM events
                WHERE id = ?
                AND user_id = ?
                `
            )
            .bind(
                eventId,
                userId
            )
            .first();

    if (!event) {
        return null;
    }

    const newDate =
        date ?? event.date;

    const newTime =
        time ?? event.time;

    await env.japy_db
        .prepare(
            `
            UPDATE events
            SET
                date = ?,
                time = ?
            WHERE id = ?
            AND user_id = ?
            `
        )
        .bind(
            newDate,
            newTime,
            eventId,
            userId
        )
        .run();

    /*
     * Eliminar recordatorios anteriores.
     */

    await env.japy_db
        .prepare(
            `
            DELETE FROM notifications
            WHERE event_id = ?
            `
        )
        .bind(
            eventId
        )
        .run();

    return {
        id:
            event.id,

        title:
            event.title,

        date:
            newDate,

        time:
            newTime,
    };
}


/* =========================================================
   BÚSQUEDA INTELIGENTE DE EVENTOS
   ========================================================= */

async function findEventByTitle(
    userId,
    title,
    env
) {
    const cleanTitle =
        String(title || "")
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    if (!cleanTitle) {
        return null;
    }

    /*
     * Exacto.
     */

    const exact =
        await env.japy_db
            .prepare(
                `
                SELECT
                    id,
                    title,
                    date,
                    time
                FROM events
                WHERE user_id = ?
                AND LOWER(title) = LOWER(?)
                LIMIT 1
                `
            )
            .bind(
                userId,
                cleanTitle
            )
            .first();

    if (exact) {
        return exact;
    }

    /*
     * Parcial.
     *
     * Ejemplo:
     * "skate" -> "andar en skate"
     */

    const normalizedTitle =
        cleanTitle
            .toLowerCase()
            .replace(
                /[%_]/g,
                " "
            );

    const partial =
        await env.japy_db
            .prepare(
                `
                SELECT
                    id,
                    title,
                    date,
                    time
                FROM events
                WHERE user_id = ?
                AND (
                    LOWER(title) LIKE ?
                    OR LOWER(?) LIKE '%' || LOWER(title) || '%'
                )
                ORDER BY
                    date ASC,
                    time ASC
                LIMIT 2
                `
            )
            .bind(
                userId,
                `%${normalizedTitle}%`,
                normalizedTitle
            )
            .all();

    const matches =
        partial.results ||
        [];

    if (
        matches.length === 1
    ) {
        return matches[0];
    }

    return null;
}


/* =========================================================
   CONTINUAR CREACIÓN
   ========================================================= */

async function continueCreateEventConversation(
    message,
    user,
    env,
    context,
    timeZone
) {
    const dateFromMessage =
        parseDateFromText(
            message,
            timeZone
        );

    const timeFromMessage =
        parseTimeFromText(
            message
        );

    /*
     * ESPERANDO TÍTULO
     */

    if (
        context.awaiting ===
        "title"
    ) {
        const parsedTitle =
            extractEventTitle(
                message
            );

        const title =
            parsedTitle ||
            message.trim();

        if (!title) {
            return json({
                type:
                    "chat",

                response:
                    "No alcancé a entender el nombre del evento. ¿Qué evento quieres crear?",
            });
        }

        context.title =
            title;

        if (dateFromMessage) {
            context.date =
                dateFromMessage;
        }

        if (timeFromMessage) {
            context.time =
                timeFromMessage;
        }

        if (!context.date) {
            context.awaiting =
                "date";

            await saveConversationContext(
                user.id,
                context,
                env
            );

            return json({
                type:
                    "chat",

                response:
                    `Perfecto. ¿Para qué día es "${context.title}"?`,
            });
        }

        if (!context.time) {
            context.awaiting =
                "time";

            await saveConversationContext(
                user.id,
                context,
                env
            );

            return json({
                type:
                    "chat",

                response:
                    `Perfecto. ¿A qué hora será "${context.title}"?`,
            });
        }
    }

    /*
     * ESPERANDO FECHA
     */

    if (
        context.awaiting ===
        "date"
    ) {
        if (dateFromMessage) {
            context.date =
                dateFromMessage;
        }

        if (timeFromMessage) {
            context.time =
                timeFromMessage;
        }

        if (!context.date) {
            return json({
                type:
                    "chat",

                response:
                    "Necesito el día. Puedes decirme “mañana”, “el viernes” o “12/09”.",
            });
        }

        if (!context.time) {
            context.awaiting =
                "time";

            await saveConversationContext(
                user.id,
                context,
                env
            );

            return json({
                type:
                    "chat",

                response:
                    `Perfecto. ¿A qué hora será "${context.title}"?`,
            });
        }
    }

    /*
     * ESPERANDO HORA
     */

    if (
        context.awaiting ===
        "time"
    ) {
        if (dateFromMessage) {
            context.date =
                dateFromMessage;
        }

        if (timeFromMessage) {
            context.time =
                timeFromMessage;
        }

        if (!context.time) {
            return json({
                type:
                    "chat",

                response:
                    "Necesito la hora. Por ejemplo: “15:00” o “a las 15”.",
            });
        }
    }

    /*
     * COMPLETO
     */

    if (
        context.title &&
        context.date &&
        context.time
    ) {
        const event =
            await createEvent(
                user.id,
                context.title,
                context.date,
                context.time,
                env,
                timeZone
            );

        await clearConversationContext(
            user.id,
            env
        );

        return json({
            type:
                "event_created",

            response:
                `Listo. Dejé "${event.title}" para el ${event.date} a las ${event.time}. 📅`,

            event,
        });
    }

    await saveConversationContext(
        user.id,
        context,
        env
    );

    return json({
        type:
            "chat",

        response:
            "Estoy recopilando los datos del evento.",
    });
}


/* =========================================================
   CONTINUAR EDICIÓN
   ========================================================= */

async function continueEditEventConversation(
    message,
    user,
    env,
    context,
    timeZone
) {
    const dateFromMessage =
        parseDateFromText(
            message,
            timeZone
        );

    const timeFromMessage =
        parseTimeFromText(
            message
        );

    const sameTime =
        isSameTimeReference(
            message
        );

    const sameDate =
        isSameDateReference(
            message
        );

    /*
     * Misma hora.
     */

    if (
        sameTime &&
        context.originalTime
    ) {
        context.time =
            context.originalTime;
    }

    /*
     * Misma fecha.
     */

    if (
        sameDate &&
        context.originalDate
    ) {
        context.date =
            context.originalDate;
    }

    if (dateFromMessage) {
        context.date =
            dateFromMessage;
    }

    if (timeFromMessage) {
        context.time =
            timeFromMessage;
    }

    if (
        !context.date &&
        !context.time
    ) {
        return json({
            type:
                "chat",

            response:
                "Dime qué quieres cambiar. Por ejemplo: “mañana a las 20”, “el sábado” o “a la misma hora”.",
        });
    }

    const finalDate =
        context.date ??
        context.originalDate;

    const finalTime =
        context.time ??
        context.originalTime;

    const event =
        await editEvent(
            user.id,
            context.eventId,
            finalDate,
            finalTime,
            env
        );

    if (!event) {
        await clearConversationContext(
            user.id,
            env
        );

        return json({
            type:
                "chat",

            response:
                "No pude encontrar ese evento.",
        });
    }

    /*
     * Recrear recordatorio.
     */

    if (
        event.time
    ) {
        try {
            const eventDateTime =
                localDateTimeToUTC(
                    event.date,
                    event.time,
                    timeZone
                );

            const remindAt =
                new Date(
                    eventDateTime.getTime() -
                        30 *
                            60 *
                            1000
                );

            await env.japy_db
                .prepare(
                    `
                    INSERT INTO notifications (
                        id,
                        user_id,
                        event_id,
                        remind_at,
                        title,
                        message,
                        status,
                        created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
                    `
                )
                .bind(
                    uuidv4(),
                    user.id,
                    event.id,
                    remindAt.toISOString(),
                    `Recordatorio: ${event.title}`,
                    `En 30 minutos tienes "${event.title}".`,
                    new Date().toISOString()
                )
                .run();

        } catch (error) {
            console.error(
                "UPDATED NOTIFICATION ERROR:",
                error
            );
        }
    }

    await clearConversationContext(
        user.id,
        env
    );

    return json({
        type:
            "event_updated",

        response:
            `Listo. Cambié "${event.title}" para el ${event.date}` +
            (
                event.time
                    ? ` a las ${event.time}. ✏️`
                    : ". ✏️"
            ),

        event,
    });
}


/* =========================================================
   CHAT PRINCIPAL
   ========================================================= */

async function handleChat(
    request,
    env,
    user,
    body
) {
    const message =
        String(
            body?.message || ""
        ).trim();

    const timeZone =
        body?.timezone ||
        "America/Santiago";

    if (!message) {
        return json(
            {
                error:
                    "El mensaje está vacío.",
            },
            400
        );
    }

    const normalized =
        normalizeText(
            message
        );

    /*
     * CONTEXTO
     */

    const existingContext =
        await getConversationContext(
            user.id,
            env
        );

    if (
        existingContext
    ) {
        /*
         * Cancelar flujo.
         */

        if (
            normalized ===
                "cancelar" ||
            normalized ===
                "cancela" ||
            normalized ===
                "olvidalo" ||
            normalized ===
                "olvidelo"
        ) {
            await clearConversationContext(
                user.id,
                env
            );

            return json({
                type:
                    "chat",

                response:
                    "De acuerdo. Cancelé la operación.",
            });
        }

        /*
         * Crear
         */

        if (
            existingContext.flow ===
                "create_event"
        ) {
            return continueCreateEventConversation(
                message,
                user,
                env,
                existingContext,
                timeZone
            );
        }

        /*
         * Editar
         */

        if (
            existingContext.flow ===
                "edit_event"
        ) {
            return continueEditEventConversation(
                message,
                user,
                env,
                existingContext,
                timeZone
            );
        }
    }


    /* =====================================================
       SALUDOS
       ===================================================== */

    if (
        normalized === "hola" ||
        normalized === "hola japy" ||
        normalized.startsWith(
            "hola "
        )
    ) {
        return json({
            type:
                "chat",

            response:
                `¡Hola, ${user.name}! 👋 ¿Qué hacemos?`,
        });
    }


    /* =====================================================
       GRACIAS
       ===================================================== */

    if (
        normalized ===
            "gracias" ||
        normalized ===
            "muchas gracias" ||
        normalized ===
            "gracias japy"
    ) {
        return json({
            type:
                "chat",

            response:
                "¡De nada! 😄",
        });
    }


    /* =====================================================
       IDENTIDAD
       ===================================================== */

    if (
        normalized.includes(
            "quien eres"
        ) ||
        normalized.includes(
            "que eres"
        ) ||
        normalized.includes(
            "quien es japy"
        )
    ) {
        return json({
            type:
                "chat",

            response:
                "Soy JAPY. Más que un asistente, quiero ser un compañero que te ayude a organizar y simplificar tu día. 🤖",
        });
    }


    /* =====================================================
       MOSTRAR EVENTOS
       ===================================================== */

    if (
        normalized.includes(
            "mis eventos"
        ) ||
        normalized.includes(
            "muestra mis eventos"
        ) ||
        normalized.includes(
            "mostrar mis eventos"
        ) ||
        normalized.includes(
            "ver mis eventos"
        ) ||
        normalized.includes(
            "que tengo"
        ) ||
        normalized.includes(
            "qué tengo"
        )
    ) {
        const result =
            await env.japy_db
                .prepare(
                    `
                    SELECT
                        id,
                        title,
                        date,
                        time,
                        created_at
                    FROM events
                    WHERE user_id = ?
                    ORDER BY date ASC, time ASC
                    `
                )
                .bind(
                    user.id
                )
                .all();

        return json({
            type:
                "events",

            events:
                result.results ||
                [],

            response:
                result.results?.length
                    ? "Estos son tus próximos eventos:"
                    : "No tienes eventos guardados todavía.",
        });
    }


    /* =====================================================
       CREAR EVENTO
       ===================================================== */

    const createCommand =
        /\b(crea|crear|creame|créame)\b.*\bevento\b/i.test(
            normalized
        );

    if (
        createCommand
    ) {
        const title =
            extractEventTitle(
                message
            );

        const date =
            parseDateFromText(
                message,
                timeZone
            );

        const time =
            parseTimeFromText(
                message
            );

        const context = {
            flow:
                "create_event",

            title:
                title || null,

            date:
                date || null,

            time:
                time || null,

            awaiting:
                null,
        };

        /*
         * Falta título.
         */

        if (!context.title) {
            context.awaiting =
                "title";

            await saveConversationContext(
                user.id,
                context,
                env
            );

            return json({
                type:
                    "chat",

                response:
                    "Claro. ¿Qué evento quieres crear?",
            });
        }

        /*
         * Falta fecha.
         */

        if (!context.date) {
            context.awaiting =
                "date";

            await saveConversationContext(
                user.id,
                context,
                env
            );

            return json({
                type:
                    "chat",

                response:
                    `Perfecto. El evento será "${context.title}". ¿Para qué día?`,
            });
        }

        /*
         * Falta hora.
         */

        if (!context.time) {
            context.awaiting =
                "time";

            await saveConversationContext(
                user.id,
                context,
                env
            );

            return json({
                type:
                    "chat",

                response:
                    `Perfecto. Será el ${context.date}. ¿A qué hora?`,
            });
        }

        /*
         * Crear completo.
         */

        const event =
            await createEvent(
                user.id,
                context.title,
                context.date,
                context.time,
                env,
                timeZone
            );

        await clearConversationContext(
            user.id,
            env
        );

        return json({
            type:
                "event_created",

            response:
                `Listo. Dejé "${event.title}" para el ${event.date} a las ${event.time}. 📅`,

            event,
        });
    }


    /* =====================================================
       EDITAR EVENTO
       ===================================================== */

    const editCommand =
        /^(cambia|cambiar|modifica|modificar|edita|editar|actualiza|actualizar)\b/i.test(
            normalized
        );

    if (
        editCommand
    ) {
        let searchTitle =
            message;

        searchTitle =
            searchTitle.replace(
                /^(japy\s*)/i,
                ""
            );

        searchTitle =
            searchTitle.replace(
                /^(cambia|cambiar|modifica|modificar|edita|editar|actualiza|actualizar)\s*/i,
                ""
            );

        searchTitle =
            searchTitle.replace(
                /^(el\s+evento|un\s+evento)\s*/i,
                ""
            );

        let titleEnd =
            searchTitle.length;

        const temporalPatterns = [
            /\bpasado\s+mañana\b/i,
            /\bpasado\s+manana\b/i,

            /\bmañana\b/i,
            /\bmanana\b/i,
            /\bhoy\b/i,

            /\b(?:el|este|próximo|proximo|siguiente)\s+(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b/i,

            /\b(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b/i,

            /\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{4})?\b/i,

            /\ba\s+las?\s+\d{1,2}(?::\d{2})?(?:\s+(?:horas?|de\s+la\s+(?:mañana|tarde|noche)))?\b/i,

            /\blas\s+\d{1,2}(?::\d{2})?(?:\s+(?:horas?|de\s+la\s+(?:mañana|tarde|noche)))?\b/i,

            /\b\d{1,2}:\d{2}\b/i,
        ];

        for (
            const pattern
            of temporalPatterns
        ) {
            const match =
                pattern.exec(
                    searchTitle
                );

            if (
                match &&
                match.index <
                    titleEnd
            ) {
                titleEnd =
                    match.index;
            }
        }

        searchTitle =
            searchTitle
                .substring(
                    0,
                    titleEnd
                )
                .trim();

        searchTitle =
            searchTitle.replace(
                /\s+(?:para|el|al|a|en|de|del|este|la)$/i,
                ""
            );

        searchTitle =
            searchTitle
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();

        if (!searchTitle) {
            return json({
                type:
                    "chat",

                response:
                    "Claro. ¿Qué evento quieres modificar?",
            });
        }

        const event =
            await findEventByTitle(
                user.id,
                searchTitle,
                env
            );

        if (!event) {
            return json({
                type:
                    "chat",

                response:
                    `No encontré un evento llamado "${searchTitle}".`,
            });
        }

        const sameTime =
            isSameTimeReference(
                message
            );

        const sameDate =
            isSameDateReference(
                message
            );

        let newDate =
            parseDateFromText(
                message,
                timeZone
            );

        let newTime =
            parseTimeFromText(
                message
            );

        if (sameDate) {
            newDate =
                event.date;
        }

        if (sameTime) {
            newTime =
                event.time;
        }

        /*
         * Cambio directo.
         */

        if (
            newDate ||
            newTime
        ) {
            const updatedEvent =
                await editEvent(
                    user.id,
                    event.id,
                    newDate,
                    newTime,
                    env
                );

            /*
             * Crear nuevo recordatorio.
             */

            if (
                updatedEvent.time
            ) {
                try {
                    const eventDateTime =
                        localDateTimeToUTC(
                            updatedEvent.date,
                            updatedEvent.time,
                            timeZone
                        );

                    const remindAt =
                        new Date(
                            eventDateTime.getTime() -
                                30 *
                                    60 *
                                    1000
                        );

                    await env.japy_db
                        .prepare(
                            `
                            INSERT INTO notifications (
                                id,
                                user_id,
                                event_id,
                                remind_at,
                                title,
                                message,
                                status,
                                created_at
                            )
                            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
                            `
                        )
                        .bind(
                            uuidv4(),
                            user.id,
                            updatedEvent.id,
                            remindAt.toISOString(),
                            `Recordatorio: ${updatedEvent.title}`,
                            `En 30 minutos tienes "${updatedEvent.title}".`,
                            new Date().toISOString()
                        )
                        .run();

                } catch (error) {
                    console.error(
                        "UPDATED NOTIFICATION ERROR:",
                        error
                    );
                }
            }

            return json({
                type:
                    "event_updated",

                response:
                    `Listo. Cambié "${updatedEvent.title}" para el ${updatedEvent.date}` +
                    (
                        updatedEvent.time
                            ? ` a las ${updatedEvent.time}. ✏️`
                            : ". ✏️"
                    ),

                event:
                    updatedEvent,
            });
        }

        /*
         * Guardar contexto.
         */

        const context = {
            flow:
                "edit_event",

            eventId:
                event.id,

            title:
                event.title,

            originalDate:
                event.date,

            originalTime:
                event.time,

            date:
                null,

            time:
                null,

            awaiting:
                "changes",
        };

        await saveConversationContext(
            user.id,
            context,
            env
        );

        return json({
            type:
                "chat",

            response:
                `Encontré "${event.title}". ¿Qué quieres cambiar?`,
        });
    }


    /* =====================================================
       CANCELAR EVENTO
       ===================================================== */

    const cancelCommand =
        /^(cancela|cancelar|elimina|eliminar|borra|borrar)\b/i.test(
            normalized
        );

    if (
        cancelCommand
    ) {
        let title =
            message;

        title =
            title.replace(
                /^(japy\s*)/i,
                ""
            );

        title =
            title.replace(
                /^(cancela|cancelar|elimina|eliminar|borra|borrar)\s*/i,
                ""
            );

        title =
            title.replace(
                /^(el\s+evento|un\s+evento)\s*/i,
                ""
            );

        title =
            title.trim();

        if (!title) {
            return json({
                type:
                    "chat",

                response:
                    "Claro. ¿Qué evento quieres cancelar?",
            });
        }

        const event =
            await findEventByTitle(
                user.id,
                title,
                env
            );

        if (!event) {
            return json({
                type:
                    "chat",

                response:
                    `No encontré un evento llamado "${title}".`,
            });
        }

        await env.japy_db
            .prepare(
                `
                DELETE FROM events
                WHERE id = ?
                AND user_id = ?
                `
            )
            .bind(
                event.id,
                user.id
            )
            .run();

        await env.japy_db
            .prepare(
                `
                DELETE FROM notifications
                WHERE event_id = ?
                `
            )
            .bind(
                event.id
            )
            .run();

        return json({
            type:
                "event_deleted",

            response:
                `Listo. Cancelé el evento "${event.title}". 🗑️`,
        });
    }


    /* =====================================================
       RESPUESTA GENERAL
       ===================================================== */

    return json({
        type:
            "chat",

        response:
            `Te escucho. Entendí: "${message}". Todavía estoy aprendiendo a interpretar conversaciones más complejas, pero podemos seguir construyendo JAPY paso a paso. 🤖`,
    });
}


/* =========================================================
   FETCH PRINCIPAL
   ========================================================= */

export default {
    /* =====================================================
       SCHEDULED / CRON
       ===================================================== */

    async scheduled(
        controller,
        env,
        ctx
    ) {
        console.log(
            "JAPY SCHEDULER:",
            controller.cron,
            new Date(
                controller.scheduledTime
            ).toISOString()
        );

        await processNotifications(
            env
        );
    },

    /* =====================================================
       HTTP
       ===================================================== */

    async fetch(
        request,
        env
    ) {
        const url =
            new URL(
                request.url
            );

        const corsHeaders = {
            "Access-Control-Allow-Origin":
                url.origin,

            "Access-Control-Allow-Credentials":
                "true",
        };

        /* OPTIONS */

        if (
            request.method ===
            "OPTIONS"
        ) {
            return new Response(
                null,
                {
                    status: 204,

                    headers: {
                        ...corsHeaders,

                        "Access-Control-Allow-Methods":
                            "GET, POST, DELETE, OPTIONS",

                        "Access-Control-Allow-Headers":
                            "Content-Type",
                    },
                }
            );
        }

        /* =================================================
           HEALTH
           ================================================= */

        if (
            url.pathname ===
                "/api/health" &&
            request.method ===
                "GET"
        ) {
            return json(
                {
                    status:
                        "ok",

                    service:
                        "JAPY Web",
                },
                200,
                corsHeaders
            );
        }

        /* =================================================
           REGISTRO
           ================================================= */

        if (
            url.pathname ===
                "/api/register" &&
            request.method ===
                "POST"
        ) {
            try {
                const body =
                    await request.json();

                const name =
                    String(
                        body.name || ""
                    ).trim();

                const email =
                    String(
                        body.email || ""
                    )
                        .trim()
                        .toLowerCase();

                const password =
                    String(
                        body.password ||
                            ""
                    );

                if (
                    !name ||
                    !email ||
                    !password
                ) {
                    return json(
                        {
                            error:
                                "Todos los campos son obligatorios.",
                        },
                        400,
                        corsHeaders
                    );
                }

                if (
                    password.length <
                    8
                ) {
                    return json(
                        {
                            error:
                                "La contraseña debe tener al menos 8 caracteres.",
                        },
                        400,
                        corsHeaders
                    );
                }

                const existing =
                    await env.japy_db
                        .prepare(
                            `
                            SELECT id
                            FROM users
                            WHERE email = ?
                            `
                        )
                        .bind(email)
                        .first();

                if (
                    existing
                ) {
                    return json(
                        {
                            error:
                                "Ya existe una cuenta con ese correo.",
                        },
                        409,
                        corsHeaders
                    );
                }

                const userId =
                    uuidv4();

                const passwordHash =
                    await hashPassword(
                        password
                    );

                const createdAt =
                    new Date().toISOString();

                await env.japy_db
                    .prepare(
                        `
                        INSERT INTO users (
                            id,
                            email,
                            password_hash,
                            name,
                            created_at
                        )
                        VALUES (?, ?, ?, ?, ?)
                        `
                    )
                    .bind(
                        userId,
                        email,
                        passwordHash,
                        name,
                        createdAt
                    )
                    .run();

                return json(
                    {
                        success:
                            true,

                        message:
                            "Cuenta creada correctamente.",
                    },
                    201,
                    corsHeaders
                );
            } catch (error) {
                console.error(
                    "REGISTER ERROR:",
                    error
                );

                return json(
                    {
                        error:
                            "No se pudo crear la cuenta.",
                    },
                    500,
                    corsHeaders
                );
            }
        }

        /* =================================================
           LOGIN
           ================================================= */

        if (
            url.pathname ===
                "/api/login" &&
            request.method ===
                "POST"
        ) {
            try {
                const body =
                    await request.json();

                const email =
                    String(
                        body.email || ""
                    )
                        .trim()
                        .toLowerCase();

                const password =
                    String(
                        body.password ||
                            ""
                    );

                if (
                    !email ||
                    !password
                ) {
                    return json(
                        {
                            error:
                                "Correo y contraseña son obligatorios.",
                        },
                        400,
                        corsHeaders
                    );
                }

                const user =
                    await env.japy_db
                        .prepare(
                            `
                            SELECT
                                id,
                                email,
                                password_hash,
                                name
                            FROM users
                            WHERE email = ?
                            `
                        )
                        .bind(email)
                        .first();

                if (!user) {
                    return json(
                        {
                            error:
                                "Correo o contraseña incorrectos.",
                        },
                        401,
                        corsHeaders
                    );
                }

                const valid =
                    await verifyPassword(
                        password,
                        user.password_hash
                    );

                if (!valid) {
                    return json(
                        {
                            error:
                                "Correo o contraseña incorrectos.",
                        },
                        401,
                        corsHeaders
                    );
                }

                const sessionId =
                    uuidv4();

                const expiresAt =
                    new Date(
                        Date.now() +
                            7 *
                                24 *
                                60 *
                                60 *
                                1000
                    ).toISOString();

                await env.japy_db
                    .prepare(
                        `
                        INSERT INTO sessions (
                            id,
                            user_id,
                            expires_at,
                            created_at
                        )
                        VALUES (?, ?, ?, ?)
                        `
                    )
                    .bind(
                        sessionId,
                        user.id,
                        expiresAt,
                        new Date().toISOString()
                    )
                    .run();

                const secure =
                    url.protocol ===
                    "https:"
                        ? "Secure; "
                        : "";

                return json(
                    {
                        success:
                            true,

                        user: {
                            id:
                                user.id,

                            name:
                                user.name,

                            email:
                                user.email,
                        },
                    },
                    200,
                    {
                        ...corsHeaders,

                        "Set-Cookie":
                            `japy_session=${sessionId}; ` +
                            `HttpOnly; ` +
                            secure +
                            `SameSite=Lax; ` +
                            `Path=/; ` +
                            `Max-Age=604800`,
                    }
                );
            } catch (error) {
                console.error(
                    "LOGIN ERROR:",
                    error
                );

                return json(
                    {
                        error:
                            "No se pudo iniciar sesión.",
                    },
                    500,
                    corsHeaders
                );
            }
        }

        /* =================================================
           ME
           ================================================= */

        if (
            url.pathname ===
                "/api/me" &&
            request.method ===
                "GET"
        ) {
            const user =
                await getAuthenticatedUser(
                    request,
                    env
                );

            if (!user) {
                return json(
                    {
                        authenticated:
                            false,
                    },
                    401,
                    corsHeaders
                );
            }

            return json(
                {
                    authenticated:
                        true,

                    user: {
                        id:
                            user.id,

                        name:
                            user.name,

                        email:
                            user.email,
                    },
                },
                200,
                corsHeaders
            );
        }

        /* =================================================
           LOGOUT
           ================================================= */

        if (
            url.pathname ===
                "/api/logout" &&
            request.method ===
                "POST"
        ) {
            const sessionId =
                getCookie(
                    request,
                    "japy_session"
                );

            if (
                sessionId
            ) {
                await env.japy_db
                    .prepare(
                        `
                        DELETE FROM sessions
                        WHERE id = ?
                        `
                    )
                    .bind(
                        sessionId
                    )
                    .run();
            }

            const secure =
                url.protocol ===
                "https:"
                    ? "Secure; "
                    : "";

            return json(
                {
                    success:
                        true,
                },
                200,
                {
                    ...corsHeaders,

                    "Set-Cookie":
                        `japy_session=; ` +
                        `HttpOnly; ` +
                        secure +
                        `SameSite=Lax; ` +
                        `Path=/; ` +
                        `Max-Age=0`,
                }
            );
        }

        /* =================================================
           CHAT
           ================================================= */

        if (
            url.pathname ===
                "/api/chat" &&
            request.method ===
                "POST"
        ) {
            try {
                const user =
                    await getAuthenticatedUser(
                        request,
                        env
                    );

                if (!user) {
                    return json(
                        {
                            error:
                                "No estás autenticado.",
                        },
                        401,
                        corsHeaders
                    );
                }

                const body =
                    await request.json();

                const response =
                    await handleChat(
                        request,
                        env,
                        user,
                        body
                    );

                const newHeaders =
                    new Headers(
                        response.headers
                    );

                for (
                    const [
                        key,
                        value,
                    ]
                    of Object.entries(
                        corsHeaders
                    )
                ) {
                    newHeaders.set(
                        key,
                        value
                    );
                }

                return new Response(
                    response.body,
                    {
                        status:
                            response.status,

                        headers:
                            newHeaders,
                    }
                );
            } catch (error) {
                console.error(
                    "CHAT ERROR:",
                    error
                );

                return json(
                    {
                        error:
                            "Ocurrió un error procesando el mensaje.",
                    },
                    500,
                    corsHeaders
                );
            }
        }

        /* =================================================
           OBTENER EVENTOS
           ================================================= */

        if (
            url.pathname ===
                "/api/events" &&
            request.method ===
                "GET"
        ) {
            const user =
                await getAuthenticatedUser(
                    request,
                    env
                );

            if (!user) {
                return json(
                    {
                        error:
                            "No estás autenticado.",
                    },
                    401,
                    corsHeaders
                );
            }

            const result =
                await env.japy_db
                    .prepare(
                        `
                        SELECT
                            id,
                            title,
                            date,
                            time,
                            created_at
                        FROM events
                        WHERE user_id = ?
                        ORDER BY date ASC, time ASC
                        `
                    )
                    .bind(
                        user.id
                    )
                    .all();

            return json(
                {
                    events:
                        result.results ||
                        [],
                },
                200,
                corsHeaders
            );
        }

        /* =================================================
           CREAR EVENTO DIRECTAMENTE
           ================================================= */

        if (
            url.pathname ===
                "/api/events" &&
            request.method ===
                "POST"
        ) {
            try {
                const user =
                    await getAuthenticatedUser(
                        request,
                        env
                    );

                if (!user) {
                    return json(
                        {
                            error:
                                "No estás autenticado.",
                        },
                        401,
                        corsHeaders
                    );
                }

                const body =
                    await request.json();

                const title =
                    String(
                        body.title ||
                            ""
                    )
                        .replace(
                            /\s+/g,
                            " "
                        )
                        .trim();

                const date =
                    String(
                        body.date ||
                            ""
                    ).trim();

                const time =
                    String(
                        body.time ||
                            ""
                    ).trim();

                if (!title) {
                    return json(
                        {
                            error:
                                "El título es obligatorio.",
                        },
                        400,
                        corsHeaders
                    );
                }

                if (
                    !/^\d{4}-\d{2}-\d{2}$/.test(
                        date
                    )
                ) {
                    return json(
                        {
                            error:
                                "La fecha no tiene un formato válido.",
                        },
                        400,
                        corsHeaders
                    );
                }

                if (
                    time &&
                    !/^\d{2}:\d{2}$/.test(
                        time
                    )
                ) {
                    return json(
                        {
                            error:
                                "La hora no tiene un formato válido.",
                        },
                        400,
                        corsHeaders
                    );
                }

                const event =
                    await createEvent(
                        user.id,
                        title,
                        date,
                        time ||
                            null,
                        env,
                        body.timezone ||
                            "America/Santiago"
                    );

                return json(
                    {
                        success:
                            true,

                        event,
                    },
                    201,
                    corsHeaders
                );

            } catch (error) {
                console.error(
                    "CREATE EVENT ERROR:",
                    error
                );

                return json(
                    {
                        error:
                            "No se pudo crear el evento.",
                    },
                    500,
                    corsHeaders
                );
            }
        }

        /* =================================================
           ELIMINAR EVENTO
           ================================================= */

        const deleteMatch =
            url.pathname.match(
                /^\/api\/events\/([^/]+)$/
            );

        if (
            deleteMatch &&
            request.method ===
                "DELETE"
        ) {
            const user =
                await getAuthenticatedUser(
                    request,
                    env
                );

            if (!user) {
                return json(
                    {
                        error:
                            "No estás autenticado.",
                    },
                    401,
                    corsHeaders
                );
            }

            const eventId =
                deleteMatch[1];

            const event =
                await env.japy_db
                    .prepare(
                        `
                        SELECT
                            id,
                            title
                        FROM events
                        WHERE id = ?
                        AND user_id = ?
                        `
                    )
                    .bind(
                        eventId,
                        user.id
                    )
                    .first();

            if (!event) {
                return json(
                    {
                        error:
                            "Evento no encontrado.",
                    },
                    404,
                    corsHeaders
                );
            }

            await env.japy_db
                .prepare(
                    `
                    DELETE FROM events
                    WHERE id = ?
                    AND user_id = ?
                    `
                )
                .bind(
                    eventId,
                    user.id
                )
                .run();

            await env.japy_db
                .prepare(
                    `
                    DELETE FROM notifications
                    WHERE event_id = ?
                    `
                )
                .bind(
                    eventId
                )
                .run();

            return json(
                {
                    success:
                        true,

                    message:
                        "Evento eliminado correctamente.",
                },
                200,
                corsHeaders
            );
        }

        /* =================================================
           ASSETS
           ================================================= */

        if (
            env.ASSETS
        ) {
            return env.ASSETS.fetch(
                request
            );
        }

        /* =================================================
           404
           ================================================= */

        return json(
            {
                error:
                    "Ruta no encontrada.",
            },
            404,
            corsHeaders
        );
    },
};