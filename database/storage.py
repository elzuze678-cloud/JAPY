import json
import os

from scheduler.event import Event


class Storage:

    def __init__(self, filename="database/events.json"):
        self.filename = filename


    def save_events(self, events):

        data = []

        for event in events:
            data.append({
                "title": event.title,
                "date": event.date,
                "time": event.time,
                "status": event.status
            })

        with open(self.filename, "w", encoding="utf-8") as file:
            json.dump(
                data,
                file,
                indent=4,
                ensure_ascii=False
            )

        print("Eventos guardados.")


    def load_events(self):

        if not os.path.exists(self.filename):
            return []

        with open(self.filename, "r", encoding="utf-8") as file:
            data = json.load(file)

        events = []

        for item in data:

            event = Event(
                item["title"],
                item["date"],
                item["time"]
            )

            event.status = item.get(
                "status",
                "Activo"
            )

            events.append(event)

        return events