import re

from core.interpreter.date_parser import DateParser



class EventExtractor:


    def __init__(self):

        self.date_parser = DateParser()



    def extract(self, text):

        data = {}


        # Obtener fecha y hora usando lenguaje natural

        date_data = self.date_parser.parse(
            text
        )


        data.update(
            date_data
        )



        # Buscar fecha escrita manualmente
        if "fecha" not in data:

            fecha = re.search(
                r"\b\d{2}/\d{2}/\d{4}\b",
                text
            )


            if fecha:

                data["fecha"] = fecha.group()



        # Buscar hora escrita manualmente
        if "hora" not in data:

            hora = re.search(
                r"\b\d{1,2}:\d{2}\b",
                text
            )


            if hora:

                data["hora"] = hora.group()



        # Crear título limpio

        titulo = text.lower()



        palabras = [

            "japy",
            "crea",
            "crear",
            "evento",
            "nuevo",
            "mañana",
            "hoy",
            "a las"

        ]



        for palabra in palabras:

            titulo = titulo.replace(
                palabra,
                ""
            )



        # Quitar fechas del título

        titulo = re.sub(
            r"\b\d{2}/\d{2}/\d{4}\b",
            "",
            titulo
        )



        # Quitar horas del título

        titulo = re.sub(
            r"\b\d{1,2}:\d{2}\b",
            "",
            titulo
        )



        # Limpiar espacios

        titulo = " ".join(
            titulo.split()
        )



        data["titulo"] = titulo.strip()



        return data