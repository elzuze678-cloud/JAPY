import { v4 as uuidv4 } from "uuid";
import webpush from "web-push";

/* =========================================================
   JAPY WEB
   Backend principal
   ========================================================= */

const JAPY_TIME_ZONE = "America/Santiago";


/* =========================================================
   PROCESAR Y ENVIAR NOTIFICACIONES
   ========================================================= */

async function processNotifications(env) {
    const now =
        new Date().toISOString();

    const result =
        await env.japy_db
            .prepare(
                `
                SELECT
                    n.id,
                    n.user_id,
                    n.event_id,
                    n.title,
                    n.message,
                    n.remind_at,
                    n.status,
                    e.date AS event_date,
                    e.time AS event_time
                FROM notifications n
                LEFT JOIN events e
                    ON e.id = n.event_id
                WHERE n.status = 'pending'
                AND n.remind_at <= ?
                ORDER BY n.remind_at ASC
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
            sent: 0,
            failed: 0,
        };
    }

    if (
        !env.VAPID_SUBJECT ||
        !env.VAPID_PUBLIC_KEY ||
        !env.VAPID_PRIVATE_KEY
    ) {
        console.error(
            "JAPY PUSH: faltan credenciales VAPID."
        );

        return {
            processed:
                notifications.length,

            sent: 0,

            failed:
                notifications.length,
        };
    }

    webpush.setVapidDetails(
        env.VAPID_SUBJECT,
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY
    );

    let sent = 0;
    let failed = 0;

    for (
        const notification
        of notifications
    ) {
        try {
            /*
             * Si el evento ya no existe, la notificación
             * tampoco tiene utilidad.
             */

            if (
                !notification.event_date ||
                !notification.event_time
            ) {
                await env.japy_db
                    .prepare(
                        `
                        UPDATE notifications
                        SET status = 'failed'
                        WHERE id = ?
                        AND status = 'pending'
                        `
                    )
                    .bind(
                        notification.id
                    )
                    .run();

                failed++;

                continue;
            }

            const eventUTC =
                localDateTimeToUTC(
                    notification.event_date,
                    notification.event_time,
                    JAPY_TIME_ZONE
                );

            const eventAtMs =
                eventUTC.getTime();

            const remindAtMs =
                new Date(
                    notification.remind_at
                ).getTime();

            const nowMs =
                Date.now();

            const remind15Ms =
                eventAtMs -
                15 * 60 * 1000;

            /*
             * Si el Scheduler llegó tarde y el evento
             * ya comenzó, el recordatorio de 15 minutos
             * ya no tiene sentido.
             *
             * El de 5 minutos y el de inicio sí pueden
             * seguir enviándose si están pendientes.
             */

            if (
                notification.title.startsWith(
                    "Recordatorio:"
                ) &&
                remindAtMs === remind15Ms &&
                nowMs >= eventAtMs
            ) {
                await env.japy_db
                    .prepare(
                        `
                        UPDATE notifications
                        SET status = 'skipped'
                        WHERE id = ?
                        AND status = 'pending'
                        `
                    )
                    .bind(
                        notification.id
                    )
                    .run();

                console.log(
                    "JAPY PUSH: recordatorio de 15 minutos omitido porque el evento ya comenzó:",
                    notification.id
                );

                continue;
            }

            const subscriptionResult =
                await env.japy_db
                    .prepare(
                        `
                        SELECT
                            id,
                            endpoint,
                            p256dh,
                            auth
                        FROM push_subscriptions
                        WHERE user_id = ?
                        `
                    )
                    .bind(
                        notification.user_id
                    )
                    .all();

            const subscriptions =
                subscriptionResult.results ||
                [];

            if (!subscriptions.length) {
                console.log(
                    "JAPY PUSH: usuario sin suscripciones:",
                    notification.user_id
                );

                await env.japy_db
                    .prepare(
                        `
                        UPDATE notifications
                        SET status = 'failed'
                        WHERE id = ?
                        AND status = 'pending'
                        `
                    )
                    .bind(
                        notification.id
                    )
                    .run();

                /*
                 * Si esta era la notificación de inicio,
                 * el evento ya expiró igualmente. La
                 * limpieza automática posterior lo eliminará.
                 */

                failed++;

                continue;
            }

            let notificationSent =
                false;

            for (
                const subscription
                of subscriptions
            ) {
                const pushSubscription = {
                    endpoint:
                        subscription.endpoint,

                    keys: {
                        p256dh:
                            subscription.p256dh,

                        auth:
                            subscription.auth,
                    },
                };

                const payload =
                    JSON.stringify({
                        title:
                            notification.title,

                        message:
                            notification.message,

                        url:
                            "/",

                        tag:
                            `japy-${notification.id}`,
                    });

                try {
                    await webpush.sendNotification(
                        pushSubscription,
                        payload
                    );

                    notificationSent =
                        true;

                    console.log(
                        "JAPY PUSH: enviado:",
                        notification.title
                    );

                } catch (error) {
                    console.error(
                        "JAPY PUSH ERROR:",
                        {
                            statusCode:
                                error?.statusCode,

                            message:
                                error?.message,

                            body:
                                error?.body,

                            headers:
                                error?.headers,
                        }
                    );

                    if (
                        error?.statusCode === 404 ||
                        error?.statusCode === 410
                    ) {
                        await env.japy_db
                            .prepare(
                                `
                                DELETE FROM push_subscriptions
                                WHERE id = ?
                                `
                            )
                            .bind(
                                subscription.id
                            )
                            .run();

                        console.log(
                            "JAPY PUSH: suscripción inválida eliminada."
                        );
                    }
                }
            }

            if (
                notificationSent
            ) {
                await env.japy_db
                    .prepare(
                        `
                        UPDATE notifications
                        SET
                            status = 'sent',
                            sent_at = ?
                        WHERE id = ?
                        AND status = 'pending'
                        `
                    )
                    .bind(
                        new Date().toISOString(),
                        notification.id
                    )
                    .run();

                sent++;

                /*
                 * La notificación "JAPY:"
                 * representa el inicio del evento.
                 *
                 * Después de procesarla, limpiamos
                 * el evento y sus notificaciones pendientes.
                 */

                if (
                    notification.title.startsWith(
                        "JAPY:"
                    )
                ) {
                    await env.japy_db
                        .prepare(
                            `
                            DELETE FROM events
                            WHERE id = ?
                            `
                        )
                        .bind(
                            notification.event_id
                        )
                        .run();

                    await env.japy_db
                        .prepare(
                            `
                            DELETE FROM notifications
                            WHERE event_id = ?
                            AND status = 'pending'
                            `
                        )
                        .bind(
                            notification.event_id
                        )
                        .run();

                    console.log(
                        "JAPY EVENTO: evento iniciado, finalizado y eliminado:",
                        notification.event_id
                    );
                }

                continue;
            }

            await env.japy_db
                .prepare(
                    `
                    UPDATE notifications
                    SET status = 'failed'
                    WHERE id = ?
                    AND status = 'pending'
                    `
                )
                .bind(
                    notification.id
                )
                .run();

            failed++;

        } catch (error) {
            console.error(
                "JAPY SCHEDULER ERROR:",
                notification.id,
                error
            );

            await env.japy_db
                .prepare(
                    `
                    UPDATE notifications
                    SET status = 'failed'
                    WHERE id = ?
                    AND status = 'pending'
                    `
                )
                .bind(
                    notification.id
                )
                .run();

            failed++;
        }
    }

    console.log(
        "JAPY SCHEDULER:",
        "procesadas =",
        notifications.length,
        "enviadas =",
        sent,
        "fallidas =",
        failed
    );

    return {
        processed:
            notifications.length,

        sent,

        failed,
    };
}


/* =========================================================
   LIMPIAR EVENTOS YA FINALIZADOS
   ========================================================= */

async function cleanupExpiredEvents(env) {
    const result =
        await env.japy_db
            .prepare(
                `
                SELECT
                    id,
                    title,
                    date,
                    time
                FROM events
                WHERE time IS NOT NULL
                ORDER BY date ASC, time ASC
                `
            )
            .all();

    const events =
        result.results || [];

    if (!events.length) {
        return 0;
    }

    const now =
        Date.now();

    let deleted = 0;

    for (
        const event
        of events
    ) {
        try {
            const eventUTC =
                localDateTimeToUTC(
                    event.date,
                    event.time,
                    JAPY_TIME_ZONE
                );

            if (
                eventUTC.getTime() <=
                now
            ) {
                await env.japy_db
                    .prepare(
                        `
                        DELETE FROM events
                        WHERE id = ?
                        `
                    )
                    .bind(
                        event.id
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

                deleted++;

                console.log(
                    "JAPY CLEANUP: evento expirado eliminado:",
                    {
                        id:
                            event.id,

                        title:
                            event.title,

                        date:
                            event.date,

                        time:
                            event.time,
                    }
                );
            }

        } catch (error) {
            console.error(
                "JAPY CLEANUP ERROR:",
                event.id,
                error
            );
        }
    }

    if (
        deleted
    ) {
        console.log(
            "JAPY CLEANUP: eliminados =",
            deleted
        );
    }

    return deleted;
}


/* =========================================================
   UTILIDADES
   ========================================================= */

function json(
    data,
    status = 200,
    headers = {}
) {
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


/* =========================================================
   ALIAS DE FECHAS / ERRORES COMUNES
   ========================================================= */

function normalizeDateAliases(text) {
    let normalized =
        normalizeText(text);

    const dateAliases = {
        hpy: "hoy",
        oy: "hoy",
        oi: "hoy",
        hoi: "hoy",

        manana: "manana",
        maniana: "manana",

        "pasao manana":
            "pasado manana",
    };

    for (
        const [
            variant,
            correct,
        ]
        of Object.entries(
            dateAliases
        )
    ) {
        normalized =
            normalized.replace(
                new RegExp(
                    `\\b${variant}\\b`,
                    "gi"
                ),
                correct
            );
    }

    return normalized;
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
   GOOGLE AUTHENTICATION
   ========================================================= */

const GOOGLE_CLIENT_ID =
    "691280235308-vkkhussogkn6p8kfn0mc3fj3jt1kvclj.apps.googleusercontent.com";

async function verifyGoogleCredential(
    credential
) {
    if (
        !credential ||
        typeof credential !== "string"
    ) {
        return null;
    }

    try {
        const response =
            await fetch(
                `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
                    credential
                )}`
            );

        if (!response.ok) {
            console.error(
                "GOOGLE TOKEN ERROR:",
                response.status
            );

            return null;
        }

        const data =
            await response.json();

        if (
            data.aud !==
            GOOGLE_CLIENT_ID
        ) {
            console.error(
                "GOOGLE TOKEN ERROR: audience inválida."
            );

            return null;
        }

        if (
            data.iss !==
                "https://accounts.google.com" &&
            data.iss !==
                "accounts.google.com"
        ) {
            console.error(
                "GOOGLE TOKEN ERROR: issuer inválido."
            );

            return null;
        }

        if (
            data.email_verified !==
                "true" &&
            data.email_verified !==
                true
        ) {
            console.error(
                "GOOGLE TOKEN ERROR: correo no verificado."
            );

            return null;
        }

        if (
            !data.sub ||
            !data.email
        ) {
            return null;
        }

        return {
            sub:
                String(data.sub),

            email:
                String(data.email)
                    .trim()
                    .toLowerCase(),

            name:
                String(
                    data.name ||
                    data.given_name ||
                    "Usuario"
                ).trim(),

            picture:
                data.picture ||
                null,
        };

    } catch (error) {
        console.error(
            "GOOGLE VERIFY ERROR:",
            error
        );

        return null;
    }
}


/* =========================================================
   FECHAS
   ========================================================= */

function getLocalDateParts(
    timeZone = JAPY_TIME_ZONE
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
                        JAPY_TIME_ZONE,

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
    timeZone = JAPY_TIME_ZONE
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
    timeZone = JAPY_TIME_ZONE
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
    timeZone = JAPY_TIME_ZONE
) {
    /*
     * Normalizamos errores comunes:
     *
     * hpy  → hoy
     * oy   → hoy
     * oi   → hoy
     * hoi  → hoy
     *
     * manana   → manana
     * maniana  → manana
     *
     * pasao manana → pasado manana
     */

    const normalized =
        normalizeDateAliases(
            text
        );

    const today =
        getLocalDateParts(
            timeZone
        );

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
   REFERENCIAS DE TIEMPO / FECHA
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

    /*
     * Horas escritas con palabras.
     *
     * Ejemplos:
     *
     * a la una
     * a las dos
     * a las cinco
     * a las siete de la tarde
     */

    const wordHours = {
        una: 1,
        uno: 1,

        dos: 2,
        tres: 3,
        cuatro: 4,
        cinco: 5,
        seis: 6,
        siete: 7,
        ocho: 8,
        nueve: 9,
        diez: 10,
        once: 11,
        doce: 12,

        trece: 13,
        catorce: 14,
        quince: 15,

        dieciseis: 16,
        dieciséis: 16,

        diecisiete: 17,
        dieciocho: 18,
        diecinueve: 19,

        veinte: 20,

        veintiuno: 21,

        veintidos: 22,
        veintidós: 22,

        veintitres: 23,
        veintitrés: 23,
    };

    const wordMatch =
        normalized.match(
            /\b(?:a las|a la|las|a)\s+(una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|dieciséis|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintidos|veintidós|veintitres|veintitrés)\b/i
        );

    if (
        wordMatch
    ) {
        let hour =
            wordHours[
                normalizeText(
                    wordMatch[1]
                )
            ];

        const context =
            normalized.slice(
                wordMatch.index,
                wordMatch.index +
                    wordMatch[0].length +
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
            hour <= 23
        ) {
            return `${String(hour).padStart(2, "0")}:00`;
        }
    }


    /*
     * Horas numéricas.
     *
     * Ejemplos:
     *
     * a las 14
     * a las 14:30
     * a las 7 de la tarde
     */

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


    /*
     * Hora directa:
     *
     * 14:00
     * 21:30
     */

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
    let source =
        String(text || "")
            .trim();

    source =
        source.replace(
            /^(?:japy)\s*[,;:.-]?\s*/i,
            ""
        );

    /*
     * REGLA PRINCIPAL:
     *
     * Después de "evento", todo pertenece
     * al título hasta encontrar el primer
     * indicador temporal.
     */

    const eventMatch =
        source.match(
            /\bevento\b/i
        );

    if (
        eventMatch
    ) {
        source =
            source.substring(
                eventMatch.index +
                    eventMatch[0].length
            ).trim();
    } else {
        source =
            source.replace(
                /^(?:creame|créame|crea|crear)\s+(?:un|el)?\s*/i,
                ""
            );

        source =
            source.replace(
                /^(?:llamado|llamada|de\s+nombre)\s+/i,
                ""
            );
    }


    /*
     * INDICADORES TEMPORALES
     */

    const temporalPatterns = [

        /* Alias comunes de hoy */
        /\b(?:hpy|oy|oi|hoi)\b/i,

        /* Alias comunes de mañana */
        /\b(?:manana|maniana)\b/i,

        /* Alias de pasado mañana */
        /\bpasao\s+(?:manana|mañana)\b/i,

        /\bpasado\s+(?:manana|mañana)\b/i,

        /* Horas escritas con palabras */
        /\b(?:a las|a la|las|a)\s+(?:una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|dieciséis|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintidos|veintidós|veintitres|veintitrés)\b/i,

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
        source.length;

    for (
        const pattern
        of temporalPatterns
    ) {
        const match =
            pattern.exec(
                source
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

    let title =
        source
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

    title =
        title.replace(
            /^[,;:.-]+\s*/g,
            ""
        );

    title =
        title.replace(
            /[\s,;:.-]+$/g,
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
   CONTEXTO
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
        .bind(
            userId
        )
        .run();
}


/* =========================================================
   REFERENCIAS A EVENTOS
   ========================================================= */

function tokenizeForEventMatch(
    text
) {
    const stopWords =
        new Set([
            "el",
            "la",
            "los",
            "las",
            "un",
            "una",
            "unos",
            "unas",
            "de",
            "del",
            "para",
            "por",
            "que",
            "era",
            "es",
            "evento",
            "eventos",
            "vi",
            "ya",
            "veo",
            "este",
            "esta",
            "ese",
            "esa",
            "aquel",
            "aquella",
            "ahi",
            "alli",
            "me",
            "lo",
            "le",
        ]);

    return normalizeText(text)
        .split(/\s+/)
        .map((word) =>
            word
                .replace(
                    /[^a-z0-9]/gi,
                    ""
                )
                .trim()
        )
        .filter(
            (word) =>
                word.length >= 4 &&
                !stopWords.has(word)
        );
}

function scoreEventReference(
    message,
    eventTitle
) {
    const messageTokens =
        tokenizeForEventMatch(
            message
        );

    const titleTokens =
        tokenizeForEventMatch(
            eventTitle
        );

    if (
        !messageTokens.length ||
        !titleTokens.length
    ) {
        return 0;
    }

    let score = 0;

    for (
        const titleToken
        of titleTokens
    ) {
        for (
            const messageToken
            of messageTokens
        ) {
            if (
                messageToken ===
                titleToken
            ) {
                score += 3;

                continue;
            }

            const titleStem =
                titleToken.slice(
                    0,
                    Math.min(
                        5,
                        titleToken.length
                    )
                );

            const messageStem =
                messageToken.slice(
                    0,
                    Math.min(
                        5,
                        messageToken.length
                    )
                );

            if (
                titleStem.length >= 4 &&
                messageStem.length >= 4 &&
                (
                    titleStem ===
                        messageStem ||
                    titleToken.startsWith(
                        messageStem
                    ) ||
                    messageToken.startsWith(
                        titleStem
                    )
                )
            ) {
                score += 1;
            }
        }
    }

    return score;
}

function isGenericEventReference(
    text
) {
    const normalized =
        normalizeText(text);

    return (
        /\bese\s+evento\b/i.test(
            normalized
        ) ||

        /\besa\s+evento\b/i.test(
            normalized
        ) ||

        /\bel\s+evento\s+anterior\b/i.test(
            normalized
        ) ||

        /\bla\s+anterior\b/i.test(
            normalized
        ) ||

        /\bel\s+anterior\b/i.test(
            normalized
        ) ||

        /\bese\s+de\s+ahi\b/i.test(
            normalized
        ) ||

        normalized ===
            "ese" ||

        normalized ===
            "esa" ||

        normalized ===
            "aquel" ||

        normalized ===
            "aquella"
    );
}

function isEventPronounReference(
    text
) {
    const normalized =
        normalizeText(text);

    return (
        /^(?:lo|la|le)$/i.test(
            normalized
        ) ||

        /^(?:cambialo|cambiala|modificalo|modificala|editalo|editala)$/i.test(
            normalized
        ) ||

        /^(?:cancelalo|cancelala|eliminalo|eliminala|borrarlo|borrala|borralo|borrala)$/i.test(
            normalized
        )
    );
}

async function findReferencedEvent(
    userId,
    message,
    context,
    env
) {
    const lastEvents =
        Array.isArray(
            context?.last_events
        )
            ? context.last_events
            : [];

    if (
        lastEvents.length
    ) {
        let bestEvent =
            null;

        let bestScore =
            0;

        for (
            const event
            of lastEvents
        ) {
            const score =
                scoreEventReference(
                    message,
                    event.title
                );

            if (
                score >
                bestScore
            ) {
                bestScore =
                    score;

                bestEvent =
                    event;
            }
        }

        if (
            bestEvent &&
            bestScore >= 2
        ) {
            return {
                ...bestEvent,

                matchScore:
                    bestScore,
            };
        }

        if (
            (
                isGenericEventReference(
                    message
                ) ||
                isEventPronounReference(
                    message
                )
            ) &&
            lastEvents.length === 1
        ) {
            return {
                ...lastEvents[0],

                matchScore:
                    1,
            };
        }
    }

    const result =
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
                ORDER BY date ASC, time ASC
                LIMIT 50
                `
            )
            .bind(
                userId
            )
            .all();

    const events =
        result.results || [];

    let bestEvent =
        null;

    let bestScore =
        0;

    for (
        const event
        of events
    ) {
        const score =
            scoreEventReference(
                message,
                event.title
            );

        if (
            score >
            bestScore
        ) {
            bestScore =
                score;

            bestEvent =
                event;
        }
    }

    if (
        bestEvent &&
        bestScore >= 3
    ) {
        return {
            ...bestEvent,

            matchScore:
                bestScore,
        };
    }

    return null;
}


/* =========================================================
   RECORDAR ÚLTIMO EVENTO
   ========================================================= */

async function rememberLastEvent(
    userId,
    event,
    env
) {
    if (!event) {
        return;
    }

    await saveConversationContext(
        userId,
        {
            flow:
                "conversation",

            last_intent:
                "event_reference",

            last_event: {
                id:
                    event.id,

                title:
                    event.title,

                date:
                    event.date,

                time:
                    event.time,
            },

            last_events: [
                {
                    id:
                        event.id,

                    title:
                        event.title,

                    date:
                        event.date,

                    time:
                        event.time,
                },
            ],
        },
        env
    );
}


/* =========================================================
   LOCAL → UTC
   ========================================================= */

function localDateTimeToUTC(
    date,
    time,
    timeZone = JAPY_TIME_ZONE
) {
    if (
        !date ||
        !time
    ) {
        throw new Error(
            "Fecha u hora inválida."
        );
    }

    const dateMatch =
        String(date).match(
            /^(\d{4})-(\d{2})-(\d{2})$/
        );

    const timeMatch =
        String(time).match(
            /^(\d{1,2}):(\d{2})$/
        );

    if (
        !dateMatch ||
        !timeMatch
    ) {
        throw new Error(
            `Fecha/hora inválida: ${date} ${time}`
        );
    }

    const year =
        Number(
            dateMatch[1]
        );

    const month =
        Number(
            dateMatch[2]
        );

    const day =
        Number(
            dateMatch[3]
        );

    const hour =
        Number(
            timeMatch[1]
        );

    const minute =
        Number(
            timeMatch[2]
        );

    if (
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31 ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59
    ) {
        throw new Error(
            `Fecha/hora fuera de rango: ${date} ${time}`
        );
    }

    const initialUTC =
        Date.UTC(
            year,
            month - 1,
            day,
            hour,
            minute,
            0,
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

    return new Date(
        initialUTC -
            offset
    );
}


/* =========================================================
   CREAR LAS 3 NOTIFICACIONES
   ========================================================= */

async function createEventNotifications(
    userId,
    event,
    env
) {
    if (
        !event ||
        !event.date ||
        !event.time
    ) {
        return [];
    }

    const eventDateTime =
        localDateTimeToUTC(
            event.date,
            event.time,
            JAPY_TIME_ZONE
        );

    const eventAt =
        eventDateTime;

    const remind15 =
        new Date(
            eventAt.getTime() -
                15 *
                    60 *
                    1000
        );

    const remind5 =
        new Date(
            eventAt.getTime() -
                5 *
                    60 *
                    1000
        );

    const notifications = [
        {
            id:
                uuidv4(),

            remindAt:
                remind15,

            title:
                `Recordatorio: ${event.title}`,

            message:
                `En 15 minutos tienes "${event.title}".`,
        },

        {
            id:
                uuidv4(),

            remindAt:
                remind5,

            title:
                `Recordatorio: ${event.title}`,

            message:
                `En 5 minutos tienes "${event.title}".`,
        },

        {
            id:
                uuidv4(),

            remindAt:
                eventAt,

            title:
                `JAPY: ${event.title}`,

            message:
                `El evento ya empezó: "${event.title}".`,
        },
    ];

    const createdAt =
        new Date().toISOString();

    for (
        const notification
        of notifications
    ) {
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
                notification.id,
                userId,
                event.id,
                notification.remindAt.toISOString(),
                notification.title,
                notification.message,
                createdAt
            )
            .run();
    }

    console.log(
        "JAPY NOTIFICATIONS CREATED:",
        {
            event:
                event.title,

            eventLocal:
                `${event.date} ${event.time}`,

            eventUTC:
                eventAt.toISOString(),

            reminder15:
                remind15.toISOString(),

            reminder5:
                remind5.toISOString(),

            eventStart:
                eventAt.toISOString(),
        }
    );

    return notifications;
}


/* =========================================================
   CREAR EVENTO
   ========================================================= */

async function createEvent(
    userId,
    title,
    date,
    time,
    env
) {
    const eventId =
        uuidv4();

    const createdAt =
        new Date().toISOString();

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

    const event = {
        id:
            eventId,

        title,

        date,

        time,
    };

    let notifications =
        [];

    if (
        time
    ) {
        try {
            notifications =
                await createEventNotifications(
                    userId,
                    event,
                    env
                );

        } catch (error) {
            console.error(
                "NOTIFICATION CREATE ERROR:",
                error
            );
        }
    }

    return {
        ...event,

        notifications,
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
   BUSCAR EVENTO
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

    const result =
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
                ORDER BY date ASC, time ASC
                LIMIT 100
                `
            )
            .bind(
                userId
            )
            .all();

    const events =
        result.results || [];

    const normalizedSearch =
        normalizeText(
            cleanTitle
        );

    for (
        const event
        of events
    ) {
        if (
            normalizeText(
                event.title
            ) ===
            normalizedSearch
        ) {
            return event;
        }
    }

    const containsMatches =
        events.filter(
            (event) => {
                const normalizedTitle =
                    normalizeText(
                        event.title
                    );

                return (
                    normalizedTitle.includes(
                        normalizedSearch
                    ) ||
                    normalizedSearch.includes(
                        normalizedTitle
                    )
                );
            }
        );

    if (
        containsMatches.length === 1
    ) {
        return containsMatches[0];
    }

    let bestEvent =
        null;

    let bestScore =
        0;

    for (
        const event
        of events
    ) {
        const score =
            scoreEventReference(
                cleanTitle,
                event.title
            );

        if (
            score >
            bestScore
        ) {
            bestScore =
                score;

            bestEvent =
                event;
        }
    }

    if (
        bestEvent &&
        bestScore >= 3
    ) {
        return bestEvent;
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
            JAPY_TIME_ZONE
        );

    const timeFromMessage =
        parseTimeFromText(
            message
        );

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
                    "Necesito la hora. Por ejemplo: “15:00”, “a las 15” o “a las tres”.",
            });
        }
    }

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
                env
            );

        await clearConversationContext(
            user.id,
            env
        );

        await rememberLastEvent(
            user.id,
            event,
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
            JAPY_TIME_ZONE
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

    if (
        sameTime &&
        context.originalTime
    ) {
        context.time =
            context.originalTime;
    }

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

    if (
        event.time
    ) {
        try {
            await createEventNotifications(
                user.id,
                event,
                env
            );

        } catch (error) {
            console.error(
                "UPDATED NOTIFICATION ERROR:",
                error
            );
        }
    }

    await rememberLastEvent(
        user.id,
        event,
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
   CHAT
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

    /*
     * JAPY SIEMPRE usa Santiago.
     */
    const timeZone =
        JAPY_TIME_ZONE;

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

    const existingContext =
        await getConversationContext(
            user.id,
            env
        );


    /* =====================================================
       INTENCIONES EXPLÍCITAS DE ALTA PRIORIDAD
       ===================================================== */

    const isDeleteCommand =
        /^(?:japy\s+)?(?:cancela|cancelar|elimina|eliminar|borra|borrar)\b/i.test(
            normalized
        );

    const isEditCommandNow =
        /^(?:japy\s+)?(?:cambia|cambiar|modifica|modificar|edita|editar|actualiza|actualizar)\b/i.test(
            normalized
        );


    /* =====================================================
       CANCELAR OPERACIÓN ACTUAL
       ===================================================== */

    if (
        existingContext
    ) {
        if (
            normalized === "cancelar" ||
            normalized === "cancela" ||
            normalized === "olvidalo" ||
            normalized === "olvidelo"
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

        if (
            existingContext.flow ===
                "create_event" &&
            !isDeleteCommand &&
            !isEditCommandNow
        ) {
            return continueCreateEventConversation(
                message,
                user,
                env,
                existingContext,
                timeZone
            );
        }

        if (
            existingContext.flow ===
                "edit_event" &&
            !isDeleteCommand
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
        normalized.startsWith("hola ")
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
        normalized === "gracias" ||
        normalized === "muchas gracias" ||
        normalized === "gracias japy"
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
        normalized.includes("quien eres") ||
        normalized.includes("que eres") ||
        normalized.includes("quien es japy")
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
        normalized.includes("mis eventos") ||
        normalized.includes("muestra mis eventos") ||
        normalized.includes("mostrar mis eventos") ||
        normalized.includes("ver mis eventos") ||
        normalized.includes("que tengo")
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

        const events =
            result.results || [];

        await saveConversationContext(
            user.id,
            {
                flow:
                    "conversation",

                last_intent:
                    "list_events",

                last_events:
                    events
                        .slice(
                            0,
                            10
                        )
                        .map(
                            (event) => ({
                                id:
                                    event.id,

                                title:
                                    event.title,

                                date:
                                    event.date,

                                time:
                                    event.time,
                            })
                        ),

                last_event:
                    events.length === 1
                        ? {
                              id:
                                  events[0].id,

                              title:
                                  events[0].title,

                              date:
                                  events[0].date,

                              time:
                                  events[0].time,
                          }
                        : null,
            },
            env
        );

        const spokenEvents =
            events
                .slice(
                    0,
                    10
                )
                .map(
                    (event) =>
                        event.time
                            ? `${event.title}, el ${event.date} a las ${event.time}`
                            : `${event.title}, el ${event.date}`
                )
                .join(
                    ". "
                );

        return json({
            type:
                "events",

            events,

            response:
                events.length
                    ? `Estos son tus próximos eventos: ${spokenEvents}.`
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
                JAPY_TIME_ZONE
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

        const event =
            await createEvent(
                user.id,
                context.title,
                context.date,
                context.time,
                env
            );

        await clearConversationContext(
            user.id,
            env
        );

        await rememberLastEvent(
            user.id,
            event,
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
        /^(?:japy\s+)?(?:cambia|cambiar|modifica|modificar|edita|editar|actualiza|actualizar)\b/i.test(
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
            /* Alias de fechas */
            /\b(?:hpy|oy|oi|hoi)\b/i,

            /\b(?:manana|maniana)\b/i,

            /\bpasao\s+(?:manana|mañana)\b/i,

            /\bpasado\s+(?:manana|mañana)\b/i,

            /\bhoy\b/i,

            /\b(?:el|este|proximo|próximo|siguiente)\s+(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b/i,

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

        let event =
            null;

        if (
            searchTitle &&
            !isEventPronounReference(
                searchTitle
            ) &&
            !isGenericEventReference(
                searchTitle
            )
        ) {
            event =
                await findEventByTitle(
                    user.id,
                    searchTitle,
                    env
                );
        }

        if (
            !event &&
            existingContext?.last_event
        ) {
            event =
                await findEventByTitle(
                    user.id,
                    existingContext.last_event.title,
                    env
                );
        }

        if (
            !event &&
            searchTitle
        ) {
            event =
                await findReferencedEvent(
                    user.id,
                    searchTitle,
                    existingContext,
                    env
                );
        }

        if (!event) {
            return json({
                type:
                    "chat",

                response:
                    searchTitle
                        ? `No encontré un evento llamado "${searchTitle}".`
                        : "Claro. ¿Qué evento quieres modificar?",
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
                JAPY_TIME_ZONE
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

            if (
                updatedEvent.time
            ) {
                try {
                    await createEventNotifications(
                        user.id,
                        updatedEvent,
                        env
                    );

                } catch (error) {
                    console.error(
                        "UPDATED NOTIFICATION ERROR:",
                        error
                    );
                }
            }

            await rememberLastEvent(
                user.id,
                updatedEvent,
                env
            );

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
       CANCELAR / ELIMINAR EVENTO
       ===================================================== */

    const cancelCommand =
        /^(?:japy\s+)?(?:cancela|cancelar|elimina|eliminar|borra|borrar)\b/i.test(
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

        let event =
            null;

        if (
            existingContext?.last_event &&
            (
                !title ||
                isGenericEventReference(
                    title
                ) ||
                isEventPronounReference(
                    title
                )
            )
        ) {
            event =
                await findEventByTitle(
                    user.id,
                    existingContext.last_event.title,
                    env
                );
        }

        if (
            !event &&
            title &&
            !isGenericEventReference(
                title
            ) &&
            !isEventPronounReference(
                title
            )
        ) {
            event =
                await findEventByTitle(
                    user.id,
                    title,
                    env
                );
        }

        if (
            !event &&
            title
        ) {
            event =
                await findReferencedEvent(
                    user.id,
                    title,
                    existingContext,
                    env
                );
        }

        if (!event) {
            return json({
                type:
                    "chat",

                response:
                    title
                        ? `No encontré un evento llamado "${title}".`
                        : "Claro. ¿Qué evento quieres cancelar?",
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

        await saveConversationContext(
            user.id,
            {
                flow:
                    "conversation",

                last_intent:
                    "event_deleted",

                last_event:
                    null,

                last_events:
                    [],
            },
            env
        );

        return json({
            type:
                "event_deleted",

            response:
                `Listo. Cancelé el evento "${event.title}". 🗑️`,
        });
    }


    /* =====================================================
       REFERENCIA DE CONVERSACIÓN
       ===================================================== */

    if (
        existingContext &&
        existingContext.flow ===
            "conversation"
    ) {
        const referencedEvent =
            await findReferencedEvent(
                user.id,
                message,
                existingContext,
                env
            );

        if (
            referencedEvent
        ) {
            await saveConversationContext(
                user.id,
                {
                    ...existingContext,

                    flow:
                        "conversation",

                    last_intent:
                        "event_reference",

                    last_event: {
                        id:
                            referencedEvent.id,

                        title:
                            referencedEvent.title,

                        date:
                            referencedEvent.date,

                        time:
                            referencedEvent.time,
                    },
                },
                env
            );

            return json({
                type:
                    "chat",

                response:
                    `Sí, entiendo que te refieres a "${referencedEvent.title}". ¿Qué quieres hacer con ese evento?`,
            });
        }
    }


    /* =====================================================
       RESPUESTA GENERAL
       ===================================================== */

    return json({
        type:
            "chat",

        response:
            "Te escucho. ¿Qué quieres hacer?",
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

        /*
         * Primero procesamos las notificaciones.
         */
        await processNotifications(
            env
        );

        /*
         * Después limpiamos eventos cuyo tiempo
         * de inicio ya pasó.
         *
         * Esto funciona incluso si el evento no
         * tenía notificaciones.
         */
        await cleanupExpiredEvents(
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


        /* =================================================
           OPTIONS
           ================================================= */

        if (
            request.method ===
            "OPTIONS"
        ) {
            return new Response(
                null,
                {
                    status:
                        204,

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
           LOGIN CON GOOGLE
           ================================================= */

        if (
            url.pathname ===
                "/api/auth/google" &&
            request.method ===
                "POST"
        ) {
            try {
                const body =
                    await request.json();

                const credential =
                    String(
                        body?.credential ||
                        ""
                    ).trim();

                if (!credential) {
                    return json(
                        {
                            error:
                                "No se recibió la credencial de Google.",
                        },
                        400,
                        corsHeaders
                    );
                }

                const googleUser =
                    await verifyGoogleCredential(
                        credential
                    );

                if (!googleUser) {
                    return json(
                        {
                            error:
                                "La autenticación de Google no es válida.",
                        },
                        401,
                        corsHeaders
                    );
                }

                let user =
                    await env.japy_db
                        .prepare(
                            `
                            SELECT
                                id,
                                email,
                                name,
                                google_sub
                            FROM users
                            WHERE google_sub = ?
                            LIMIT 1
                            `
                        )
                        .bind(
                            googleUser.sub
                        )
                        .first();

                if (!user) {
                    user =
                        await env.japy_db
                            .prepare(
                                `
                                SELECT
                                    id,
                                    email,
                                    name,
                                    google_sub
                                FROM users
                                WHERE LOWER(email) = LOWER(?)
                                LIMIT 1
                                `
                            )
                            .bind(
                                googleUser.email
                            )
                            .first();

                    if (user) {
                        await env.japy_db
                            .prepare(
                                `
                                UPDATE users
                                SET
                                    google_sub = ?,
                                    name = ?
                                WHERE id = ?
                                `
                            )
                            .bind(
                                googleUser.sub,
                                googleUser.name,
                                user.id
                            )
                            .run();

                        user = {
                            ...user,

                            name:
                                googleUser.name,

                            google_sub:
                                googleUser.sub,
                        };

                    } else {
                        const userId =
                            uuidv4();

                        const createdAt =
                            new Date().toISOString();

                        const placeholderPassword =
                            `google-${uuidv4()}`;

                        const passwordHash =
                            await hashPassword(
                                placeholderPassword
                            );

                        await env.japy_db
                            .prepare(
                                `
                                INSERT INTO users (
                                    id,
                                    email,
                                    password_hash,
                                    name,
                                    created_at,
                                    google_sub
                                )
                                VALUES (?, ?, ?, ?, ?, ?)
                                `
                            )
                            .bind(
                                userId,
                                googleUser.email,
                                passwordHash,
                                googleUser.name,
                                createdAt,
                                googleUser.sub
                            )
                            .run();

                        user = {
                            id:
                                userId,

                            email:
                                googleUser.email,

                            name:
                                googleUser.name,

                            google_sub:
                                googleUser.sub,
                        };
                    }
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
                    "GOOGLE LOGIN ERROR:",
                    error
                );

                return json(
                    {
                        error:
                            "No se pudo iniciar sesión con Google.",
                    },
                    500,
                    corsHeaders
                );
            }
        }


        /* =================================================
           LOGIN TRADICIONAL
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
           PUSH - CLAVE PÚBLICA
           ================================================= */

        if (
            url.pathname ===
                "/api/push/public-key" &&
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

            if (
                !env.VAPID_PUBLIC_KEY
            ) {
                return json(
                    {
                        error:
                            "La clave pública VAPID no está configurada.",
                    },
                    500,
                    corsHeaders
                );
            }

            return json(
                {
                    publicKey:
                        env.VAPID_PUBLIC_KEY,
                },
                200,
                corsHeaders
            );
        }


        /* =================================================
           PUSH - SUSCRIPCIÓN
           ================================================= */

        if (
            url.pathname ===
                "/api/push/subscribe" &&
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

                const subscription =
                    body?.subscription;

                if (
                    !subscription ||
                    !subscription.endpoint ||
                    !subscription.keys ||
                    !subscription.keys.p256dh ||
                    !subscription.keys.auth
                ) {
                    return json(
                        {
                            error:
                                "La suscripción Push no es válida.",
                        },
                        400,
                        corsHeaders
                    );
                }

                const now =
                    new Date().toISOString();

                const existing =
                    await env.japy_db
                        .prepare(
                            `
                            SELECT
                                id
                            FROM push_subscriptions
                            WHERE endpoint = ?
                            `
                        )
                        .bind(
                            subscription.endpoint
                        )
                        .first();

                if (
                    existing
                ) {
                    await env.japy_db
                        .prepare(
                            `
                            UPDATE push_subscriptions
                            SET
                                user_id = ?,
                                p256dh = ?,
                                auth = ?,
                                updated_at = ?
                            WHERE endpoint = ?
                            `
                        )
                        .bind(
                            user.id,
                            subscription.keys.p256dh,
                            subscription.keys.auth,
                            now,
                            subscription.endpoint
                        )
                        .run();

                } else {
                    await env.japy_db
                        .prepare(
                            `
                            INSERT INTO push_subscriptions (
                                id,
                                user_id,
                                endpoint,
                                p256dh,
                                auth,
                                created_at,
                                updated_at
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                            `
                        )
                        .bind(
                            uuidv4(),
                            user.id,
                            subscription.endpoint,
                            subscription.keys.p256dh,
                            subscription.keys.auth,
                            now,
                            now
                        )
                        .run();
                }

                console.log(
                    "JAPY PUSH: suscripción guardada para",
                    user.email
                );

                return json(
                    {
                        success:
                            true,

                        message:
                            "Notificaciones activadas correctamente.",
                    },
                    200,
                    corsHeaders
                );

            } catch (error) {
                console.error(
                    "PUSH SUBSCRIBE ERROR:",
                    error
                );

                return json(
                    {
                        error:
                            "No se pudo guardar la suscripción Push.",
                    },
                    500,
                    corsHeaders
                );
            }
        }


        /* =================================================
           PUSH - PRUEBA MANUAL
           ================================================= */

        if (
            url.pathname ===
                "/api/push/test" &&
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

                if (
                    !env.VAPID_SUBJECT ||
                    !env.VAPID_PUBLIC_KEY ||
                    !env.VAPID_PRIVATE_KEY
                ) {
                    return json(
                        {
                            error:
                                "Las claves VAPID no están configuradas.",
                        },
                        500,
                        corsHeaders
                    );
                }

                const result =
                    await env.japy_db
                        .prepare(
                            `
                            SELECT
                                id,
                                endpoint,
                                p256dh,
                                auth
                            FROM push_subscriptions
                            WHERE user_id = ?
                            `
                        )
                        .bind(
                            user.id
                        )
                        .all();

                const subscriptions =
                    result.results || [];

                if (
                    !subscriptions.length
                ) {
                    return json(
                        {
                            error:
                                "No tienes ninguna suscripción Push registrada.",
                        },
                        404,
                        corsHeaders
                    );
                }

                webpush.setVapidDetails(
                    env.VAPID_SUBJECT,
                    env.VAPID_PUBLIC_KEY,
                    env.VAPID_PRIVATE_KEY
                );

                const payload =
                    JSON.stringify({
                        title:
                            "JAPY",

                        message:
                            "¡Las notificaciones Push funcionan! 🔔",

                        url:
                            "/",

                        tag:
                            `japy-test-${Date.now()}`,
                    });

                let sent = 0;

                for (
                    const subscription
                    of subscriptions
                ) {
                    try {
                        await webpush.sendNotification(
                            {
                                endpoint:
                                    subscription.endpoint,

                                keys: {
                                    p256dh:
                                        subscription.p256dh,

                                    auth:
                                        subscription.auth,
                                },
                            },
                            payload
                        );

                        sent++;

                        console.log(
                            "JAPY PUSH TEST: enviado."
                        );

                    } catch (error) {
                        console.error(
                            "JAPY PUSH TEST ERROR:",
                            {
                                statusCode:
                                    error?.statusCode,

                                message:
                                    error?.message,

                                body:
                                    error?.body,

                                headers:
                                    error?.headers,
                            }
                        );

                        if (
                            error?.statusCode ===
                                404 ||
                            error?.statusCode ===
                                410
                        ) {
                            await env.japy_db
                                .prepare(
                                    `
                                    DELETE FROM push_subscriptions
                                    WHERE id = ?
                                    `
                                )
                                .bind(
                                    subscription.id
                                )
                                .run();
                        }
                    }
                }

                if (
                    sent === 0
                ) {
                    return json(
                        {
                            success:
                                false,

                            error:
                                "No se pudo enviar el Push.",
                        },
                        500,
                        corsHeaders
                    );
                }

                return json(
                    {
                        success:
                            true,

                        sent,
                    },
                    200,
                    corsHeaders
                );

            } catch (error) {
                console.error(
                    "PUSH TEST ERROR:",
                    error
                );

                return json(
                    {
                        error:
                            "Error enviando Push de prueba.",
                    },
                    500,
                    corsHeaders
                );
            }
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
                        env
                    );

                await rememberLastEvent(
                    user.id,
                    event,
                    env
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