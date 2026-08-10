class CancelEventAction:


    def __init__(self, engine):

        self.engine = engine


    def execute(self, data):

        titulo = data.get(
            "titulo"
        )


        if not titulo:

            return (
                "No me dijiste qué "
                "evento quieres cancelar."
            )


        for module in self.engine.manager.modules:

            if module.name == "Agenda":

                events = module.events


                for event in events:

                    if event.title.lower() == titulo.lower():

                        events.remove(event)

                        module.storage.save_events(
                            events
                        )

                        return (
                            f"Listo, cancelé el evento "
                            f"'{titulo}'."
                        )


                return (
                    f"No encontré el evento "
                    f"'{titulo}'."
                )


        return (
            "No encuentro el módulo "
            "de agenda."
        )