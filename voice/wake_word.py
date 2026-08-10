class WakeWordDetector:


def __init__(self):

    self.wake_words = [

        "japy",
        "japi",
        "yapi",

        "hapy",
        "happy",
        "abby",
        "aby",
        "abi",
        "habby",
        "yabby",

        "papi",
        "dapi",
        "api"
    ]


    self.wake_phrases = [

        "ya vi"

    ]


def detect(self, text):

    if not text:

        return None


    command = text.lower()


    # =========================
    # WAKE PHRASES
    # =========================

    for phrase in self.wake_phrases:

        if phrase in command:

            command = command.replace(
                phrase,
                ""
            )

            return command.strip()


    # =========================
    # WAKE WORDS
    # =========================

    words = command.split()

    detected = False

    cleaned_words = []


    for word in words:

        if word in self.wake_words:

            detected = True

            continue


        cleaned_words.append(
            word
        )


    if not detected:

        return None


    return " ".join(
        cleaned_words
    )

