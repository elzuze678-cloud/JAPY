from core.state import JapyState



class SystemStatusAction:


    def __init__(self, engine):

        self.engine = engine



    def execute(self):

        return (
            f"Estado actual: "
            f"{self.engine.state}"
        )