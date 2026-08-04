class JapyResponses:


    def hello(self):

        return (
            "Hola, soy JAPY. "
            "¿En qué puedo ayudarte?"
        )



    def unknown(self):

        return (
            "No entendí esa instrucción. "
            "¿Puedes repetirla?"
        )



    def events_found(self):

        return (
            "Estos son tus eventos registrados."
        )



    def state(self, state):

        return (
            f"Mi estado actual es: "
            f"{state}"
        )



    def ready(self):

        return (
            "Estoy listo para ayudarte."
        )