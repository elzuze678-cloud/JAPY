class WakeWordDetector:


    def __init__(self):

        self.wake_words = [
            "japy",
            "hapy",
            "japi",
            "papi",
            "yapi"
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