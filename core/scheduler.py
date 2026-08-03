from datetime import datetime


class JapyScheduler:

    def update(self, modules):

        for module in modules:

            if not module.enabled:
                continue

            if module.interval is None:
                continue

            if module.last_update is None:

                module.update()

                module.last_update = datetime.now()

                continue

            elapsed = (
                datetime.now() - module.last_update
            ).total_seconds()

            if elapsed >= module.interval:

                module.update()

                module.last_update = datetime.now()