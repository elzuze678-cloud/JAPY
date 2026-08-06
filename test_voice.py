import speech_recognition as sr


recognizer = sr.Recognizer()


with sr.Microphone() as source:

    print("🎙️ Di algo...")

    audio = recognizer.listen(source)


try:

    text = recognizer.recognize_google(
        audio,
        language="es-ES"
    )

    print("Escuché:")
    print(text)


except Exception as e:

    print("Error:")
    print(e)