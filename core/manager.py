class ModuleManager:

    def __init__(self):
        self.modules = []

    def add(self, module):
        self.modules.append(module)
        print(f"{module.name} agregado")

    def list_modules(self):
        for module in self.modules:
            print(module)