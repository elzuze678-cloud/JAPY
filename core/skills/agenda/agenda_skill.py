from core.actions.create_event import CreateEventAction
from core.actions.show_events import ShowEventsAction
from core.actions.cancel_event import CancelEventAction


class AgendaSkill:


    def __init__(self, engine):

        self.name = "Agenda"

        self.engine = engine

        self.actions = {

            "crear_evento":
                CreateEventAction(engine),

            "mostrar_eventos":
                ShowEventsAction(engine),

            "cancelar_evento":
                CancelEventAction(engine)

        }


    def can_handle(self, intent):

        return intent.action in self.actions


    def execute(self, intent):

        action = self.actions.get(
            intent.action
        )


        if not action:

            return (
                "No sé cómo realizar "
                "esa acción."
            )


        return action.execute(
            intent.data
        )