from datetime import datetime, timedelta
import re


class DateParser:

    def parse(self, text):

        text = text.lower()

        result = {}

        now = datetime.now()


        # =========================
        # FECHA
        # =========================

        # Mañana
        if "mañana" in text:

            tomorrow = now + timedelta(days=1)

            result["fecha"] = tomorrow.strftime(
                "%d/%m/%Y"
            )


        # Hoy
        elif "hoy" in text:

            result["fecha"] = now.strftime(
                "%d/%m/%Y"
            )


        # Fecha escrita manualmente
        fecha = re.search(
            r"\b\d{2}/\d{2}/\d{4}\b",
            text
        )

        if fecha:

            result["fecha"] = fecha.group()


        # =========================
        # HORA
        # =========================

        # Formato: 20:00
        hora = re.search(
            r"\b\d{1,2}:\d{2}\b",
            text
        )

        if hora:

            result["hora"] = hora.group()

            return result


        # Formato:
        # 20 horas
        # a las 20 horas
        hora_horas = re.search(
            r"\b(?:a\s+las\s+)?(\d{1,2})\s+horas?\b",
            text
        )

        if hora_horas:

            hora_numero = int(
                hora_horas.group(1)
            )

            if 0 <= hora_numero <= 23:

                result["hora"] = (
                    f"{hora_numero:02d}:00"
                )

                return result


        # Formato:
        # a las 20
        hora_simple = re.search(
            r"\ba\s+las\s+(\d{1,2})\b",
            text
        )

        if hora_simple:

            hora_numero = int(
                hora_simple.group(1)
            )

            if 0 <= hora_numero <= 23:

                result["hora"] = (
                    f"{hora_numero:02d}:00"
                )


        return result