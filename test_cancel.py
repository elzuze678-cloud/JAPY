from core.interpreter.interpreter import Interpreter


interpreter = Interpreter()


text = "japy cancela estudiar matemáticas"

intent = interpreter.process(
    text
)


print(intent)
