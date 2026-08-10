class CommandCleaner:


    def __init__(self):

        self.fillers = [

            "eh",
            "em",
            "mmm",
            "mm",
            "este",
            "bueno",
            "oye"

        ]


    def clean(self, text):

        if not text:

            return None


        command = text.lower()

        words = command.split()

        cleaned = []


        for word in words:

            if word in self.fillers:

                continue


            cleaned.append(
                word
            )


        result = " ".join(
            cleaned
        )


        return result.strip()