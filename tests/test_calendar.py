import sys
import os


sys.path.append(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)


from scheduler.calendar import CalendarModule



def test_calendar_create():


    agenda = CalendarModule()


    initial = len(
        agenda.events
    )


    agenda.create_event(
        "Evento prueba",
        "25/08/2026",
        "12:00",
        [30]
    )


    assert len(
        agenda.events
    ) == initial + 1



    print(
        "✅ Prueba de calendario correcta"
    )



if __name__ == "__main__":

    test_calendar_create()