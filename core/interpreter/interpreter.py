from core.interpreter.intent import Intent

from core.interpreter.rules import (
    SHOW_EVENTS,
    SHOW_STATUS,
    CREATE_EVENT,
    CANCEL_EVENT,
    GREETINGS
)

from core.interpreter.extractor import EventExtractor


class Interpreter:


    def __init__(self):

        self.extractor = EventExtractor()


    def process(self, text):

        if not text:

            return None


        command = text.lower()


        # Cancelar eventos

        for word in CANCEL_EVENT:

            if word in command:

                data = self.extractor.extract(
                    text
                )

                return Intent(
                    "cancelar_evento",
                    data
                )


        # Crear eventos

        for word in CREATE_EVENT:

            if word in command:

                data = self.extractor.extract(
                    text
                )

                return Intent(
                    "crear_evento",
                    data
                )


        # Mostrar eventos

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


        # Saludos

        for word in GREETINGS:

            if word in command:

                return Intent(
                    "saludo"
                )


        return Intent(
            "desconocido",
            {
                "texto": text
            }
        )