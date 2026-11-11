"""Replay a historical pathlib producer's Windows text serialization.

Frozen producers are source-hash evidence and must remain unchanged. Their
default text writes originally translated LF to CRLF on Windows. This context
makes that historical output format explicit during offline reproduction; it
does not normalize completed files or change the producer's inputs or hashes.
"""
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch


@contextmanager
def historical_crlf_output(output_root):
    """Use CRLF for default text writes through pathlib below an existing root.

    Reads, binary writes, explicit newline choices and paths outside the root
    retain their original behavior. Resolved containment excludes symlink
    escapes. The patch is process-wide: use only for serial offline replay of a
    known pathlib producer, never for concurrent application or capture work.
    """
    root = Path(output_root).resolve(strict=True)
    if not root.is_dir():
        raise ValueError('Historical output root must be an existing directory')
    original_open = Path.open

    def replay_open(path, mode='r', buffering=-1, encoding=None, errors=None, newline=None):
        writes_text = 'b' not in mode and any(flag in mode for flag in 'wax+')
        if writes_text and newline is None and path.resolve().is_relative_to(root):
            newline = '\r\n'
        return original_open(path, mode, buffering, encoding, errors, newline)

    with patch.object(Path, 'open', replay_open):
        yield
