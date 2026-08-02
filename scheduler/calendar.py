from core.module import Module
from database.storage import Storage
from scheduler.event import Event


class CalendarModule(Module):

    def __init__(self):
        super().__init__("Agenda")

        self.storage = Storage()

        self.events = self.storage.load_events()


    def create_event(self, title, date, time):

        event = Event(title, date, time)

        self.events.append(event)

        self.storage.save_events(self.events)

        print(f"Evento '{event.title}' agregado.")


    def list_events(self):

        if not self.events:
            print("No hay eventos registrados.")
            return

        print("Eventos registrados:")

        for event in self.events:
            print(event)


    def find_event(self, title):

        for event in self.events:

            if event.title.lower() == title.lower():
                return event

        return None


    def cancel_event(self, title):

        event = self.find_event(title)

        if event:

            event.cancel()

            self.storage.save_events(self.events)

            print(f"Evento '{title}' cancelado.")

        else:
            print("Evento no encontrado.")


    def complete_event(self, title):

        event = self.find_event(title)

        if event:

            event.complete()

            self.storage.save_events(self.events)

            print(f"Evento '{title}' completado.")

        else:
            print("Evento no encontrado.")