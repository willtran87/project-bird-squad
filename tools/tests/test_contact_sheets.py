"""The art QA sheet must show composited pixels, not invisible RGB channels."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from PIL import Image

def load_sheet_module(filename):
    spec = importlib.util.spec_from_file_location(
        filename, Path(__file__).resolve().parents[1] / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ContactSheetTests(unittest.TestCase):
    def test_alpha_and_native_proportions(self):
        with tempfile.TemporaryDirectory(prefix="bird-squad-contact-test-") as folder:
            source, output = Path(folder) / "cutout.png", Path(folder) / "sheet.png"
            image = Image.new("RGBA", (20, 10), (255, 0, 0, 0))
            image.putpixel((10, 5), (0, 255, 0, 255))
            image.save(source)
            for filename in ['make-minor-contact-sheets.py', 'make-aviary-contact-sheet.py']:
                with self.subTest(filename=filename):
                    load_sheet_module(filename).make_sheet([source], output, columns=1, thumb=(20, 20))
                    with Image.open(output) as sheet:
                        # 12px gutter, vertically centered 20x10 source in a 20x20 slot.
                        self.assertEqual(sheet.getpixel((12, 17)), (8, 10, 18))
                        self.assertEqual(sheet.getpixel((22, 22)), (0, 255, 0))
                        self.assertEqual(sheet.getpixel((22, 12)), (8, 10, 18))


if __name__ == "__main__":
    unittest.main()
