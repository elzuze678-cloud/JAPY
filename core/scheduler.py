from datetime import datetime


class Scheduler:

    def __init__(self, manager):

        self.manager = manager


    def tick(self):

        print("JAPY ejecutando ciclo...")

        for module in self.manager.modules:

            if not module.should_run():

                continue

            module.update()


    def get_next_run(self):

        next_times = []

        for module in self.manager.modules:

            if not module.should_run():

                continue


            next_time = module.next_run()


            if next_time:

                next_times.append(next_time)


        if next_times:

            return min(next_times)


        return None