from core.engine import JapyEngine
from core.runtime.runtime import JapyRuntime



def main():

    japy = JapyEngine()


    runtime = JapyRuntime(
        japy
    )


    runtime.run()



if __name__ == "__main__":

    main()