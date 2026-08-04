from voice.listener import Listener

from core.interpreter.interpreter import Interpreter



class VoiceEngine:


    def __init__(self, japy):

        self.japy = japy

        self.listener = Listener()

        self.interpreter = Interpreter()

        self.running = False



    def start(self):

        print(
            "🎙️ Motor de voz iniciado."
        )

        self.running = True

        self.listener.start()



    def listen_once(self):

        text = self.listener.listen()


        if not text:

            return



        intent = self.interpreter.process(
            text
        )


        response = self.japy.execute(
            intent
        )


        if response:

            print(
                "JAPY:",
                response
            )



    def stop(self):

        self.running = False


        self.listener.stop()


        print(
            "🎙️ Motor de voz detenido."
        )