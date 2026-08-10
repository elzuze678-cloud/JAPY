
from core.manager import ModuleManager
from core.scheduler import Scheduler
from core.state import StateManager, JapyState
from core.heartbeat import Heartbeat
from core.sleep import SleepManager

from core.skills.manager import SkillManager

from core.skills.agenda.agenda_skill import AgendaSkill
from core.skills.system.system_skill import SystemSkill
from core.skills.conversation.conversation_skill import ConversationSkill

from scheduler.calendar import CalendarModule


class JapyEngine:

    def __init__(self):

        self.manager = ModuleManager()

        # Evento pendiente de completar
        self.pending_event = None


        # =========================
        # MÓDULOS PRINCIPALES
        # =========================

        agenda = CalendarModule()

        self.add_module(
            agenda
        )


        self.state = StateManager()


        self.scheduler = Scheduler(
            self.manager
        )


        self.sleep_manager = SleepManager(
            self
        )


        self.heartbeat = Heartbeat(
            self
        )


        # =========================
        # SISTEMA DE HABILIDADES
        # =========================

        self.skills = SkillManager()

        self.load_skills()


    def load_skills(self):

        self.skills.add(
            AgendaSkill(self)
        )


        self.skills.add(
            SystemSkill(self)
        )


        self.skills.add(
            ConversationSkill(self)
        )


        print(
            "Skills cargadas:"
        )


        for skill in self.skills.skills:

            print(
                f"- {skill.name}"
            )


    def add_module(self, module):

        self.manager.add(
            module
        )


    def execute(self, intent):

        return self.skills.execute(
            intent
        )


    def start(self):

        print(
            "Iniciando JAPY..."
        )


        self.manager.start_all()


        self.state.set_state(
            JapyState.WORKING
        )


        print(
            "JAPY listo."
        )


    def run(self):

        print(
            "JAPY iniciando sistema..."
        )


        self.start()


        print(
            "JAPY preparado."
        )


    def stop(self):

        print(
            "Deteniendo JAPY..."
        )


        self.heartbeat.stop()


        self.manager.stop_all()


        self.state.set_state(
            JapyState.STOPPED
        )


        print(
            "JAPY detenido."
        )


    def tick(self):

        self.scheduler.tick()


    def __str__(self):

        return (
            f"{self.state}\n"
            f"Módulos cargados: "
            f"{len(self.manager.modules)}"
        )

