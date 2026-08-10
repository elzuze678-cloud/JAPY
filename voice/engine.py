from voice.listener import Listener
from voice.speaker import Speaker

from core.interpreter.interpreter import Interpreter
from core.interpreter.extractor import EventExtractor
from core.interpreter.intent import Intent

class VoiceEngine:

```
def __init__(self, japy):

    self.japy = japy

    self.listener = Listener()

    self.speaker = Speaker()

    self.interpreter = Interpreter()

    self.event_extractor = EventExtractor()

    self.running = False


def start(self):

    print(
        "🎙️ Motor de voz iniciado."
    )

    self.running = True

    self.listener.start()


def listen_once(self):

    if not self.running:

        return


    text = self.listener.listen()

    if not text:

        return


    # =========================
    # EVENTO PENDIENTE
    # =========================

    if self.japy.pending_event:

        response = self.complete_pending_event(
            text
        )

        if response:

            self.speaker.say(
                response
            )

            return


    # =========================
    # INTERPRETACIÓN NORMAL
    # =========================

    intent = self.interpreter.process(
        text
    )

    response = self.japy.execute(
        intent
    )

    if response:

        self.speaker.say(
            response
        )


def complete_pending_event(self, text):

    pending = self.japy.pending_event


    # =========================
    # EXTRAER INFORMACIÓN
    # =========================

    data = self.event_extractor.extract(
        text
    )


    # =========================
    # COMPLETAR TÍTULO
    # =========================

    if not pending.get("titulo"):

        if data.get("titulo"):

            pending["titulo"] = data["titulo"]


    # =========================
    # COMPLETAR FECHA
    # =========================

    if not pending.get("fecha"):

        if data.get("fecha"):

            pending["fecha"] = data["fecha"]


    # =========================
    # COMPLETAR HORA
    # =========================

    if not pending.get("hora"):

        if data.get("hora"):

            pending["hora"] = data["hora"]


    # =========================
    # COMPROBAR DATOS
    # =========================

    title = pending.get(
        "titulo"
    )

    date = pending.get(
        "fecha"
    )

    time = pending.get(
        "hora"
    )


    if not title:

        return (
            "¿Qué nombre quieres "
            "ponerle al evento?"
        )


    if not date:

        return (
            "¿Para qué día quieres "
            "programarlo?"
        )


    if not time:

        return (
            "¿A qué hora quieres "
            "programarlo?"
        )


    # =========================
    # CREAR INTENCIÓN
    # =========================

    intent = Intent(
        "crear_evento",
        {
            "titulo": title,
            "fecha": date,
            "hora": time
        }
    )


    return self.japy.execute(
        intent
    )


def stop(self):

    self.running = False

    self.listener.stop()

    print(
        "🎙️ Motor de voz detenido."
    )
```
