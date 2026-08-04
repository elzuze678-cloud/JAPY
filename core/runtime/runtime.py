from voice.engine import VoiceEngine



class JapyRuntime:


    def __init__(self, engine):

        self.engine = engine

        self.voice = VoiceEngine(
            engine
        )

        self.running = False



    def start(self):

        print(
            "🚀 Iniciando JAPY Runtime..."
        )


        self.running = True


        self.engine.start()


        self.voice.start()


        print(
            "👂 JAPY esperando comandos..."
        )



    def run(self):

        self.start()


        try:

            while self.running:

                self.voice.listen_once()


        except KeyboardInterrupt:

            self.stop()



    def listen_once(self):

        if not self.running:

            return


        self.voice.listen_once()



    def stop(self):

        print(
            "🛑 Cerrando JAPY Runtime..."
        )


        self.running = False


        self.voice.stop()


        self.engine.stop()