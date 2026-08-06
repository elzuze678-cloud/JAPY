import speech_recognition as sr

from voice.wake_word import WakeWordDetector
from voice.command_end import CommandEndDetector



class Listener:


    def __init__(self):

        self.active = False


        self.recognizer = sr.Recognizer()


        self.wake_word = WakeWordDetector()


        self.command_end = CommandEndDetector()



    def start(self):

        self.active = True


        print(
            "🎙️ Escucha activada."
        )



    def stop(self):

        self.active = False


        print(
            "🎙️ Escucha detenida."
        )



    def listen(self):

        if not self.active:

            print(
                "La escucha está desactivada."
            )

            return None



        with sr.Microphone() as source:


            print(
                "🔧 Ajustando micrófono..."
            )


            self.recognizer.adjust_for_ambient_noise(
                source,
                duration=1
            )


            print(
                "👂 Escuchando..."
            )


            audio = self.recognizer.listen(
                source,
                timeout=None,
                phrase_time_limit=10
            )



        try:


            text = self.recognizer.recognize_google(
                audio,
                language="es-ES"
            )


            print(
                "Usuario:",
                text
            )



            command = self.wake_word.detect(
                text
            )



            if not command:


                print(
                    "JAPY no fue llamado."
                )


                return None



            command = self.command_end.clean(
                command
            )


            if command:

                return command



            return None



        except sr.UnknownValueError:


            print(
                "No entendí lo que dijiste."
            )


            return None



        except Exception as e:


            print(
                "Error de voz:",
                e
            )


            return None