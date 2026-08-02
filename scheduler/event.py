class Event:

    def __init__(self, title, date, time):
        self.title = title
        self.date = date
        self.time = time

    def __str__(self):
        return f"Evento: {self.title} | Fecha: {self.date} | Hora: {self.time}"