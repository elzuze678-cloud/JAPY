from enum import Enum


class JapyState(Enum):

    SLEEPING = "Dormido"
    LISTENING = "Escuchando"
    THINKING = "Pensando"
    WORKING = "Trabajando"
    RESTING = "Descansando"
    STOPPED = "Detenido"


class StateManager:

    def __init__(self):

        self._state = JapyState.SLEEPING


    @property
    def state(self):

        return self._state


    def set_state(self, state: JapyState):

        if self._state != state:

            print(
                f"Estado: {self._state.value} → {state.value}"
            )

            self._state = state


    def is_state(self, state: JapyState):

        return self._state == state


    def __str__(self):

        return f"Estado actual: {self._state.value}"