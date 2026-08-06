from core.interpreter.extractor import EventExtractor


extractor = EventExtractor()


pruebas = [

    "japy crea evento estudiar matemáticas mañana a las 20:00",

    "papi crea evento entrenar mañana a las 18:00 ya",

    "abby crea evento reunión proyecto 07/08/2026 a las 15:00"

]


for texto in pruebas:

    print("\nEntrada:")
    print(texto)

    print(
        extractor.extract(texto)
    )