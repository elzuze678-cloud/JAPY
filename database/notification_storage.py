import json
import os



class NotificationStorage:


    def __init__(
        self,
        filename="database/notifications.json"
    ):

        self.filename = filename



    def save_notifications(self, notifications):

        with open(
            self.filename,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                notifications,
                file,
                indent=4,
                ensure_ascii=False
            )



    def load_notifications(self):

        if not os.path.exists(
            self.filename
        ):

            return []


        with open(
            self.filename,
            "r",
            encoding="utf-8"
        ) as file:

            return json.load(file)