import re



class EventExtractor:


    def extract(self, text):

        data = {}


        hora = re.search(
            r"\b\d{1,2}:\d{2}\b",
            text
        )


        if hora:

            data["hora"] = hora.group()



        fecha = re.search(
            r"\b\d{2}/\d{2}/\d{4}\b",
            text
        )


        if fecha:

            data["fecha"] = fecha.group()



        titulo = text


        palabras = [
            "japy",
            "crea",
            "crear",
            "evento",
            "nuevo"
        ]


        for palabra in palabras:

            titulo = titulo.replace(
                palabra,
                ""
            )


        data["titulo"] = titulo.strip()


        return data