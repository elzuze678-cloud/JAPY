class Skill:


    def __init__(self, name):

        self.name = name



    def can_handle(self, intent):

        return False



    def execute(self, intent):

        raise NotImplementedError