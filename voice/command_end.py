class CommandEndDetector:


    def __init__(self):

        self.end_words = [

            "ya",
            "listo",
            "terminé",
            "terminado",
            "hecho",
            "eso"

        ]


    def clean(self, text):

        if not text:

            return None


        words = text.lower().split()


        for word in self.end_words:

            if word in words:

                words.remove(
                    word
                )

                return " ".join(
                    words
                )


        return text