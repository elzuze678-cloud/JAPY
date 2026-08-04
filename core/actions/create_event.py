class CreateEventAction:


    def __init__(self, engine):

        self.engine = engine



    def execute(self, title, date, time, reminders=None):

        for module in self.engine.manager.modules:

            if module.name == "Agenda":

                module.create_event(
                    title,
                    date,
                    time,
                    reminders
                )


                return (
                    f"Evento '{title}' "
                    "creado correctamente."
                )



        return (
            "No encuentro el módulo de agenda."
        )
    