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

				const passwordBuffer =
					await crypto.subtle.digest(
						"SHA-256",
						new TextEncoder().encode(password)
					);

				const passwordHash = Array.from(
					new Uint8Array(passwordBuffer)
				)
					.map(
						(byte) =>
							byte.toString(16).padStart(2, "0")
					)
					.join("");

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
		// RUTA PRINCIPAL
		// =========================

		return new Response(
			"JAPY Web funcionando."
		);
	},
};