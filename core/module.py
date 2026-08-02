class Module:

    def __init__(self, name):
        self.name = name
        self.enabled = True


    def start(self):
        self.enabled = True
        print(f"{self.name} iniciado")


    def stop(self):
        self.enabled = False
        print(f"{self.name} detenido")


    def update(self):
        pass


    def __str__(self):

        if self.enabled:
            status = "Activo"
        else:
            status = "Detenido"

        return f"Module: {self.name} | Estado: {status}"