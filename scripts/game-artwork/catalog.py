"""Portable read-only catalog API. No Unity, Pillow, network or app dependency."""
from __future__ import annotations

import json
from pathlib import Path
import sqlite3

SCHEMA_VERSION = 1
SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sources(
 id TEXT PRIMARY KEY, root TEXT NOT NULL, path TEXT NOT NULL, classification TEXT NOT NULL,
 bytes INTEGER NOT NULL, mtime_ns INTEGER NOT NULL, sha256 TEXT,
 status TEXT NOT NULL DEFAULT 'pending', error TEXT, UNIQUE(root,path));
CREATE TABLE IF NOT EXISTS blobs(
 sha256 TEXT PRIMARY KEY, path TEXT NOT NULL UNIQUE, bytes INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS assets(
 id TEXT PRIMARY KEY, kind TEXT NOT NULL, pixel_sha256 TEXT NOT NULL,
 blob_sha256 TEXT NOT NULL REFERENCES blobs(sha256), width INTEGER NOT NULL,
 height INTEGER NOT NULL, format TEXT NOT NULL, alpha_min INTEGER, alpha_max INTEGER,
 preview TEXT NOT NULL, UNIQUE(kind,pixel_sha256));
CREATE TABLE IF NOT EXISTS objects(
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id),
 serialized_file TEXT NOT NULL, path_id TEXT NOT NULL, type TEXT NOT NULL, name TEXT NOT NULL,
 raw_sha256 TEXT, asset_id TEXT REFERENCES assets(id), status TEXT NOT NULL, error TEXT,
 provenance TEXT NOT NULL, UNIQUE(source_id,serialized_file,path_id));
CREATE TABLE IF NOT EXISTS aliases(
 id TEXT PRIMARY KEY, object_id TEXT NOT NULL REFERENCES objects(id),
 name TEXT NOT NULL, path TEXT NOT NULL, category TEXT NOT NULL, evidence TEXT NOT NULL,
 UNIQUE(object_id,path,evidence));
CREATE TABLE IF NOT EXISTS references_catalog(
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id),
 logical_path TEXT NOT NULL, native_path TEXT NOT NULL, bundle TEXT,
 status TEXT NOT NULL, object_id TEXT REFERENCES objects(id), evidence TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS source_path_idx ON sources(root,path);
CREATE INDEX IF NOT EXISTS source_status_idx ON sources(status);
CREATE INDEX IF NOT EXISTS asset_type_size_idx ON assets(kind,width,height);
CREATE INDEX IF NOT EXISTS asset_size_idx ON assets(width,height);
CREATE INDEX IF NOT EXISTS object_name_idx ON objects(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS object_source_idx ON objects(source_id,type);
CREATE INDEX IF NOT EXISTS object_pointer_idx ON objects(serialized_file COLLATE NOCASE,path_id);
CREATE INDEX IF NOT EXISTS alias_name_idx ON aliases(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS alias_path_idx ON aliases(path COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS alias_category_idx ON aliases(category);
CREATE INDEX IF NOT EXISTS alias_object_idx ON aliases(object_id);
CREATE INDEX IF NOT EXISTS reference_path_idx ON references_catalog(logical_path COLLATE NOCASE);
CREATE VIRTUAL TABLE IF NOT EXISTS alias_search USING fts5(alias_id UNINDEXED,name,path,category);
CREATE TRIGGER IF NOT EXISTS alias_insert AFTER INSERT ON aliases BEGIN
 INSERT INTO alias_search VALUES(new.id,new.name,new.path,new.category); END;
CREATE TRIGGER IF NOT EXISTS alias_delete AFTER DELETE ON aliases BEGIN
 DELETE FROM alias_search WHERE alias_id=old.id; END;
"""


class Catalog:
    def __init__(self, path):
        self.db = sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)
        self.db.row_factory = sqlite3.Row
        version = self.db.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()
        if not version or int(version[0]) != SCHEMA_VERSION:
            self.db.close()
            raise ValueError('Unsupported artwork catalog version')

    def close(self):
        self.db.close()

    def search(self, query='', *, kind=None, category=None, source=None, min_width=0, min_height=0, limit=50):
        """FTS words/prefixes; exact type/category and native minimum dimensions.

        Returns source aliases, not just deduplicated images. Pagination can be
        added by a future finder without making any filesystem paths public.
        """
        where = ["s.status IN ('done','done-with-errors')", 'a.width>=?', 'a.height>=?']
        params = [min_width, min_height]
        join = ''
        if query.strip():
            join = ' JOIN alias_search f ON f.alias_id=l.id'
            where.append('alias_search MATCH ?')
            # Treat user text as literal tokens, never FTS operators.
            params.append(' AND '.join('"' + w.replace('"', '""') + '"*' for w in query.split()))
        for column, value in [('a.kind', kind), ('l.category', category), ('s.root', source)]:
            if value is not None:
                where.append(column + '=?'); params.append(value)
        params.append(max(1, min(int(limit), 1000)))
        sql = '''SELECT a.*,l.name,l.path,l.category,l.evidence,o.id object_id,
                 o.serialized_file,o.path_id,o.provenance,s.root,s.path source_path,s.sha256 source_sha256
                 FROM aliases l JOIN objects o ON o.id=l.object_id
                 JOIN assets a ON a.id=o.asset_id JOIN sources s ON s.id=o.source_id'''
        return [dict(row) for row in self.db.execute(sql + join + ' WHERE ' + ' AND '.join(where) +
                                                   ' ORDER BY l.path,o.id LIMIT ?', params)]

    def asset(self, asset_id):
        row = self.db.execute('SELECT a.*,b.path,b.bytes FROM assets a JOIN blobs b ON b.sha256=a.blob_sha256 WHERE a.id=?', (asset_id,)).fetchone()
        if not row:
            return None
        result = dict(row)
        result['objects'] = [dict(r) for r in self.db.execute('SELECT * FROM objects WHERE asset_id=? ORDER BY id', (asset_id,))]
        for obj in result['objects']:
            obj['provenance'] = json.loads(obj['provenance'])
            obj['aliases'] = [dict(r) for r in self.db.execute('SELECT * FROM aliases WHERE object_id=? ORDER BY path,evidence', (obj['id'],))]
        return result

    def resolve_pointer(self, serialized_file, path_id):
        """Exact CAB/file + string pathID join, retaining every physical alias."""
        return [dict(r) for r in self.db.execute('''SELECT o.id object_id,o.type,o.name,o.asset_id,
            s.id source_id,s.root,s.path,s.sha256 FROM objects o JOIN sources s ON s.id=o.source_id
            WHERE o.serialized_file=? COLLATE NOCASE AND o.path_id=?
            AND s.status IN ('done','done-with-errors') ORDER BY s.root,s.path,o.id''',
            (serialized_file,str(path_id)))]
