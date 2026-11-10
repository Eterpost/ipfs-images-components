# ipfs-images-components

Компоненты сервера картинок: хранилища (файловая система или IPFS через демон
Kubo), метаданные в Redis, обработчики Express для загрузки, отдачи, превью и
удаления. Сервер на их основе — [ipfs-images](https://github.com/Eterpost/ipfs-images);
в Eterpost он хранит картинки, вставленные в письма рассылок.

Требуется Node.js 22 и Redis.

## Подключение

```
npm install github:Eterpost/ipfs-images-components#v2.0.0
```

Настройки читаются из `config.json` в рабочем каталоге или из файла в
переменной `IPFS_IMAGES_CONFIG` (пример — в ipfs-images).

```js
const components = require('ipfs-images-components');
const storage = new components.storageBackends.FilesystemStorage('/var/lib/images');
const metadata = new components.metadata();
app.post('/ul', components.handlers.upload(storage, metadata, {
  MAX_FILE_SIZE: 25 * 1024 * 1024,
  ALLOWED_TYPES: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
}));
app.get('/dl/:hash/:filename', components.handlers.download(storage, metadata, {
  CACHE_DURATION: 604800,
}));
```

## Компоненты

- `storageBackends.FilesystemStorage(basePath)` — файл хранится по своему
  sha256 (`<basePath>/ab/cdef…`); `IpfsStorage(url)` — демон Kubo
  (`kubo-rpc-client`), файлы закрепляются (pin). Методы: `add(file)` → хеш,
  `get(hash)` → поток, `has(hash)`, `delete(hash)`.
- `metadata` — записи `{datetime, mimetype, size}` в Redis
  (`redis.prefix.attachments`) и индекс по времени (`redis.index.datetime`).
- `handlers.upload` — multipart, поле `file`, ответ `{id, filename, mime}`. Тип
  определяется по первым байтам (png, jpeg, gif, webp); заявленный тип картинки,
  не подтверждённый содержимым, не принимается; другие типы — только если они в
  `ALLOWED_TYPES`. Ошибки: 400 (нет файла), 413 (больше `MAX_FILE_SIZE`), 415
  (тип не разрешён).
- `handlers.download`, `handlers.downloadThumb` — отдача файла и превью (JPEG):
  `ETag` по хешу, `Cache-Control: public, max-age=…, immutable`, 304 при
  совпадении `If-None-Match`, `X-Content-Type-Options: nosniff`,
  `Content-Security-Policy: sandbox`.
- `handlers.delAttachment(storage, metadata)` — удаляет файл и запись.
- `thumbnail` — превью через sharp (`thumbnails.sizes`, кэш на диске при
  `thumbnails.cache`). sharp не ставится из npm (там он с готовыми бинарниками):
  берётся системный, из пакета ALT `node-sharp` (`/usr/lib/node_modules/sharp`,
  другой путь — `thumbnails.sharpPath`). Если его нет, а в проекте установлен
  sharp из npm, используется он — кроме x86-64 без SSE4.2, где его сборка
  роняет процесс. Без sharp или при `thumbnails.enabled: false` превью
  выключены и отдаётся исходная картинка; картинки больше `thumbnails.limitInputPixels` (по
  умолчанию 50 Мпикс) не уменьшаются, отдаются как есть.
- `Cleaner` удаляет старые файлы только из IPFS-хранилища (нужен
  `getLocalObjects`).
- `cleaner`, `pin` — обслуживание: удаление старых файлов, закрепление в IPFS.

## Разработка

```
npm ci
TEST_REDIS_URL=redis://127.0.0.1:16379/1 npm test   # без него тесты с Redis пропускаются
# превью: TEST_SHARP_PATH=/usr/lib/node_modules/sharp (пакет ALT node-sharp)
npm run lint
```
