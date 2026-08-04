from voice.listener import Listener
from voice.speaker import Speaker

from core.interpreter.interpreter import Interpreter



class VoiceEngine:


    def __init__(self, japy):

        self.japy = japy


        self.listener = Listener()


        self.speaker = Speaker()


        self.interpreter = Interpreter()


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



    def stop(self):

        self.running = False


        self.listener.stop()


        print(
            "🎙️ Motor de voz detenido."
        )