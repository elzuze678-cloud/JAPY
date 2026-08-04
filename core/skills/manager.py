class SkillManager:


    def __init__(self):

        self.skills = []



    def add(self, skill):

        self.skills.append(
            skill
        )



    def execute(self, intent):

        for skill in self.skills:


            if skill.can_handle(intent):

                return skill.execute(
                    intent
                )


        return (
            "No sé cómo hacer eso todavía."
        )