from datetime import datetime


class Module:

    def __init__(self, name):

        self.name = name
        self.enabled = True

    def start(self):

        print(f"{self.name} iniciado")

    def stop(self):

        print(f"{self.name} detenido")

    def update(self):
        """
        Método que será sobrescrito por cada módulo.
        """
        pass

    def should_run(self):
        """
        Indica si el Scheduler debe ejecutar este módulo.
        """
        return self.enabled

    def next_run(self):
        """
        Devuelve la próxima fecha y hora en la que este
        módulo necesita ejecutarse.

        Cada módulo podrá sobrescribir este método.
        """
        return datetime.now()

    def __str__(self):

        estado = "Activo" if self.enabled else "Inactivo"

        return f"Module: {self.name} | Estado: {estado}"