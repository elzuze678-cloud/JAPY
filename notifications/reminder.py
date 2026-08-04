from datetime import datetime

from core.module import Module
from notifications.manager import NotificationManager
from database.notification_storage import NotificationStorage



class ReminderModule(Module):


    def __init__(self, events):

        super().__init__("Recordatorios")

        self.events = events

        self.notifier = NotificationManager()

        self.storage = NotificationStorage()

        self.sent_reminders = (
            self.storage.load_notifications()
        )



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


                reminder_id = {

                    "event": event.title,

                    "time": (
                        reminder_time
                        .strftime("%d/%m/%Y %H:%M")
                    )

                }



                if self.already_sent(reminder_id):

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


                    self.storage.save_notifications(
                        self.sent_reminders
                    )


                    found = True



        if not found:

            print(
                "No hay recordatorios pendientes."
            )



    def already_sent(self, reminder_id):


        for reminder in self.sent_reminders:


            if (

                reminder.get("event")
                == reminder_id["event"]

                and

                reminder.get("time")
                == reminder_id["time"]

            ):

                return True



        return False




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