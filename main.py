from app.bootstrap import create_japy


def main():

    japy = create_japy()

    japy.start()


if __name__ == "__main__":
    main()