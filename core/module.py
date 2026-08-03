# Este es el primer archivo del cerebro de "JAPY"


class Module:

    def __init__(self, name):

        self.name = name
        self.enabled = True

        # Tiempo entre actualizaciones (en segundos)
        # None = este módulo no usa temporizador
        self.interval = None

        # Momento de la última actualización
        self.last_update = None

    def start(self):
        self.enabled = True
        print(f"{self.name} iniciado")

    def update(self):
        """
        Método que será sobrescrito por los módulos
        que necesiten actualizarse.
        """
        pass

    def stop(self):
        self.enabled = False
        print(f"{self.name} detenido")

    def __str__(self):

        if self.enabled:
            status = "Activo"
        else:
            status = "Detenido"

        return f"Module: {self.name} | Estado: {status}"