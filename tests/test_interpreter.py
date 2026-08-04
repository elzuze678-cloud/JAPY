import sys
import os


sys.path.append(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)


from core.interpreter.interpreter import Interpreter



def test_interpreter():


    interpreter = Interpreter()


    pruebas = {

        "Japy dime mi agenda":
            "mostrar_eventos",

        "Qué eventos tengo":
            "mostrar_eventos",

        "Cómo estás Japy":
            "estado"

    }



    for texto, esperado in pruebas.items():


        intent = interpreter.process(
            texto
        )


        assert (
            intent.action == esperado
        ), (
            f"Error en: {texto}"
        )



    print(
        "✅ Pruebas del interpreter correctas"
    )



if __name__ == "__main__":

    test_interpreter()