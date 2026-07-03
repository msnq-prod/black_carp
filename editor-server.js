const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const app = express();
const port = 3000;

// Увеличиваем лимит размера тела запроса для сохранения больших HTML файлов
app.use(express.json({ limit: '50mb' }));

// Настройка хранилища для multer (загрузка файлов)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'assets', 'media');
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Генерируем уникальное имя файла, чтобы избежать перезаписи
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

// API для загрузки медиа
app.post('/api/upload', upload.single('media'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  // Возвращаем относительный путь, как он используется в HTML
  const filePath = `assets/media/${req.file.filename}`;
  res.json({ success: true, url: filePath });
});

// API для сохранения HTML
app.post('/api/save', (req, res) => {
  const { html } = req.body;
  if (!html) {
    return res.status(400).json({ error: 'Нет HTML для сохранения' });
  }

  const indexPath = path.join(__dirname, 'index.html');
  
  // Создаем бэкап перед сохранением на всякий случай
  const backupPath = path.join(__dirname, `index_backup_${Date.now()}.html`);
  if (fs.existsSync(indexPath)) {
    fs.copyFileSync(indexPath, backupPath);
  }

  // Сохраняем новый HTML
  fs.writeFileSync(indexPath, html, 'utf8');
  
  res.json({ success: true, message: 'Сайт успешно сохранен!' });
});

// Раздаем файлы редактора
app.use('/editor', express.static(path.join(__dirname, 'editor')));

// Специальная обработка для index.html, чтобы внедрить редактор
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(404).send('index.html не найден');
  }

  let html = fs.readFileSync(indexPath, 'utf8');

  // Если есть параметр ?edit=true, встраиваем скрипты редактора
  if (req.query.edit === 'true') {
    const $ = cheerio.load(html);
    
    // Добавляем стили и скрипты редактора
    $('head').append('<link rel="stylesheet" href="/editor/editor.css">');
    $('body').append('<script src="/editor/editor.js"></script>');
    
    res.send($.html());
  } else {
    // Обычная раздача
    res.send(html);
  }
});

// Раздаем остальные статические файлы (CSS, JS, изображения)
app.use(express.static(__dirname));

app.listen(port, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Сервер редактора запущен!`);
  console.log(`🌍 Обычный сайт: http://localhost:${port}`);
  console.log(`✏️  РЕЖИМ РЕДАКТОРА: http://localhost:${port}/?edit=true`);
  console.log(`======================================================\n`);
});
