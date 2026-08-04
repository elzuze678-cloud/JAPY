from voice.listener import Listener
from voice.commands import CommandProcessor



class VoiceEngine:


    def __init__(self, japy):

        self.japy = japy

        self.listener = Listener()

        self.commands = CommandProcessor(
            japy
        )

        self.running = False



    def start(self):

        print(
            "🎙️ Motor de voz iniciado."
        )

        self.running = True

        self.listener.start()



    def listen_once(self):

        text = self.listener.listen()


        response = self.commands.process(
            text
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