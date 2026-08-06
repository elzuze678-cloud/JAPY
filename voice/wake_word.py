class WakeWordDetector:


    def __init__(self):

        self.wake_words = [

            # JAPY original
            "japy",
            "japi",
            "yapi",

            # Errores comunes de reconocimiento
            "hapy",
            "happy",
            "abby",
            "aby",
            "abi",
            "habby",
            "yabby",

            # Otras posibles confusiones
            "papi",
            "dapi",
            "api"

        ]



    def detect(self, text):

        if not text:

            return None



        command = text.lower()


        words = command.split()



        for word in self.wake_words:


            if word in words:


                words.remove(word)


                return " ".join(words)



        return None