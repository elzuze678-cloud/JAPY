import re

from core.interpreter.date_parser import DateParser


class EventExtractor:

    def __init__(self):

        self.date_parser = DateParser()


    def extract(self, text):

        data = {}

        # =========================
        # FECHA Y HORA
        # =========================

        date_data = self.date_parser.parse(text)

        data.update(date_data)


        # =========================
        # FECHA MANUAL
        # =========================

        if "fecha" not in data:

            fecha = re.search(
                r"\b\d{2}/\d{2}/\d{4}\b",
                text
            )

            if fecha:

                data["fecha"] = fecha.group()


        # =========================
        # HORA MANUAL
        # =========================

        if "hora" not in data:

            hora = re.search(
                r"\b\d{1,2}:\d{2}\b",
                text
            )

            if hora:

                data["hora"] = hora.group()


        # =========================
        # TÍTULO
        # =========================

        titulo = text.lower()


        # =========================
        # QUITAR WAKE WORDS
        # =========================

        palabras_wake = [

            "japy",
            "japi",
            "yapi",
            "papi",
            "abby",
            "abi",
            "aby",
            "hapy",
            "happy",
            "habby",
            "yabby"

        ]


        for palabra in palabras_wake:

            titulo = re.sub(
                rf"\b{re.escape(palabra)}\b",
                "",
                titulo
            )


        # =========================
        # QUITAR COMANDOS
        # =========================

        palabras_comando = [

            "crea",
            "crear",
            "evento",
            "nuevo"

        ]


        for palabra in palabras_comando:

            titulo = re.sub(
                rf"\b{re.escape(palabra)}\b",
                "",
                titulo
            )


        # =========================
        # QUITAR FECHAS
        # =========================

        titulo = re.sub(
            r"\b\d{2}/\d{2}/\d{4}\b",
            "",
            titulo
        )


        titulo = re.sub(
            r"\bmañana\b",
            "",
            titulo
        )


        titulo = re.sub(
            r"\bhoy\b",
            "",
            titulo
        )


        # =========================
        # QUITAR HORAS
        # =========================

        # 20:00
        titulo = re.sub(
            r"\b\d{1,2}:\d{2}\b",
            "",
            titulo
        )


        # a las 20 horas
        titulo = re.sub(
            r"\ba\s+las\s+\d{1,2}\s+horas?\b",
            "",
            titulo
        )


        # 20 horas
        titulo = re.sub(
            r"\b\d{1,2}\s+horas?\b",
            "",
            titulo
        )


        # a las 20
        titulo = re.sub(
            r"\ba\s+las\s+\d{1,2}\b",
            "",
            titulo
        )


        # =========================
        # QUITAR "A LAS"
        # =========================

        titulo = re.sub(
            r"\ba\s+las\b",
            "",
            titulo
        )


        # =========================
        # LIMPIAR PUNTUACIÓN
        # =========================

        titulo = re.sub(
            r"[,:]",
            " ",
            titulo
        )


        # =========================
        # LIMPIAR ESPACIOS
        # =========================

        titulo = " ".join(
            titulo.split()
        )


        data["titulo"] = titulo.strip()


        return data