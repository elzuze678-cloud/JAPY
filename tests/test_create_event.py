import sys
import os


sys.path.append(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)


from core.engine import JapyEngine
from scheduler.calendar import CalendarModule

from core.interpreter.interpreter import Interpreter

from voice.commands import CommandProcessor



def test_create_event_action():


    japy = JapyEngine()


    agenda = CalendarModule()


    japy.add_module(
        agenda
    )


    interpreter = Interpreter()


    commands = CommandProcessor(
        japy
    )


    intent = interpreter.process(
        "Japy crea evento Prueba 30/08/2026 15:00"
    )


    response = commands.execute(
        intent
    )


    assert (
        "creado correctamente"
        in response
    )


    print(
        "✅ Prueba de creación de eventos correcta"
    )



if __name__ == "__main__":

    test_create_event_action()