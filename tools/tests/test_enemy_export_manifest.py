import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('enemy_export', Path(__file__).parents[1] / 'build-runtime-enemy-art.py')
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class ManifestExportTests(unittest.TestCase):
    def run_fixture(self, missing=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            full = root/'assets/runtime/enemies/full'
            full.mkdir(parents=True)
            entries = []
            for name in ['roof_rat', 'turtle_barricader']:
                source = root/f'{name}.png'
                if not (missing and name == 'turtle_barricader'):
                    source.write_bytes(b'fixture handled by mocked encoder')
                entries.append({'enemyId':name,'source':source.name,
                                'full':f'assets/runtime/enemies/full/{name}.webp','status':'approved','version':'retained'})
            manifest = {'enemies':entries,'basedOn':['preserved-provenance']}
            path = root/'manifest.json'
            path.write_text(json.dumps(manifest))
            with patch.multiple(exporter, ROOT=root, FULL_ROOT=full, RUNTIME_ROOT=full.parent, MANIFEST_PATH=path), \
                 patch.object(exporter,'optimize') as encode, \
                 patch.object(exporter,'build_reserve_enemies',return_value=0), \
                 patch.object(exporter,'copy_contact_sheets'):
                if missing:
                    with self.assertRaisesRegex(ValueError,'turtle_barricader'):
                        exporter.main()
                    encode.assert_not_called()
                else:
                    exporter.main()
                    self.assertEqual(encode.call_count,2)
                    self.assertEqual(encode.call_args_list[1].kwargs['max_edge'],704)
                self.assertEqual(json.loads(path.read_text()),manifest)

    def test_adopted_roster_and_provenance_survive_rebuild(self):
        self.run_fixture()

    def test_missing_master_fails_before_any_export_is_written(self):
        self.run_fixture(missing=True)


if __name__ == '__main__':
    unittest.main()
