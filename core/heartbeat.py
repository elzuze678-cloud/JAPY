import time


class Heartbeat:

    def __init__(self, engine):

        self.engine = engine
        self.running = False


    def start(self):

        print("Heartbeat iniciado.")

        self.running = True


        while self.running:

            self.tick()

            time.sleep(1)


    def tick(self):

        self.engine.tick()


    def stop(self):

        print("Heartbeat detenido.")

        self.running = False