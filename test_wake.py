from voice.wake_word import WakeWordDetector


detector = WakeWordDetector()


tests = [

    "japy muéstrame mis eventos",

    "papi muéstrame mis eventos",

    "abby muéstrame mis eventos",

    "ya vi muéstrame mis eventos",

    "ya vi eh cancela estudiar matemáticas",

    "hola muéstrame mis eventos"

]


for text in tests:

    result = detector.detect(
        text
    )

    print(
        f"{text} -> {result}"
    )