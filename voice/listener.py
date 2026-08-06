import speech_recognition as sr



class Listener:


    def __init__(self):

        self.active = False

        self.recognizer = sr.Recognizer()



    def start(self):

        self.active = True

        print("🎙️ Escucha activada.")



    def stop(self):

        self.active = False

        print("🎙️ Escucha detenida.")



    def listen(self):

        if not self.active:

            print(
                "La escucha está desactivada."
            )

            return None



        with sr.Microphone() as source:

            print(
                "👂 Escuchando..."
            )


            audio = self.recognizer.listen(
                source
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


            return text



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