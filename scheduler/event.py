from datetime import datetime, timedelta


class Event:

    def __init__(
        self,
        title,
        date,
        time,
        reminders=None
    ):

        self.title = title
        self.date = date
        self.time = time

        self.datetime = datetime.strptime(
            f"{date} {time}",
            "%d/%m/%Y %H:%M"
        )

        self.status = "Activo"

        if reminders is None:
            reminders = [30]

        self.reminders = reminders


    def get_reminder_times(self):

        times = []

        for minutes in self.reminders:

            reminder_time = (
                self.datetime -
                timedelta(minutes=minutes)
            )

            times.append(reminder_time)

        return times


    def complete(self):

        self.status = "Completado"


    def cancel(self):

        self.status = "Cancelado"


    def __str__(self):

        return (
            f"Evento: {self.title} | "
            f"Fecha: {self.date} | "
            f"Hora: {self.time} | "
            f"Avisos: {self.reminders} min antes | "
            f"Estado: {self.status}"
        )