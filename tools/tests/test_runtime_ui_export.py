"""Targeted UI exports preserve sources, alpha, proportions and unrelated art."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image

spec = importlib.util.spec_from_file_location('ui_export', Path(__file__).parents[1] / 'build-runtime-ui-art.py')
export = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export)


class ScopedUiExport(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.icons = self.root / 'assets/runtime/ui/icons'
        self.sources = self.root / 'assets/concept-art/ui/icons/sources'
        self.icons.mkdir(parents=True)
        self.sources.mkdir(parents=True)
        image = Image.new('RGBA', (200, 80), (20, 80, 90, 255))
        image.paste((0, 0, 0, 0), (20, 20, 180, 60))
        image.save(self.sources / 'pilot.png')
        Image.new('RGBA', (16, 16), (12, 34, 56, 255)).save(self.icons / 'untouched.png')
        (self.icons / 'untouched.webp').write_bytes(b'untouched-runtime')

    def run_export(self, *args):
        with patch.object(export, 'ROOT', self.root), patch.object(export, 'UI_ICON_ROOT', self.icons), \
                patch.object(export, 'GENERATED_UI_SOURCES', {'pilot': ('pilot.png', (100, 50))}), \
                patch('sys.argv', ['export', *args]):
            export.main()

    def test_targeted_export_preserves_source_and_unrelated_images(self):
        before = {p: p.read_bytes() for p in [self.sources / 'pilot.png', self.icons / 'untouched.png', self.icons / 'untouched.webp']}
        self.run_export('--icons', 'pilot')
        self.assertEqual(before, {p: p.read_bytes() for p in before})
        for suffix in ['png', 'webp']:
            with Image.open(self.icons / f'pilot.{suffix}') as image:
                self.assertEqual(image.size, (100, 50))
                # 200:80 becomes 100:40 with five transparent pixels above/below.
                self.assertEqual(image.getchannel('A').getbbox(), (0, 5, 100, 45))
                self.assertEqual(image.getpixel((50, 25))[3], 0)

    def test_unknown_icon_fails_without_touching_unrelated_output(self):
        with self.assertRaises(FileNotFoundError):
            self.run_export('--icons', 'not-an-icon')
        self.assertEqual((self.icons / 'untouched.webp').read_bytes(), b'untouched-runtime')

    def test_repeat_export_is_byte_stable(self):
        self.run_export('--icons', 'pilot')
        before = (self.icons / 'pilot.webp').read_bytes()
        self.run_export('--icons', 'pilot')
        self.assertEqual((self.icons / 'pilot.webp').read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
