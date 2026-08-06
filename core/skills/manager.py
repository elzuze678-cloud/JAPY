class SkillManager:

    def __init__(self):

        self.skills = []

    def add(self, skill):

        self.skills.append(
            skill
        )

    def execute(self, intent):

        print("\n========== DEBUG SkillManager ==========")

        print(f"Intent recibida: {intent}")

        for skill in self.skills:

            print(f"Probando Skill: {skill.name}")

            if skill.can_handle(intent):

                print(f"✅ {skill.name} aceptó la intención.")

                response = skill.execute(
                    intent
                )

                print(f"Respuesta: {response}")

                print("========================================\n")

                return response

            else:

                print(f"❌ {skill.name} no puede manejar esta intención.")

        print("⚠️ Ninguna Skill aceptó la intención.")

        print("========================================\n")

        return (
            "No sé cómo hacer eso todavía."
        )