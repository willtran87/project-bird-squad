"""Scoped art pilots must not re-export unrelated approved masters."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('card_export', Path(__file__).parents[1] / 'build-runtime-card-art.py')
export = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export)


class ScopedCardExport(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.manifest = self.root / 'manifest.json'
        self.cards = [{'cardId': name, 'status': 'approved', 'source': f'{name}.png'} for name in ['first', 'second']]
        self.manifest.write_text(json.dumps({'cards': self.cards}), encoding='utf-8')
        self.override = self.root / '.generated/imagegen/tarot/selected/pilot.png'
        self.override.parent.mkdir(parents=True)
        self.override.touch()

    def run_export(self, *args):
        with patch.object(export, 'ROOT', self.root), patch.object(export, 'MANIFEST_PATH', self.manifest), \
                patch('sys.argv', ['export', *args]), \
                patch.object(export, 'copy_master', return_value=self.override) as copy, \
                patch.object(export, 'build_card_assets', return_value={'portrait': 'pilot.webp'}) as build:
            export.main()
            return copy.call_args_list, build.call_args_list

    def test_single_override_preserves_unrelated_entry_and_master(self):
        copy, build = self.run_export('--card-id', 'first', '--source', '.generated/imagegen/tarot/selected/pilot.png')
        self.assertEqual(copy, [])
        self.assertEqual(len(build), 1)
        self.assertEqual(build[0].args, (self.override, 'first'))
        cards = json.loads(self.manifest.read_text())['cards']
        self.assertEqual(cards[1], self.cards[1])
        self.assertEqual(cards[0]['source'], '.generated/imagegen/tarot/selected/pilot.png')

    def test_default_still_exports_all_approved(self):
        copy, build = self.run_export()
        self.assertEqual(len(copy), 2)
        self.assertEqual(len(build), 2)

    def test_bulk_copy_preserves_selected_version(self):
        with patch.object(export, 'ROOT', self.root), patch.object(export, 'GENERATED_ROOT', self.override.parent):
            master = export.copy_master('first', self.override.relative_to(self.root).as_posix())
        self.assertEqual(master, self.override)
        self.assertFalse((self.override.parent / 'first.png').exists())

    def test_invalid_scope_never_writes(self):
        before = self.manifest.read_bytes()
        for args in [('--card-id', 'typo'), ('--source', '.generated/pilot.png'),
                     ('--card-id', 'first', '--card-id', 'second', '--source', '.generated/pilot.png'),
                     ('--card-id', 'first', '--source', 'manifest.json')]:
            with self.subTest(args=args), self.assertRaises(SystemExit):
                self.run_export(*args)
            self.assertEqual(self.manifest.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
