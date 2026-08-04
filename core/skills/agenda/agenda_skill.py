from core.skills.skill import Skill

from core.actions.create_event import CreateEventAction
from core.actions.show_events import ShowEventsAction



class AgendaSkill(Skill):


    def __init__(self, engine):

        super().__init__(
            "Agenda"
        )


        self.engine = engine


        self.actions = {


            "crear_evento":

                CreateEventAction(engine),


            "mostrar_eventos":

                ShowEventsAction(engine)

        }



    def can_handle(self, intent):

        return intent.action in self.actions



    def execute(self, intent):

        action = self.actions.get(
            intent.action
        )


        if action:

            return action.execute(
                intent.data
            )


        return None