class CreateEventAction:

    def __init__(self, engine):

        self.engine = engine


    def execute(self, data):

        title = data.get(
            "titulo"
        )

        date = data.get(
            "fecha"
        )

        time = data.get(
            "hora"
        )


        # =========================
        # DATOS INCOMPLETOS
        # =========================

        if not title or not date or not time:

            self.engine.pending_event = {

                "titulo": title,

                "fecha": date,

                "hora": time

            }


            if not title:

                return (
                    "¿Qué nombre quieres ponerle "
                    "al evento?"
                )


            if not date:

                return (
                    "¿Para qué día quieres "
                    "programar el evento?"
                )


            if not time:

                return (
                    "¿A qué hora quieres "
                    "programarlo?"
                )


        # =========================
        # CREAR EVENTO
        # =========================

        for module in self.engine.manager.modules:

            if module.name == "Agenda":

                module.create_event(
                    title,
                    date,
                    time,
                    [30]
                )


                self.engine.pending_event = None


                return (
                    f"Evento '{title}' "
                    f"creado correctamente."
                )


        return (
            "No encontré el módulo "
            "de agenda."
        )