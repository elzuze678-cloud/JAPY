from core.interpreter.intent import Intent

from core.interpreter.rules import (
    SHOW_EVENTS,
    SHOW_STATUS,
    CREATE_EVENT
)

from core.interpreter.extractor import EventExtractor



class Interpreter:


    def __init__(self):

        self.extractor = EventExtractor()



    def process(self, text):

        if not text:

            return None


        command = text.lower()



        # Primero crear eventos
        for word in CREATE_EVENT:

            if word in command:

                data = self.extractor.extract(
                    text
                )


                return Intent(
                    "crear_evento",
                    data
                )



        # Después consultar eventos
        for word in SHOW_EVENTS:

            if word in command:

                return Intent(
                    "mostrar_eventos"
                )



        # Estado
        for word in SHOW_STATUS:

            if word in command:

                return Intent(
                    "estado"
                )



        return Intent(
            "desconocido",
            {
                "texto": text
            }
        )