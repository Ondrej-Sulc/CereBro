import unittest
from tower_backend_contract import positive_wire_integer, validate_block_membership


class TowerBackendContractTests(unittest.TestCase):
    def test_native_numeric_text_uses_numeric_not_lexical_floor_order(self):
        blocks = [{"id": 100, "towerId": "class_skill", "numFloors": 20}]
        floors = [{"id": str(i), "blockId": 100, "towerId": "class_skill"} for i in range(20, 0, -1)]
        self.assertEqual(validate_block_membership(blocks, floors, "class_skill", 100), 20)
        self.assertEqual(floors[0]["id"], "20")  # Original wire data remains unchanged.

    def test_duplicate_or_missing_floor_never_counts_as_complete(self):
        blocks = [{"id": 147, "towerId": "class_skill", "numFloors": 2}]
        for numbers in [["1"], ["1", "1"], ["1", "3"]]:
            with self.subTest(numbers=numbers), self.assertRaisesRegex(ValueError, "incomplete"):
                validate_block_membership(blocks, [{"id": n, "blockId": 147, "towerId": "class_skill"} for n in numbers], "class_skill", 147)

    def test_rejects_wrong_tower_or_parent_even_with_matching_floor_numbers(self):
        block = {"id": 100, "towerId": "class_skill", "numFloors": 1}
        for tower, parent in [("class_tech", 100), ("class_skill", 99)]:
            with self.subTest(tower=tower, parent=parent), self.assertRaisesRegex(ValueError, "identity"):
                validate_block_membership([block], [{"id": "1", "blockId": parent, "towerId": tower}], "class_skill", 100)

    def test_rejects_lossy_or_nonpositive_numeric_coercion(self):
        for value in [None, True, False, 0, -1, 1.5, "1.5", "+1", "", "1e2", " 1", "0"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                positive_wire_integer(value)


if __name__ == "__main__":
    unittest.main()
