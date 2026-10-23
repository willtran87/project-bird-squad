"""Lossless-export checks must reject visible color and alpha drift."""
import importlib.util
from pathlib import Path
import unittest
from PIL import Image

spec=importlib.util.spec_from_file_location('integrity',Path(__file__).parents[1]/'validate-card-export-integrity.py')
integrity=importlib.util.module_from_spec(spec);spec.loader.exec_module(integrity)

class ExportIntegrity(unittest.TestCase):
    def test_invisible_webp_rgb_is_allowed_but_canonical_pixels_are_exact(self):
        a=Image.new('RGBA',(2,2),(10,20,30,0));b=Image.new('RGBA',(2,2),(90,80,70,0))
        with self.assertRaises(ValueError):integrity.same(a.copy(),b.copy(),'canonical')
        integrity.same(a,b,'webp',webp=True)

    def test_even_one_visible_color_level_is_rejected(self):
        a=Image.new('RGBA',(2,2),(10,20,30,1));b=a.copy();b.putpixel((1,1),(11,20,30,1))
        with self.assertRaises(ValueError):integrity.same(a,b,'webp',webp=True)

    def test_alpha_change_is_rejected(self):
        a=Image.new('RGBA',(2,2),(10,20,30,0));b=a.copy();b.putpixel((1,1),(10,20,30,1))
        with self.assertRaises(ValueError):integrity.same(a,b,'webp',webp=True)

if __name__=='__main__':unittest.main()
