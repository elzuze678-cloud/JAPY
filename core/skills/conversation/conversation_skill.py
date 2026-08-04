from core.skills.skill import Skill

from voice.responses import JapyResponses



class ConversationSkill(Skill):


    def __init__(self, engine):

        super().__init__(
            "Conversación"
        )


        self.engine = engine

        self.responses = JapyResponses()



    def can_handle(self, intent):

        return intent.action in [

            "saludo"

        ]



    def execute(self, intent):

        if intent.action == "saludo":

            return self.responses.hello()


        return None