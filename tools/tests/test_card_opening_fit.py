"""Opening fit is opt-in, uniform and cannot paint over the locked frame."""
import importlib.util
from pathlib import Path
import sys
import unittest
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location('card_compose', Path(__file__).parents[1] / 'compose-minor-arcana.py')
compose = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = compose
spec.loader.exec_module(compose)
aviary_spec = importlib.util.spec_from_file_location('aviary_compose', Path(__file__).parents[1] / 'compose-aviary-arcana.py')
aviary = importlib.util.module_from_spec(aviary_spec)
aviary_spec.loader.exec_module(aviary)


class OpeningFit(unittest.TestCase):
    def test_fits_subject_uniformly_and_preserves_mask(self):
        template = Image.new('RGBA', compose.CANVAS, (10, 20, 30, 255))
        ImageDraw.Draw(template).rectangle((112, 168, 911, 1367), fill=(0, 0, 0, 0))
        source = Image.new('RGBA', (800, 1200), (80, 90, 100, 255))
        ImageDraw.Draw(source).rectangle((100, 300, 199, 399), fill=(255, 0, 0, 255))
        for module in (compose, aviary):
            with self.subTest(compositor=module.__name__):
                fitted = module.fit_art_under_template(source, template, fit_opening=True)
                self.assertEqual(fitted.getchannel('A').getbbox(), (112, 168, 912, 1368))
                self.assertEqual(fitted.getpixel((212, 468)), (255, 0, 0, 255))
                self.assertEqual(fitted.getpixel((311, 567)), (255, 0, 0, 255))
                self.assertEqual(fitted.getpixel((0, 0))[3], 0)
                result = Image.alpha_composite(fitted, template)
                self.assertEqual(result.getpixel((30, 400)), template.getpixel((30, 400)))

    def test_default_retains_legacy_canvas_fit(self):
        source = Image.new('RGBA', compose.CANVAS, (80, 90, 100, 255))
        self.assertEqual(compose.fit_art_under_template(source).tobytes(), source.tobytes())


if __name__ == '__main__':
    unittest.main()
