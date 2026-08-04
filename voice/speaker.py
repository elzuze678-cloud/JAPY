import pyttsx3



class Speaker:


    def __init__(self):

        self.engine = pyttsx3.init()


        self.engine.setProperty(
            "rate",
            170
        )



    def say(self, text):

        if not text:

            return


        print(
            "🔊 JAPY:",
            text
        )


        self.engine.say(
            text
        )


        self.engine.runAndWait()