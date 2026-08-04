class Listener:


    def __init__(self):

        self.active = False



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


        print(
            "Usuario:",
            end=" "
        )


        command = input()


        return command