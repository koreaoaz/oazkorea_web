import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location("public_english",Path(__file__).resolve().parents[1]/"scripts/public_english.py")
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class GlossaryTest(unittest.TestCase):
    def test_proper_names_survive_unreliable_model(self):
        worker=object.__new__(m.English)
        worker.phrase=lambda _: "Unrelated words"
        for source,want in m.TECH.items():
            with self.subTest(source=source):
                self.assertIn(want,worker.field(source+" 기술 스터디"))
    def test_only_affected_fields_change_revision(self):
        self.assertEqual(m.field_revision("다른 문장","editor_2_studies","outline"),"")
        self.assertTrue(m.field_revision("유니티 스터디","editor_2_studies","outline"))
        self.assertEqual(m.EDITORIAL_TERMS["수희등"],"Suhuideung")

