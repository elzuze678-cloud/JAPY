import speech_recognition as sr

from voice.wake_word import WakeWordDetector
from voice.command_end import CommandEndDetector
from voice.command_cleaner import CommandCleaner

class Listener:

def __init__(self):

    self.active = False
    self.conversation_active = False

    self.recognizer = sr.Recognizer()

    self.wake_word = WakeWordDetector()
    self.command_end = CommandEndDetector()
    self.cleaner = CommandCleaner()


def start(self):

    self.active = True

    print(
        "🎙️ Escucha activada."
    )


def stop(self):

    self.active = False
    self.conversation_active = False

    print(
        "🎙️ Escucha detenida."
    )


def start_conversation(self):

    self.conversation_active = True

    print(
        "🗣️ Modo conversación activado."
    )


def end_conversation(self):

    self.conversation_active = False

    print(
        "🛑 Modo conversación finalizado."
    )


def listen(self):

    if not self.active:

        print(
            "La escucha está desactivada."
        )

        return None


    try:

        with sr.Microphone() as source:

            print(
                "🔧 Ajustando micrófono..."
            )

            self.recognizer.adjust_for_ambient_noise(
                source,
                duration=0.5
            )

            print(
                "👂 Escuchando..."
            )

            audio = self.recognizer.listen(
                source,
                timeout=5,
                phrase_time_limit=10
            )


        try:

            text = self.recognizer.recognize_google(
                audio,
                language="es-ES"
            )


        except sr.UnknownValueError:

            print(
                "No entendí lo que dijiste."
            )

            return None


        except sr.RequestError:

            print(
                "No se pudo conectar "
                "con el reconocimiento de voz."
            )

            return None


        print(
            f"Usuario: {text}"
        )


        # ==================================
        # MODO CONVERSACIÓN
        # ==================================

        if self.conversation_active:

            command = self.command_end.clean(
                text
            )

            if not command:
                return None

            command = self.cleaner.clean(
                command
            )

            if not command:
                return None

            print(
                f"🗣️ Respuesta: {command}"
            )

            return command


        # ==================================
        # WAKE WORD
        # ==================================

        command = self.wake_word.detect(
            text
        )


        if command is None:

            print(
                "JAPY no fue llamado."
            )

            return None


        # ==================================
        # FINAL DEL COMANDO
        # ==================================

        command = self.command_end.clean(
            command
        )


        if not command:

            return None


        # ==================================
        # LIMPIEZA
        # ==================================

        command = self.cleaner.clean(
            command
        )


        if not command:

            return None


        print(
            f"🧹 Comando limpio: {command}"
        )


        return command


    except sr.WaitTimeoutError:

        print(
            "No detecté ningún comando."
        )

        return None


    except Exception as error:

        print(
            f"❌ Error de escucha: {error}"
        )

        return None

