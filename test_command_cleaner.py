from voice.command_cleaner import CommandCleaner


cleaner = CommandCleaner()


tests = [

    "yapi eh cancela estudiar matemáticas",

    "japy mmm crea evento estudiar mañana",

    "oye japy bueno muestra mis eventos",

    "cancela estudiar matemáticas"

]


for text in tests:

    result = cleaner.clean(
        text
    )


    print(
        f"{text} -> {result}"
    )