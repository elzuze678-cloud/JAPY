from core.interpreter.extractor import EventExtractor


extractor = EventExtractor()


pruebas = [

    "japy crea evento estudiar matemáticas mañana a las 20:00",

    "japy crea evento estudiar física mañana a las 20 horas",

    "japy crea evento entrenar mañana a las 18 horas",

    "japy crea evento reunión proyecto 07/08/2026 a las 15:00",

    "japy crea evento leer hoy a las 8",

]


for texto in pruebas:

    print()
    print("Entrada:")
    print(texto)

    print(
        extractor.extract(texto)
    )