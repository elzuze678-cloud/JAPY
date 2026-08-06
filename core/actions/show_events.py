class ShowEventsAction:


    def __init__(self, engine):

        self.engine = engine



    def execute(self, data):

        for module in self.engine.manager.modules:

            if module.name == "Agenda":

                events = module.events


                if not events:

                    return (
                        "No tienes eventos registrados."
                    )


                result = (
                    "Tus eventos son:\n"
                )


                for event in events:

                    result += (
                        f"- {event.title} | "
                        f"{event.date} "
                        f"{event.time}\n"
                    )


                return result



        return (
            "No encuentro el módulo de agenda."
        )