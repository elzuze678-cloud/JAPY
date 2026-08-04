from core.interpreter.intent import Intent



class Interpreter:


    def process(self, text):

        if not text:

            return None


        command = text.lower()



        if "evento" in command:

            return Intent(
                "mostrar_eventos"
            )



        if "estado" in command:

            return Intent(
                "estado"
            )



        if "hola" in command:

            return Intent(
                "saludo"
            )



        return Intent(
            "desconocido",
            {
                "texto": text
            }
        )