import importlib.util,stat,unittest,zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('instagram_review',Path(__file__).parents[1]/'scripts/instagram_export_review.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def entry(name,size=100,compressed=90):
 z=zipfile.ZipInfo(name);z.file_size=size;z.compress_size=compressed;return z
class InstagramArchiveTests(unittest.TestCase):
 def test_only_safe_relative_members(self):
  self.assertEqual(m.check_entries([entry('media/posts/a.jpg')]),100)
  for path in ['../a.jpg','/a.jpg','media/../a.jpg','C:/a.jpg','media\\a.jpg','media//a.jpg','./a.jpg','media/a\x00.jpg']:
   with self.subTest(path=path),self.assertRaises(ValueError):m.check_entries([entry(path)])
 def test_duplicate_and_unicode_collision(self):
  for names in [('a.jpg','A.JPG'),('e\u0301.jpg','\u00e9.jpg')]:
   with self.assertRaises(ValueError):m.check_entries([entry(n) for n in names])
 def test_links_and_encryption(self):
  z=entry('media/a.jpg');z.external_attr=(stat.S_IFLNK|0o777)<<16
  with self.assertRaises(ValueError):m.check_entries([z])
  z=entry('media/a.jpg');z.flag_bits=1
  with self.assertRaises(ValueError):m.check_entries([z])
 def test_bomb_limits(self):
  for z in [entry('a.jpg',33*1024**2,33*1024**2),entry('a.jpg',1000000,1)]:
   with self.assertRaises(ValueError):m.check_entries([z])
  with self.assertRaises(ValueError):m.check_entries([entry(str(i),30*1024**2,30*1024**2) for i in range(10)])
 def test_encoding_does_not_damage_valid_korean(self):
  value='학회 소식';self.assertEqual(m.decode_text(value),value);self.assertEqual(m.decode_text(value.encode().decode('latin1')),value)
 def test_media_join_does_not_walk_unrelated_settings(self):
  value={'media':{'uri':'media/posts/a.jpg'},'account_settings':{'uri':'private'},'label_values':[{'dict':[{'media':{'uri':'media/posts/b.jpg'}}]}]}
  self.assertEqual(m.media_paths(value),['media/posts/a.jpg','media/posts/b.jpg'])
if __name__=='__main__':unittest.main()
