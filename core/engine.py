from core.manager import ModuleManager


class JapyEngine:

    def __init__(self):
        self.manager = ModuleManager()

    def add_module(self, module):
        self.manager.add(module)

    def start(self):
        print("Iniciando Japy...")

        self.manager.start_all()

        print("Japy listo.")