from voice.wake_word import WakeWordDetector


wake = WakeWordDetector()


tests = [
    "japy muéstrame mis eventos",
    "papi crea evento estudiar mañana",
    "hapy hola",
    "hola japy"
    "hola iapi"	
]


for text in tests:

    result = wake.detect(text)

    print(
        text,
        "->",
        result
    )