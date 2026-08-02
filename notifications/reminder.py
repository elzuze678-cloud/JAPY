from datetime import datetime


class ReminderModule:

    def __init__(self, events):
        self.events = events


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