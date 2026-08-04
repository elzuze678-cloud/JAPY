from datetime import datetime
from core.state import JapyState


class SleepManager:

    def __init__(self, engine):

        self.engine = engine



    def can_sleep(self):

        next_event = (
            self.engine.scheduler.get_next_event()
        )

        return next_event is not None



    def get_sleep_time(self):

        next_event = (
            self.engine.scheduler.get_next_event()
        )


        if next_event is None:

            return 60



        now = datetime.now()


        seconds = (
            next_event - now
        ).total_seconds()



        if seconds < 1:

            return 1



        return int(seconds)



    def sleep(self):

        if self.can_sleep():

            self.engine.state.set_state(
                JapyState.RESTING
            )


        else:

            self.engine.state.set_state(
                JapyState.SLEEPING
            )