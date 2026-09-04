import {
	hashPassword,
	verifyPassword
} from "./auth/password.js";

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		// =========================
		// HEALTH CHECK
		// =========================

		if (url.pathname === "/api/health") {
			const result = await env.japy_db
				.prepare("SELECT 1 AS ok")
				.first();

			return Response.json({
				success: true,
				database: result.ok === 1
			});
		}

		// =========================
		// REGISTRO
		// =========================

		if (
			url.pathname === "/api/register" &&
			request.method === "POST"
		) {
			try {
				const body = await request.json();

				const name = body.name?.trim();
				const email = body.email?.trim().toLowerCase();
				const password = body.password;

				if (!name || !email || !password) {
					return Response.json(
						{
							success: false,
							message: "Faltan datos."
						},
						{ status: 400 }
					);
				}

				if (password.length < 8) {
					return Response.json(
						{
							success: false,
							message:
								"La contraseña debe tener al menos 8 caracteres."
						},
						{ status: 400 }
					);
				}

				const existingUser = await env.japy_db
					.prepare(
						"SELECT id FROM users WHERE email = ?"
					)
					.bind(email)
					.first();

				if (existingUser) {
					return Response.json(
						{
							success: false,
							message:
								"Ya existe una cuenta con ese correo."
						},
						{ status: 409 }
					);
				}

				const userId = crypto.randomUUID();

				const passwordHash =
					await hashPassword(password);

				const createdAt =
					new Date().toISOString();

				await env.japy_db
					.prepare(
						`
						INSERT INTO users
						(id, email, password_hash, name, created_at)
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

				return Response.json(
					{
						success: true,
						message:
							"Cuenta creada correctamente.",
						user: {
							id: userId,
							name: name,
							email: email
						}
					},
					{ status: 201 }
				);
			} catch (error) {
				console.error(error);

				return Response.json(
					{
						success: false,
						message:
							"Error interno al crear la cuenta."
					},
					{ status: 500 }
				);
			}
		}

		// =========================
		// LOGIN
		// =========================

		if (
			url.pathname === "/api/login" &&
			request.method === "POST"
		) {
			try {
				const body = await request.json();

				const email = body.email?.trim().toLowerCase();
				const password = body.password;

				if (!email || !password) {
					return Response.json(
						{
							success: false,
							message:
								"Debes introducir correo y contraseña."
						},
						{ status: 400 }
					);
				}

				const user = await env.japy_db
					.prepare(
						`
						SELECT
							id,
							name,
							email,
							password_hash
						FROM users
						WHERE email = ?
						`
					)
					.bind(email)
					.first();

				if (!user) {
					return Response.json(
						{
							success: false,
							message:
								"Correo o contraseña incorrectos."
						},
						{ status: 401 }
					);
				}

				const validPassword =
					await verifyPassword(
						password,
						user.password_hash
					);

				if (!validPassword) {
					return Response.json(
						{
							success: false,
							message:
								"Correo o contraseña incorrectos."
						},
						{ status: 401 }
					);
				}

				const sessionId =
					crypto.randomUUID();

				const createdAt =
					new Date();

				const expiresAt =
					new Date(
						createdAt.getTime() +
						7 * 24 * 60 * 60 * 1000
					);

				await env.japy_db
					.prepare(
						`
						INSERT INTO sessions
						(id, user_id, expires_at, created_at)
						VALUES (?, ?, ?, ?)
						`
					)
					.bind(
						sessionId,
						user.id,
						expiresAt.toISOString(),
						createdAt.toISOString()
					)
					.run();

				return new Response(
					JSON.stringify({
						success: true,
						message:
							"Inicio de sesión correcto.",
						user: {
							id: user.id,
							name: user.name,
							email: user.email
						}
					}),
					{
						status: 200,
						headers: {
							"Content-Type":
								"application/json",
							"Set-Cookie":
								`japy_session=${sessionId}; ` +
								`HttpOnly; ` +
								`${url.protocol === "https:" ? "Secure; " : ""}` +
								`SameSite=Lax; ` +
								`Path=/; ` +
								`Max-Age=604800`
						}
					}
				);
			} catch (error) {
				console.error(error);

				return Response.json(
					{
						success: false,
						message:
							"Error interno al iniciar sesión."
					},
					{ status: 500 }
				);
			}
		}

		// =========================
		// COMPROBAR SESIÓN
		// =========================

		if (
			url.pathname === "/api/me" &&
			request.method === "GET"
		) {
			try {
				const cookieHeader =
					request.headers.get("Cookie");

				if (!cookieHeader) {
					return Response.json(
						{
							success: false,
							message: "No hay una sesión activa."
						},
						{ status: 401 }
					);
				}

				const cookies = cookieHeader
					.split(";")
					.map((cookie) => cookie.trim());

				const sessionCookie =
					cookies.find((cookie) =>
						cookie.startsWith("japy_session=")
					);

				if (!sessionCookie) {
					return Response.json(
						{
							success: false,
							message: "No hay una sesión activa."
						},
						{ status: 401 }
					);
				}

				const sessionId =
					sessionCookie.substring(
						"japy_session=".length
					);

				if (!sessionId) {
					return Response.json(
						{
							success: false,
							message: "Sesión inválida."
						},
						{ status: 401 }
					);
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
							INNER JOIN users
								ON users.id = sessions.user_id
							WHERE sessions.id = ?
							`
						)
						.bind(sessionId)
						.first();

				if (!session) {
					return Response.json(
						{
							success: false,
							message: "Sesión inválida."
						},
						{ status: 401 }
					);
				}

				const now =
					new Date();

				const expiresAt =
					new Date(session.expires_at);

				if (expiresAt <= now) {
					await env.japy_db
						.prepare(
							"DELETE FROM sessions WHERE id = ?"
						)
						.bind(sessionId)
						.run();

					return new Response(
						JSON.stringify({
							success: false,
							message: "La sesión ha expirado."
						}),
						{
							status: 401,
							headers: {
								"Content-Type":
									"application/json",
								"Set-Cookie":
									"japy_session=; " +
									"HttpOnly; " +
									(url.protocol === "https:" ? "Secure; " : "") +
									"SameSite=Lax; " +
									"Path=/; " +
									"Max-Age=0"
							}
						}
					);
				}

				return Response.json({
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
			} catch (error) {
				console.error(error);

				return Response.json(
					{
						success: false,
						message:
							"Error interno al comprobar la sesión."
					},
					{ status: 500 }
				);
			}
		}

		// =========================
		// OBTENER EVENTOS
		// =========================

		if (
			url.pathname === "/api/events" &&
			request.method === "GET"
		) {
			try {
				const cookieHeader =
					request.headers.get("Cookie");

				if (!cookieHeader) {
					return Response.json(
						{
							success: false,
							message: "No hay una sesión activa."
						},
						{ status: 401 }
					);
				}

				const cookies = cookieHeader
					.split(";")
					.map((cookie) => cookie.trim());

				const sessionCookie =
					cookies.find((cookie) =>
						cookie.startsWith("japy_session=")
					);

				if (!sessionCookie) {
					return Response.json(
						{
							success: false,
							message: "No hay una sesión activa."
						},
						{ status: 401 }
					);
				}

				const sessionId =
					sessionCookie.substring(
						"japy_session=".length
					);

				const session =
					await env.japy_db
						.prepare(
							`
							SELECT user_id, expires_at
							FROM sessions
							WHERE id = ?
							`
						)
						.bind(sessionId)
						.first();

				if (!session) {
					return Response.json(
						{
							success: false,
							message: "Sesión inválida."
						},
						{ status: 401 }
					);
				}

				if (
					new Date(session.expires_at) <=
					new Date()
				) {
					await env.japy_db
						.prepare(
							"DELETE FROM sessions WHERE id = ?"
						)
						.bind(sessionId)
						.run();

					return Response.json(
						{
							success: false,
							message: "La sesión ha expirado."
						},
						{ status: 401 }
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
						.bind(session.user_id)
						.all();

				return Response.json({
					success: true,
					events: result.results
				});
			} catch (error) {
				console.error(error);

				return Response.json(
					{
						success: false,
						message:
							"Error interno al obtener los eventos."
					},
					{ status: 500 }
				);
			}
		}

		// =========================
		// CREAR EVENTO
		// =========================

		if (
			url.pathname === "/api/events" &&
			request.method === "POST"
		) {
			try {
				const cookieHeader =
					request.headers.get("Cookie");

				if (!cookieHeader) {
					return Response.json(
						{
							success: false,
							message: "No hay una sesión activa."
						},
						{ status: 401 }
					);
				}

				const cookies = cookieHeader
					.split(";")
					.map((cookie) => cookie.trim());

				const sessionCookie =
					cookies.find((cookie) =>
						cookie.startsWith("japy_session=")
					);

				if (!sessionCookie) {
					return Response.json(
						{
							success: false,
							message: "No hay una sesión activa."
						},
						{ status: 401 }
					);
				}

				const sessionId =
					sessionCookie.substring(
						"japy_session=".length
					);

				const session =
					await env.japy_db
						.prepare(
							`
							SELECT user_id, expires_at
							FROM sessions
							WHERE id = ?
							`
						)
						.bind(sessionId)
						.first();

				if (!session) {
					return Response.json(
						{
							success: false,
							message: "Sesión inválida."
						},
						{ status: 401 }
					);
				}

				if (
					new Date(session.expires_at) <=
					new Date()
				) {
					await env.japy_db
						.prepare(
							"DELETE FROM sessions WHERE id = ?"
						)
						.bind(sessionId)
						.run();

					return Response.json(
						{
							success: false,
							message: "La sesión ha expirado."
						},
						{ status: 401 }
					);
				}

				const body = await request.json();

				const title =
					typeof body.title === "string"
						? body.title.trim()
						: "";

				const date =
					typeof body.date === "string"
						? body.date.trim()
						: "";

				const time =
					typeof body.time === "string"
						? body.time.trim()
						: null;

				if (!title || !date) {
					return Response.json(
						{
							success: false,
							message:
								"El título y la fecha son obligatorios."
						},
						{ status: 400 }
					);
				}

				// =========================
				// VALIDAR FECHA
				// =========================

				if (
					!/^\d{4}-\d{2}-\d{2}$/.test(date)
				) {
					return Response.json(
						{
							success: false,
							message:
								"La fecha debe tener el formato YYYY-MM-DD."
						},
						{ status: 400 }
					);
				}

				// =========================
				// VALIDAR HORA
				// =========================

				if (
					time &&
					!/^\d{2}:\d{2}$/.test(time)
				) {
					return Response.json(
						{
							success: false,
							message:
								"La hora debe tener el formato HH:mm."
						},
						{ status: 400 }
					);
				}

				const eventId =
					crypto.randomUUID();

				const createdAt =
					new Date().toISOString();

				await env.japy_db
					.prepare(
						`
						INSERT INTO events
						(id, user_id, title, date, time, created_at)
						VALUES (?, ?, ?, ?, ?, ?)
						`
					)
					.bind(
						eventId,
						session.user_id,
						title,
						date,
						time,
						createdAt
					)
					.run();

				return Response.json(
					{
						success: true,
						message:
							"Evento creado correctamente.",
						event: {
							id: eventId,
							title: title,
							date: date,
							time: time,
							created_at: createdAt
						}
					},
					{ status: 201 }
				);
			} catch (error) {
				console.error(error);

				return Response.json(
					{
						success: false,
						message:
							"Error interno al crear el evento."
					},
					{ status: 500 }
				);
			}
		}

		// =========================
		// RUTA PRINCIPAL
		// =========================

		return new Response(
			"JAPY Web funcionando."
		);
	},
};