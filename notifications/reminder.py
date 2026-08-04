from datetime import datetime

from core.module import Module
from notifications.manager import NotificationManager



class ReminderModule(Module):


    def __init__(self, events):

        super().__init__("Recordatorios")

        self.events = events

        self.notifier = NotificationManager()

        self.sent_reminders = []



    def update(self):

        self.check()



    def check(self):

        print("Revisando eventos...")

        now = datetime.now()

        found = False


        for event in self.events:


            if event.status != "Activo":

                continue



            for reminder_time in event.get_reminder_times():


                reminder_id = (
                    event.title,
                    reminder_time
                )


                if reminder_id in self.sent_reminders:

                    continue



                if reminder_time <= now:


                    self.notifier.send(
                        "Recordatorio",
                        (
                            f"{event.title} "
                            f"comienza a las "
                            f"{event.time}"
                        )
                    )


                    self.sent_reminders.append(
                        reminder_id
                    )


                    found = True



        if not found:

            print(
                "No hay recordatorios pendientes."
            )



    def next_run(self):

        next_times = []


        for event in self.events:


            if event.status != "Activo":

                continue



            for reminder_time in event.get_reminder_times():


                if reminder_time > datetime.now():

                    next_times.append(
                        reminder_time
                    )



        if next_times:

            return min(next_times)


        return None