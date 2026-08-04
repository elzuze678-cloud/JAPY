from voice.responses import JapyResponses

from core.actions.show_events import ShowEventsAction
from core.actions.system_status import SystemStatusAction



class CommandProcessor:


    def __init__(self, engine):

        self.engine = engine

        self.responses = JapyResponses()


        self.actions = {

            "show_events": ShowEventsAction(
                engine
            ),

            "system_status": SystemStatusAction(
                engine
            )

        }



    def process(self, text):

        if not text:

            return None



        command = text.lower()



        if "hola" in command:

            return self.responses.hello()



        if "estado" in command:

            return self.actions[
                "system_status"
            ].execute()



        if "eventos" in command:

            return self.actions[
                "show_events"
            ].execute()



        return self.responses.unknown()