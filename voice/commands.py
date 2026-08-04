from voice.responses import JapyResponses

from core.actions.show_events import ShowEventsAction
from core.actions.system_status import SystemStatusAction



class CommandProcessor:


    def __init__(self, engine):

        self.engine = engine

        self.responses = JapyResponses()


        self.actions = {

            "mostrar_eventos":
                ShowEventsAction(engine),


            "estado":
                SystemStatusAction(engine)

        }



    def execute(self, intent):


        if not intent:

            return None



        action = intent.action



        if action in self.actions:


            return self.actions[
                action
            ].execute()



        return self.responses.unknown()