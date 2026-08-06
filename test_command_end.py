from voice.command_end import CommandEndDetector


detector = CommandEndDetector()


tests = [

    "muéstrame mis eventos ya",

    "crea evento estudiar mañana listo",

    "hola"

]


for test in tests:

    print(
        test,
        "->",
        detector.clean(test)
    )