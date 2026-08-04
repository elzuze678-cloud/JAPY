class Intent:


    def __init__(self, action, data=None):

        self.action = action

        self.data = data or {}



    def __str__(self):

        return (
            f"Intención: {self.action} "
            f"| Datos: {self.data}"
        )