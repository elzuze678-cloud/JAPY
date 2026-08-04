from voice.responses import JapyResponses

from core.actions.show_events import ShowEventsAction
from core.actions.create_event import CreateEventAction
from core.actions.system_status import SystemStatusAction



class CommandProcessor:


    def __init__(self, engine):

        self.engine = engine

        self.responses = JapyResponses()


        self.actions = {


            "mostrar_eventos":

                ShowEventsAction(engine),



            "crear_evento":

                CreateEventAction(engine),



            "estado":

                SystemStatusAction(engine)

        }



    def execute(self, intent):


        if not intent:

            return None



        action = self.actions.get(
            intent.action
        )


        if action:

            return action.execute(
                intent.data
            )



        return self.responses.unknown()