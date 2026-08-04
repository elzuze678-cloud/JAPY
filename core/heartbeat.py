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

            sleep_time = (
                self.engine.sleep_manager.get_sleep_time()
            )

            print(
                f"Heartbeat descansando {sleep_time} segundos."
            )

            time.sleep(sleep_time)


    def tick(self):

        self.engine.tick()


    def stop(self):

        print("Heartbeat detenido.")

        self.running = False