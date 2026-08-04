from datetime import datetime

from database.notification_storage import NotificationStorage



class NotificationManager:


    def __init__(self):

        self.storage = NotificationStorage()

        self.history = (
            self.storage.load_notifications()
        )



    def send(
        self,
        title,
        message,
        priority="normal"
    ):


        notification = {

            "title": title,

            "message": message,

            "priority": priority,

            "date": (
                datetime.now()
                .strftime("%d/%m/%Y %H:%M")
            )

        }


        self.history.append(
            notification
        )


        self.storage.save_notifications(
            self.history
        )


        print()

        print("🔔 JAPY")

        print(
            f"{title}: {message}"
        )



    def get_history(self):

        return self.history