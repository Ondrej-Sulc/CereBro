"""Pure validation of public Tower wire definitions.No game or transport access."""
import re


def positive_wire_integer(value):
    # Native Dot.Integer accepts numeric text; JSON floor IDs are strings.
    if type(value) is int and value > 0:
        return value
    if isinstance(value, str) and re.fullmatch(r"[0-9]+", value) and int(value) > 0:
        return int(value)
    raise ValueError("invalid_positive_wire_integer")


def validate_block_membership(blocks, floors, tower_id, block_number):
    if len(blocks) != 1 or blocks[0].get("towerId") != tower_id:
        raise ValueError("requested_block_identity_mismatch")
    block = blocks[0]
    if positive_wire_integer(block.get("id")) != block_number:
        raise ValueError("requested_block_identity_mismatch")
    count = positive_wire_integer(block.get("numFloors"))
    numbers = []
    for floor in floors:
        if floor.get("towerId") != tower_id or positive_wire_integer(floor.get("blockId")) != block_number:
            raise ValueError("requested_floor_identity_mismatch")
        numbers.append(positive_wire_integer(floor.get("id")))
    if sorted(numbers) != list(range(1, count + 1)):
        raise ValueError("floor_membership_incomplete")
    return count
