# Changelog

## 2.0.0 — 2026-11-10

Node.js 22 and current dependencies; published as Eterpost/ipfs-images-components.

- Express handlers and storages use async/await; bluebird and fs-extra are gone.
- redis 5, winston 3, sharp 0.35, kubo-rpc-client (instead of ipfs-api), multiparty 4.3.
- Settings may come from the file in `IPFS_IMAGES_CONFIG`; `settings.load()` reloads them.
- Upload accepts only allowed types (images by default), checked by the file signature;
  400, 413 and 415 instead of 500.
- Download: `ETag` and `immutable` caching; 304 only for a matching `If-None-Match`
  of an existing file (it used to answer 304 to any `If-Modified-Since`);
  `X-Content-Type-Options: nosniff` and `Content-Security-Policy: sandbox`.
- `delAttachment(storage, metadata)` deletes the metadata record too.
- Thumbnails wait for sharp and fall back to the original image on failure.
- Thumbnails refuse to decode images over `thumbnails.limitInputPixels` (50 Mpx).
- Concurrent uploads of the same content no longer fail.
- `Cleaner(storage, metadata, options)` and `Pin(storage, metadata)` take their
  dependencies; `Pin#check` returns files missing from the store.
- Tests run on `node:test`.
- The logger no longer swallows uncaught exceptions.
