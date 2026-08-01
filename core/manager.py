class ModuleManager:

    def __init__(self):
        self.modules = []

    def add(self, module):
        self.modules.append(module)
        print(f"{module.name} agregado")

    def list_modules(self):
        for module in self.modules:
            print(module)

    def start_all(self):
        print("Iniciando módulos...")

        for module in self.modules:
            module.start()

    def stop_all(self):
        print("Deteniendo módulos...")

        for module in self.modules:
            module.stop()

    def get_status(self):
        print("Estado de Japy:")

        for module in self.modules:
            print(module)