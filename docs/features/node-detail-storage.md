# Native node detail storage

The public node catalog keeps its small index in the server bundle. A detail request reads only its reviewed JSON shard from the repository data directory, rather than making webpack parse and package every detail as a JavaScript module. The generated reference loader and all original catalog/shard bytes remain unchanged.

`expanded-node-detail-storage.ts` first matches the exact requested ID against the frozen index. The filename is the SHA-256 of that indexed ID, matching every entry in the generated loader. It resolves the file within a fixed deployment data directory, rejects escaped paths and oversized files, checks the complete byte hash against `detailSha256`, then applies the existing catalog/ID/version validation. Unknown, missing, changed or malformed records return no detail. The reader does not scan directories, write data or send filesystem paths to the browser.

The two fixed directory candidates support the repository-root CLI working directory and the deployed `web/` working directory. Next output tracing includes the reviewed `v2/details/*.json` files for node-detail routes. The current Docker deployment also retains the repository source directory.

Validation:

```sh
pnpm exec vitest run web/src/lib/expanded-node-detail-storage.test.ts web/src/lib/expanded-node-modifiers.icons.test.ts web/next.config.test.ts --maxWorkers=1
```

The storage suite covers exact loading, unknown/traversal IDs, changed bytes, wrong catalog identity, malformed records, missing files, and all 1,688 generated filename/content bindings. The complete-corpus integrity audit has a 30-second test budget; ordinary detail reads touch one shard.
