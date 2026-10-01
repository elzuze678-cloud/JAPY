from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


PUBLIC = Path("public")
PUBLIC.mkdir(exist_ok=True)


def find_font(size):
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\calibrib.ttf",
    ]

    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)

    return ImageFont.load_default()


def create_icon(size):
    image = Image.new("RGBA", (size, size), "#111827")
    draw = ImageDraw.Draw(image)

    # Margen y esquinas
    margin = int(size * 0.08)
    radius = int(size * 0.22)

    # Fondo principal
    draw.rounded_rectangle(
        (
            margin,
            margin,
            size - margin,
            size - margin,
        ),
        radius=radius,
        fill="#1f2937",
    )

    # Círculo central
    center = size // 2
    circle_radius = int(size * 0.31)

    draw.ellipse(
        (
            center - circle_radius,
            center - circle_radius,
            center + circle_radius,
            center + circle_radius,
        ),
        fill="#374151",
    )

    # Letra J
    font_size = int(size * 0.48)
    font = find_font(font_size)

    text = "J"

    bbox = draw.textbbox((0, 0), text, font=font)

    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    text_x = center - text_width // 2
    text_y = center - text_height // 2 - int(size * 0.04)

    draw.text(
        (text_x, text_y),
        text,
        font=font,
        fill="#ffffff",
    )

    # Pequeño detalle inferior
    dot_radius = int(size * 0.035)

    draw.ellipse(
        (
            center - dot_radius,
            int(size * 0.76) - dot_radius,
            center + dot_radius,
            int(size * 0.76) + dot_radius,
        ),
        fill="#9ca3af",
    )

    return image


icon_192 = create_icon(192)
icon_512 = create_icon(512)

icon_192.save(
    PUBLIC / "icon-192.png",
    "PNG",
)

icon_512.save(
    PUBLIC / "icon-512.png",
    "PNG",
)

print("Iconos creados correctamente:")
print(PUBLIC / "icon-192.png")
print(PUBLIC / "icon-512.png")