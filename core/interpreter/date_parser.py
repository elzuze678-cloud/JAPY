from datetime import datetime, timedelta



class DateParser:


    def parse(self, text):

        text = text.lower()


        result = {}

        now = datetime.now()



        # Mañana

        if "mañana" in text:


            tomorrow = now + timedelta(days=1)


            result["fecha"] = (
                tomorrow.strftime("%d/%m/%Y")
            )



        # Hoy

        elif "hoy" in text:


            result["fecha"] = (
                now.strftime("%d/%m/%Y")
            )



        # Hora

        import re


        hora = re.search(
            r"\b\d{1,2}:\d{2}\b",
            text
        )


        if hora:

            result["hora"] = hora.group()



        return result