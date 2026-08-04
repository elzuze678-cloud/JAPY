from voice.responses import JapyResponses



class SystemStatusAction:


    def __init__(self, engine):

        self.engine = engine

        self.responses = JapyResponses()



    def execute(self, data=None):

        return self.responses.state(
            self.engine.state
        )