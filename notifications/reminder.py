from datetime import datetime
from core.module import Module


class ReminderModule(Module):

    def __init__(self, events):

        super().__init__("Recordatorios")

        self.events = events


    def update(self):

        self.check()


    def check(self):

        print("Revisando eventos...")

        now = datetime.now()

        found = False

        for event in self.events:

            if event.status != "Activo":
                continue

            if event.datetime > now:

                print(
                    f"Recordatorio: {event.title} "
                    f"el {event.date} a las {event.time}"
                )

                found = True


        if not found:

            print("No hay recordatorios pendientes.")


    def next_run(self):

        """
        Devuelve cuándo necesita revisarse nuevamente.
        """

        future_events = []

        for event in self.events:

            if event.status == "Activo":

                if event.datetime > datetime.now():

                    future_events.append(event.datetime)


        if future_events:

            return min(future_events)


        return None