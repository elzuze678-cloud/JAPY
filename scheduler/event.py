class Event:

    def __init__(self, title, date, time):
        self.title = title
        self.date = date
        self.time = time
        self.status = "Activo"

    def complete(self):
        self.status = "Completado"

    def cancel(self):
        self.status = "Cancelado"

    def __str__(self):
        return (
            f"Evento: {self.title} | "
            f"Fecha: {self.date} | "
            f"Hora: {self.time} | "
            f"Estado: {self.status}"
        )