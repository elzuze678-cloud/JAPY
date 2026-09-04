import { hashPassword, verifyPassword } from "./auth/password.js";

function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...headers
        }
    });
}

function getSessionId(request) {
    const cookie = request.headers.get("Cookie");

    if (!cookie) {
        return null;
    }

    const cookies = cookie.split(";");

    for (const item of cookies) {
        const [name, ...rest] = item.trim().split("=");

        if (name === "japy_session") {
            return rest.join("=");
        }
    }

    return null;
}

async function getSession(request, env) {
    const sessionId = getSessionId(request);

    if (!sessionId) {
        return null;
    }

    const result = await env.japy_db
        .prepare(`
            SELECT
                sessions.id,
                sessions.user_id,
                sessions.expires_at,
                users.name,
                users.email
            FROM sessions
            INNER JOIN users
                ON users.id = sessions.user_id
            WHERE sessions.id = ?
        `)
        .bind(sessionId)
        .first();

    if (!result) {
        return null;
    }

    const now = new Date();

    if (new Date(result.expires_at) <= now) {
        await env.japy_db
            .prepare("DELETE FROM sessions WHERE id = ?")
            .bind(sessionId)
            .run();

        return null;
    }

    return result;
}


export default {

    async fetch(request, env) {

        const url = new URL(request.url);


        /* =========================
           HEALTH
        ========================= */

        if (
            request.method === "GET" &&
            url.pathname === "/api/health"
        ) {

            const result = await env.japy_db
                .prepare("SELECT 1 AS ok")
                .first();

            return jsonResponse({
                success: true,
                database: result?.ok === 1
            });
        }


        /* =========================
           REGISTER
        ========================= */

        if (
            request.method === "POST" &&
            url.pathname === "/api/register"
        ) {

            try {

                const body = await request.json();

                const name = String(body.name || "").trim();
                const email = String(body.email || "").trim().toLowerCase();
                const password = String(body.password || "");


                if (!name || !email || !password) {
                    return jsonResponse({
                        success: false,
                        message: "Todos los campos son obligatorios."
                    }, 400);
                }


                if (password.length < 8) {
                    return jsonResponse({
                        success: false,
                        message: "La contraseña debe tener al menos 8 caracteres."
                    }, 400);
                }


                const existingUser = await env.japy_db
                    .prepare(`
                        SELECT id
                        FROM users
                        WHERE email = ?
                    `)
                    .bind(email)
                    .first();


                if (existingUser) {
                    return jsonResponse({
                        success: false,
                        message: "Ya existe una cuenta con ese correo."
                    }, 409);
                }


                const userId = crypto.randomUUID();
                const passwordHash = await hashPassword(password);
                const createdAt = new Date().toISOString();


                await env.japy_db
                    .prepare(`
                        INSERT INTO users (
                            id,
                            email,
                            password_hash,
                            name,
                            created_at
                        )
                        VALUES (?, ?, ?, ?, ?)
                    `)
                    .bind(
                        userId,
                        email,
                        passwordHash,
                        name,
                        createdAt
                    )
                    .run();


                return jsonResponse({
                    success: true,
                    message: "Cuenta creada correctamente.",
                    user: {
                        id: userId,
                        name,
                        email
                    }
                }, 201);


            } catch (error) {

                console.error(error);

                return jsonResponse({
                    success: false,
                    message: "No se pudo crear la cuenta."
                }, 500);
            }
        }


        /* =========================
           LOGIN
        ========================= */

        if (
            request.method === "POST" &&
            url.pathname === "/api/login"
        ) {

            try {

                const body = await request.json();

                const email = String(body.email || "")
                    .trim()
                    .toLowerCase();

                const password = String(body.password || "");


                if (!email || !password) {
                    return jsonResponse({
                        success: false,
                        message: "Correo y contraseña son obligatorios."
                    }, 400);
                }


                const user = await env.japy_db
                    .prepare(`
                        SELECT
                            id,
                            name,
                            email,
                            password_hash
                        FROM users
                        WHERE email = ?
                    `)
                    .bind(email)
                    .first();


                if (!user) {
                    return jsonResponse({
                        success: false,
                        message: "Correo o contraseña incorrectos."
                    }, 401);
                }


                const validPassword = await verifyPassword(
                    password,
                    user.password_hash
                );


                if (!validPassword) {
                    return jsonResponse({
                        success: false,
                        message: "Correo o contraseña incorrectos."
                    }, 401);
                }


                const sessionId = crypto.randomUUID();

                const expiresAt = new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000
                ).toISOString();

                const createdAt = new Date().toISOString();


                await env.japy_db
                    .prepare(`
                        INSERT INTO sessions (
                            id,
                            user_id,
                            expires_at,
                            created_at
                        )
                        VALUES (?, ?, ?, ?)
                    `)
                    .bind(
                        sessionId,
                        user.id,
                        expiresAt,
                        createdAt
                    )
                    .run();


                const secure =
                    url.protocol === "https:"
                        ? "Secure; "
                        : "";


                return jsonResponse(
                    {
                        success: true,
                        message: "Inicio de sesión correcto.",
                        user: {
                            id: user.id,
                            name: user.name,
                            email: user.email
                        }
                    },
                    200,
                    {
                        "Set-Cookie":
                            `japy_session=${sessionId}; ` +
                            `HttpOnly; ` +
                            secure +
                            `SameSite=Lax; ` +
                            `Path=/; ` +
                            `Max-Age=604800`
                    }
                );


            } catch (error) {

                console.error(error);

                return jsonResponse({
                    success: false,
                    message: "No se pudo iniciar sesión."
                }, 500);
            }
        }


        /* =========================
           CURRENT USER
        ========================= */

        if (
            request.method === "GET" &&
            url.pathname === "/api/me"
        ) {

            const session = await getSession(request, env);


            if (!session) {

                const secure =
                    url.protocol === "https:"
                        ? "Secure; "
                        : "";


                return jsonResponse(
                    {
                        success: false,
                        message: "No hay una sesión activa."
                    },
                    401,
                    {
                        "Set-Cookie":
                            "japy_session=; " +
                            "HttpOnly; " +
                            secure +
                            "SameSite=Lax; " +
                            "Path=/; " +
                            "Max-Age=0"
                    }
                );
            }


            return jsonResponse({
                success: true,
                user: {
                    id: session.user_id,
                    name: session.name,
                    email: session.email
                },
                session: {
                    expires_at: session.expires_at
                }
            });
        }


        /* =========================
           EVENTS - GET
        ========================= */

        if (
            request.method === "GET" &&
            url.pathname === "/api/events"
        ) {

            const session = await getSession(request, env);


            if (!session) {
                return jsonResponse({
                    success: false,
                    message: "No hay una sesión activa."
                }, 401);
            }


            const result = await env.japy_db
                .prepare(`
                    SELECT
                        id,
                        title,
                        date,
                        time,
                        created_at
                    FROM events
                    WHERE user_id = ?
                    ORDER BY date ASC, time ASC
                `)
                .bind(session.user_id)
                .all();


            return jsonResponse({
                success: true,
                events: result.results
            });
        }


        /* =========================
           EVENTS - POST
        ========================= */

        if (
            request.method === "POST" &&
            url.pathname === "/api/events"
        ) {

            try {

                const session = await getSession(request, env);


                if (!session) {
                    return jsonResponse({
                        success: false,
                        message: "No hay una sesión activa."
                    }, 401);
                }


                const body = await request.json();


                const title = String(body.title || "")
                    .trim()
                    .replace(/\s+/g, " ");

                const date = String(body.date || "").trim();
                const time = String(body.time || "").trim();


                if (!title || !date) {
                    return jsonResponse({
                        success: false,
                        message: "El título y la fecha son obligatorios."
                    }, 400);
                }


                if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                    return jsonResponse({
                        success: false,
                        message: "La fecha debe tener formato YYYY-MM-DD."
                    }, 400);
                }


                if (
                    time &&
                    !/^\d{2}:\d{2}$/.test(time)
                ) {
                    return jsonResponse({
                        success: false,
                        message: "La hora debe tener formato HH:mm."
                    }, 400);
                }


                const eventId = crypto.randomUUID();
                const createdAt = new Date().toISOString();


                await env.japy_db
                    .prepare(`
                        INSERT INTO events (
                            id,
                            user_id,
                            title,
                            date,
                            time,
                            created_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?)
                    `)
                    .bind(
                        eventId,
                        session.user_id,
                        title,
                        date,
                        time || null,
                        createdAt
                    )
                    .run();


                return jsonResponse({
                    success: true,
                    message: "Evento creado correctamente.",
                    event: {
                        id: eventId,
                        title,
                        date,
                        time: time || null,
                        created_at: createdAt
                    }
                }, 201);


            } catch (error) {

                console.error(error);

                return jsonResponse({
                    success: false,
                    message: "No se pudo crear el evento."
                }, 500);
            }
        }


        /* =========================
           FRONTEND
        ========================= */

        if (
            request.method === "GET" &&
            url.pathname === "/"
        ) {

            return env.ASSETS.fetch(request);
        }


        if (
            request.method === "GET" &&
            !url.pathname.startsWith("/api/")
        ) {

            return env.ASSETS.fetch(request);
        }


        return new Response(
            "JAPY Web funcionando.",
            {
                status: 404,
                headers: {
                    "Content-Type": "text/plain; charset=utf-8"
                }
            }
        );
    }
};