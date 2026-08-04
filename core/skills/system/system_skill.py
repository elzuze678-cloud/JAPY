from core.skills.skill import Skill

from core.actions.system_status import SystemStatusAction



class SystemSkill(Skill):


    def __init__(self, engine):

        super().__init__(
            "Sistema"
        )


        self.engine = engine


        self.actions = {

            "estado":

                SystemStatusAction(engine)

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