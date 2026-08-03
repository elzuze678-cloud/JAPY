from core.engine import JapyEngine
from scheduler.calendar import CalendarModule
from notifications.reminder import ReminderModule


def create_japy():

    japy = JapyEngine()

    agenda = CalendarModule()

    recordatorios = ReminderModule(
        agenda.events
    )

    japy.add_module(agenda)
    japy.add_module(recordatorios)

    return japy