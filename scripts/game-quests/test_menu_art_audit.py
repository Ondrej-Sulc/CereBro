"""Regression checks for the offline audit's negative evidence and source identity."""
import tempfile
import unittest
from pathlib import Path
from audit_menu_art import art_observation, method_evidence, pointer, require_omitted_art_fields


class MenuArtAuditTests(unittest.TestCase):
    def test_missing_art_is_distinct_from_captured_empty_or_null(self):
        missing = art_observation("Act", "native-act", {}, "saved.json", "/Acts/1")
        require_omitted_art_fields([missing])
        self.assertEqual(missing["fields"]["image"], {"present": False})
        for captured in (None, "", "quests/recorded.jpg"):
            observation = art_observation("Act", "native-act", {"image": captured}, "saved.json", "/Acts/1")
            self.assertEqual(observation["fields"]["image"]["value"], captured)
            with self.assertRaisesRegex(ValueError, "Saved art fields now exist"):
                require_omitted_art_fields([observation])

    def test_named_method_ranges_cannot_silently_match_another_overload(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "Example.txt").write_text(
                "Method: System.Void Set()\nISIL:\n\t001 Return\n"
                "Method: System.Void Set(System.String value)\nISIL:\n\t001 Move rax, value\n\t002 Return\n")
            with self.assertRaisesRegex(ValueError, "found 2"):
                method_evidence(root, "Example", "System.Void Set(", [(1, 2)])
            exact = method_evidence(root, "Example", "System.Void Set(System.String value)", [(2, 2)])
            self.assertEqual(exact["instructions"], ["002 Return"])
            self.assertEqual(len(exact["sha256"]), 64)

    def test_source_pointer_keeps_exact_non_suffix_identity(self):
        self.assertEqual(pointer("not/a~story_suffix"), "not~1a~0story_suffix")
        observation = art_observation("QuestSummary", "native-id", {"actImageGuess": "similar.jpg"}, "saved.json", "/quest")
        require_omitted_art_fields([observation])
        self.assertFalse(observation["fields"]["actImage"]["present"])


if __name__ == "__main__":
    unittest.main()
