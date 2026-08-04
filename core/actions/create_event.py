from voice.responses import JapyResponses


class CreateEventAction:


    def __init__(self, engine):

        self.engine = engine

        self.responses = JapyResponses()



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


        if not title or not date or not time:

            return (
                "No pude obtener "
                "todos los datos del evento."
            )


        for module in self.engine.manager.modules:

            if module.name == "Agenda":

                module.create_event(
                    title,
                    date,
                    time,
                    [30]
                )


                return (
                    f"Evento '{title}' "
                    "creado correctamente."
                )


        return (
            "No encontré el módulo "
            "de agenda."
        )