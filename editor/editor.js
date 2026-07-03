document.addEventListener('DOMContentLoaded', () => {
  console.log('Расширенный визуальный редактор запущен');
  
  document.body.classList.add('editor-active');

  let selectedElement = null;
  let activeBlock = null;
  let blockInsertIndex = 0; 

  const blockPresets = [
    {
      id: 'featured-work',
      title: 'Картинка с описанием (Портфолио)',
      desc: 'Секция с большим изображением и подписью снизу',
      html: `
        <section class="featured-work">
          <img src="assets/media/work-shoulder.png" alt="Новая графическая работа" />
          <div class="work-caption">
            <h3>Новый проект татуировки</h3>
            <p>Короткое описание выполненной работы или концепта.</p>
          </div>
        </section>
      `
    },
    {
      id: 'info-strip',
      title: 'Информационная полоса (3 колонки)',
      desc: 'Три колонки для шагов, правил или условий работы',
      html: `
        <section class="info-strip">
          <article>
            <span>01</span>
            <p>Укажите первый важный пункт или условие.</p>
          </article>
          <article>
            <span>02</span>
            <p>Укажите второй важный этап работы.</p>
          </article>
          <article>
            <span>03</span>
            <p>Расскажите о финальном этапе или уходе.</p>
          </article>
        </section>
      `
    },
    {
      id: 'text-block',
      title: 'Текстовый блок (По центру)',
      desc: 'Простой текстовый блок без изображений для заголовков или анонсов',
      html: `
        <section class="featured-work" style="justify-content: center; text-align: center; min-height: auto; padding: 60px 20px;">
          <div class="work-caption" style="margin: 0 auto; max-width: 600px;">
            <h3 style="margin-bottom: 15px;">Новый раздел</h3>
            <p>Здесь вы можете описать любые важные детали, добавить контакты или приветственный текст.</p>
          </div>
        </section>
      `
    }
  ];

  // 1. РЕНДЕРИНГ ИНТЕРФЕЙСА РЕДАКТОРА
  
  // Топбар
  const toolbar = document.createElement('div');
  toolbar.className = 'editor-toolbar';
  toolbar.innerHTML = `
    <div class="editor-toolbar-logo">Black Carp · Редактор</div>
    <div class="editor-toolbar-actions">
      <button id="editor-save-btn" class="editor-btn editor-btn-primary">💾 Сохранить</button>
      <button id="editor-exit-btn" class="editor-btn">Выйти</button>
    </div>
  `;
  document.body.appendChild(toolbar);

  // Боковой инспектор
  const inspector = document.createElement('div');
  inspector.className = 'editor-inspector';
  inspector.innerHTML = `
    <div class="editor-inspector-header">Панель свойств</div>
    <div id="inspector-content" class="editor-inspector-content">
      <div class="editor-inspector-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <span>Выберите элемент на странице, чтобы настроить его параметры</span>
      </div>
    </div>
  `;
  document.body.appendChild(inspector);

  // Всплывающее уведомление
  const toast = document.createElement('div');
  toast.className = 'editor-toast';
  document.body.appendChild(toast);

  // Модалка библиотек
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'editor-modal-overlay';
  modalOverlay.style.display = 'none';
  modalOverlay.innerHTML = `
    <div class="editor-modal">
      <div class="editor-modal-header">
        <h3>Добавить новый блок</h3>
        <button class="editor-modal-close">&times;</button>
      </div>
      <div class="editor-modal-content" id="presets-container"></div>
    </div>
  `;
  document.body.appendChild(modalOverlay);

  // Скрытый file input
  const mediaFileInput = document.createElement('input');
  mediaFileInput.type = 'file';
  mediaFileInput.accept = 'image/*,video/*';
  mediaFileInput.style.display = 'none';
  document.body.appendChild(mediaFileInput);

  function showToast(message, isError = false) {
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#ff4d4d' : '#2ecc71';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // 2. ИНИЦИАЛИЗАЦИЯ СТРУКТУРЫ РЕДАКТИРОВАНИЯ
  
  function initEditableStructure() {
    // Удаляем старые элементы редактора
    document.querySelectorAll('.editor-block-controls').forEach(el => el.remove());
    document.querySelectorAll('.editor-add-block-separator').forEach(el => el.remove());

    const homeView = document.querySelector('.view-home');
    if (!homeView) return;

    const blocks = Array.from(homeView.children).filter(child => {
      return child.tagName.toLowerCase() === 'section' || child.tagName.toLowerCase() === 'footer';
    });

    blocks.forEach((block, index) => {
      block.classList.add('editor-block');
      
      const blockControls = document.createElement('div');
      blockControls.className = 'editor-block-controls';
      blockControls.innerHTML = `
        <button class="editor-block-btn block-up" title="Переместить вверх">▲</button>
        <button class="editor-block-btn block-down" title="Переместить вниз">▼</button>
        <button class="editor-block-btn block-duplicate" title="Дублировать блок">📋</button>
        <button class="editor-block-btn block-delete" title="Удалить блок" style="color: var(--editor-danger);">🗑️</button>
      `;

      blockControls.querySelector('.block-up').addEventListener('click', (e) => {
        e.stopPropagation();
        if (block.previousElementSibling && block.previousElementSibling.classList.contains('editor-block')) {
          block.parentNode.insertBefore(block, block.previousElementSibling);
          initEditableStructure();
        }
      });

      blockControls.querySelector('.block-down').addEventListener('click', (e) => {
        e.stopPropagation();
        const next = block.nextElementSibling;
        if (next && next.classList.contains('editor-block')) {
          block.parentNode.insertBefore(next, block);
          initEditableStructure();
        }
      });

      blockControls.querySelector('.block-duplicate').addEventListener('click', (e) => {
        e.stopPropagation();
        const clone = block.cloneNode(true);
        clone.classList.remove('editor-selected-element');
        block.parentNode.insertBefore(clone, block.nextSibling);
        initEditableStructure();
        showToast('Блок продублирован');
      });

      blockControls.querySelector('.block-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Вы уверены, что хотите удалить этот блок?')) {
          block.remove();
          initEditableStructure();
          clearSelection();
          showToast('Блок удален');
        }
      });

      block.appendChild(blockControls);

      if (index === 0) {
        insertSeparator(block, 'before');
      }
      insertSeparator(block, 'after');
    });

    // Делаем все тексты contenteditable
    const textSelectors = 'h1, h2, h3, h4, h5, h6, p, span, a, button, li, dt, dd';
    const textElements = homeView.querySelectorAll(textSelectors);
    
    textElements.forEach(el => {
      if (el.closest('.editor-block-controls') || el.closest('.editor-add-block-separator')) return;
      
      el.setAttribute('contenteditable', 'true');
      el.classList.add('editor-editable-text');
      
      if (el.tagName.toLowerCase() === 'a' || el.tagName.toLowerCase() === 'button') {
        el.addEventListener('click', (e) => {
          e.preventDefault();
        });
      }
    });
  }

  function insertSeparator(targetBlock, position) {
    const separator = document.createElement('div');
    separator.className = 'editor-add-block-separator';
    separator.innerHTML = `
      <div class="editor-add-block-line"></div>
      <button class="editor-add-block-btn">+</button>
    `;

    separator.querySelector('.editor-add-block-btn').addEventListener('click', (e) => {
      e.preventDefault();
      activeBlock = targetBlock;
      blockInsertIndex = position === 'before' ? 'before' : 'after';
      openBlockModal();
    });

    if (position === 'before') {
      targetBlock.parentNode.insertBefore(separator, targetBlock);
    } else {
      targetBlock.parentNode.insertBefore(separator, targetBlock.nextSibling);
    }
  }

  // 3. ОТСЛЕЖИВАНИЕ КЛИКОВ И ВЫБОРА ЭЛЕМЕНТОВ
  
  document.addEventListener('click', (e) => {
    if (e.target.closest('.editor-toolbar') || 
        e.target.closest('.editor-inspector') || 
        e.target.closest('.editor-modal') ||
        e.target.classList.contains('editor-add-block-btn') ||
        e.target.closest('.editor-block-controls')) {
      return;
    }

    const editable = e.target.closest('[contenteditable="true"]') || e.target.closest('img') || e.target.closest('video') || e.target.closest('.editor-block');
    
    if (editable) {
      selectElement(editable);
    } else {
      clearSelection();
    }
  });

  function selectElement(el) {
    clearSelection();
    selectedElement = el;
    selectedElement.classList.add('editor-selected-element');
    renderInspectorForm(selectedElement);
  }

  function clearSelection() {
    if (selectedElement) {
      selectedElement.classList.remove('editor-selected-element');
    }
    selectedElement = null;
    document.getElementById('inspector-content').innerHTML = `
      <div class="editor-inspector-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <span>Выберите элемент на странице для настройки параметров</span>
      </div>
    `;
  }

  // Парсинг числового значения и единицы измерения стиля (px, em, rem, %)
  function parseStyleValue(val, defaultVal = 0, defaultUnit = 'px') {
    if (!val || val === 'normal' || val === 'auto') return { num: defaultVal, unit: defaultUnit };
    const num = parseFloat(val);
    const unit = val.replace(num, '').trim() || defaultUnit;
    return { num: isNaN(num) ? defaultVal : num, unit };
  }

  // Парсинг CSS фильтров
  function parseFilters(filterStr) {
    const filters = { brightness: 1, contrast: 1, saturate: 1 };
    if (!filterStr || filterStr === 'none') return filters;
    
    const bMatch = filterStr.match(/brightness\(([^)]+)\)/);
    const cMatch = filterStr.match(/contrast\(([^)]+)\)/);
    const sMatch = filterStr.match(/saturate\(([^)]+)\)/);
    
    if (bMatch) filters.brightness = parseFloat(bMatch[1]);
    if (cMatch) filters.contrast = parseFloat(cMatch[1]);
    if (sMatch) filters.saturate = parseFloat(sMatch[1]);
    
    return filters;
  }

  // Конвертер цвета RGB в HEX
  function rgb2hex(rgb) {
    if (!rgb || rgb.indexOf('rgb') === -1) return '#ffffff';
    // Проверяем rgba
    if (rgb.indexOf('rgba') === 0) {
      const parts = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
      if (!parts) return '#ffffff';
      // Если альфа-канал 0 (прозрачный)
      if (parseFloat(parts[4]) === 0) return '#ffffff';
      rgb = parts;
    } else {
      rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    }
    if (!rgb) return '#ffffff';
    function hex(x) {
        return ("0" + parseInt(x).toString(16)).slice(-2);
    }
    return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
  }

  // Генерируем красивый аккордеон
  function createAccordionSection(title, isActive = false) {
    const accordion = document.createElement('div');
    accordion.className = `editor-accordion ${isActive ? 'active' : ''}`;
    
    const header = document.createElement('div');
    header.className = 'editor-accordion-header';
    header.textContent = title;
    
    const content = document.createElement('div');
    content.className = 'editor-accordion-content';
    
    header.addEventListener('click', () => {
      accordion.classList.toggle('active');
    });
    
    accordion.appendChild(header);
    accordion.appendChild(content);
    
    return { element: accordion, contentContainer: content };
  }

  // Хелпер для создания стандартного ползунка (слайдера)
  function createSliderControl(label, min, max, step, currentVal, unit, onChange) {
    const group = document.createElement('div');
    group.className = 'editor-field-group';
    
    const textLabel = document.createElement('label');
    textLabel.textContent = label;
    group.appendChild(textLabel);
    
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'editor-slider-container';
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = currentVal;
    
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'editor-slider-val';
    valueDisplay.textContent = currentVal + unit;
    
    slider.addEventListener('input', (e) => {
      const v = e.target.value;
      valueDisplay.textContent = v + unit;
      onChange(v);
    });
    
    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(valueDisplay);
    group.appendChild(sliderContainer);
    
    return group;
  }

  // 4. ДИНАМИЧЕСКИЙ РЕНДЕРИНГ ФОРМЫ СВОЙСТВ (ИНСПЕКТОР)
  
  function renderInspectorForm(el) {
    const container = document.getElementById('inspector-content');
    container.innerHTML = ''; 
    
    const tagName = el.tagName.toLowerCase();
    const computedStyle = window.getComputedStyle(el);

    // Вкладка 1: Макет и Отступы (Layout & Spacing)
    const { element: layoutAcc, contentContainer: layoutContent } = createAccordionSection('Макет и Отступы', true);
    
    // Внутренние отступы (Padding Top, Bottom, Left, Right)
    const paddingLabel = document.createElement('label');
    paddingLabel.style.fontSize = '11px';
    paddingLabel.style.fontWeight = '600';
    paddingLabel.style.color = 'var(--editor-text-muted)';
    paddingLabel.textContent = 'ВНУТРЕННИЕ ОТСТУПЫ (PADDING)';
    layoutContent.appendChild(paddingLabel);

    const paddingGrid = document.createElement('div');
    paddingGrid.className = 'editor-field-grid-4';
    
    const paddings = ['Top', 'Right', 'Bottom', 'Left'];
    paddings.forEach(side => {
      const cell = document.createElement('div');
      cell.className = 'editor-field-group';
      const curPadding = el.style['padding' + side] || computedStyle['padding' + side];
      const parsed = parseStyleValue(curPadding, 0, 'px');
      
      cell.innerHTML = `
        <label style="font-size: 9px;">${side}</label>
        <input type="number" class="editor-input" value="${parsed.num}" style="padding: 6px 8px;">
      `;
      cell.querySelector('input').addEventListener('input', (e) => {
        el.style['padding' + side] = e.target.value + parsed.unit;
      });
      paddingGrid.appendChild(cell);
    });
    layoutContent.appendChild(paddingGrid);

    // Внешние отступы (Margin Top, Bottom, Left, Right)
    const marginLabel = document.createElement('label');
    marginLabel.style.fontSize = '11px';
    marginLabel.style.fontWeight = '600';
    marginLabel.style.color = 'var(--editor-text-muted)';
    marginLabel.textContent = 'ВНЕШНИЕ ОТСТУПЫ (MARGIN)';
    layoutContent.appendChild(marginLabel);

    const marginGrid = document.createElement('div');
    marginGrid.className = 'editor-field-grid-4';
    
    const margins = ['Top', 'Right', 'Bottom', 'Left'];
    margins.forEach(side => {
      const cell = document.createElement('div');
      cell.className = 'editor-field-group';
      const curMargin = el.style['margin' + side] || computedStyle['margin' + side];
      const parsed = parseStyleValue(curMargin, 0, 'px');
      
      cell.innerHTML = `
        <label style="font-size: 9px;">${side}</label>
        <input type="number" class="editor-input" value="${parsed.num}" style="padding: 6px 8px;">
      `;
      cell.querySelector('input').addEventListener('input', (e) => {
        el.style['margin' + side] = e.target.value + parsed.unit;
      });
      marginGrid.appendChild(cell);
    });
    layoutContent.appendChild(marginGrid);

    // Настройки Flexbox (если flex контейнер)
    const displayStyle = computedStyle.display;
    if (displayStyle.includes('flex')) {
      const flexLabel = document.createElement('label');
      flexLabel.style.fontSize = '11px';
      flexLabel.style.fontWeight = '600';
      flexLabel.style.color = 'var(--editor-text-muted)';
      flexLabel.textContent = 'FLEXBOX ВЫРАВНИВАНИЕ';
      layoutContent.appendChild(flexLabel);

      // Justify Content
      const justifyGroup = document.createElement('div');
      justifyGroup.className = 'editor-field-group';
      justifyGroup.innerHTML = `
        <label>Распределение (Justify)</label>
        <select class="editor-select">
          <option value="flex-start" ${computedStyle.justifyContent === 'flex-start' ? 'selected' : ''}>В начале</option>
          <option value="center" ${computedStyle.justifyContent === 'center' ? 'selected' : ''}>По центру</option>
          <option value="flex-end" ${computedStyle.justifyContent === 'flex-end' ? 'selected' : ''}>В конце</option>
          <option value="space-between" ${computedStyle.justifyContent === 'space-between' ? 'selected' : ''}>По краям</option>
          <option value="space-around" ${computedStyle.justifyContent === 'space-around' ? 'selected' : ''}>Равномерно</option>
        </select>
      `;
      justifyGroup.querySelector('select').addEventListener('change', (e) => {
        el.style.justifyContent = e.target.value;
      });
      layoutContent.appendChild(justifyGroup);

      // Align Items
      const alignGroup = document.createElement('div');
      alignGroup.className = 'editor-field-group';
      alignGroup.innerHTML = `
        <label>Выравнивание (Align)</label>
        <select class="editor-select">
          <option value="flex-start" ${computedStyle.alignItems === 'flex-start' ? 'selected' : ''}>Сверху</option>
          <option value="center" ${computedStyle.alignItems === 'center' ? 'selected' : ''}>По центру</option>
          <option value="flex-end" ${computedStyle.alignItems === 'flex-end' ? 'selected' : ''}>Снизу</option>
          <option value="stretch" ${computedStyle.alignItems === 'stretch' ? 'selected' : ''}>Растянуть</option>
        </select>
      `;
      alignGroup.querySelector('select').addEventListener('change', (e) => {
        el.style.alignItems = e.target.value;
      });
      layoutContent.appendChild(alignGroup);

      // Gap Slider
      const curGap = el.style.gap || computedStyle.gap;
      const parsedGap = parseStyleValue(curGap, 0, 'px');
      const gapSlider = createSliderControl('Расстояние (Gap)', 0, 100, 1, parsedGap.num, parsedGap.unit, (val) => {
        el.style.gap = val + parsedGap.unit;
      });
      layoutContent.appendChild(gapSlider);
    }

    // Ширина и Высота
    const dimensionsRow = document.createElement('div');
    dimensionsRow.className = 'editor-field-row';
    
    // Width
    const widthCell = document.createElement('div');
    widthCell.className = 'editor-field-group';
    widthCell.innerHTML = `
      <label>Ширина</label>
      <input type="text" class="editor-input" value="${el.style.width || computedStyle.width}" placeholder="auto, 100%...">
    `;
    widthCell.querySelector('input').addEventListener('input', (e) => {
      el.style.width = e.target.value;
    });
    dimensionsRow.appendChild(widthCell);

    // Height / Min Height
    const heightCell = document.createElement('div');
    heightCell.className = 'editor-field-group';
    const isHero = el.classList.contains('hero') || el.classList.contains('featured-work') || el.classList.contains('work-slide');
    const heightProp = isHero ? 'minHeight' : 'height';
    const heightPropCss = isHero ? 'min-height' : 'height';
    
    heightCell.innerHTML = `
      <label>${isHero ? 'Мин. Высота' : 'Высота'}</label>
      <input type="text" class="editor-input" value="${el.style[heightProp] || computedStyle[heightPropCss]}" placeholder="auto, 100svh...">
    `;
    heightCell.querySelector('input').addEventListener('input', (e) => {
      el.style[heightProp] = e.target.value;
    });
    dimensionsRow.appendChild(heightCell);
    
    layoutContent.appendChild(dimensionsRow);
    container.appendChild(layoutAcc);

    // Вкладка 2: Типографика и Шрифты (Typography)
    if (el.getAttribute('contenteditable') === 'true') {
      const { element: fontAcc, contentContainer: fontContent } = createAccordionSection('Шрифты и Текст', true);
      
      // Выравнивание текста
      const textAlignGroup = document.createElement('div');
      textAlignGroup.className = 'editor-field-group';
      textAlignGroup.innerHTML = `
        <label>Выравнивание текста</label>
        <div class="editor-button-group">
          <button data-align="left" class="${computedStyle.textAlign === 'left' ? 'active' : ''}">Влево</button>
          <button data-align="center" class="${computedStyle.textAlign === 'center' ? 'active' : ''}">Центр</button>
          <button data-align="right" class="${computedStyle.textAlign === 'right' ? 'active' : ''}">Вправо</button>
          <button data-align="justify" class="${computedStyle.textAlign === 'justify' ? 'active' : ''}">Ширина</button>
        </div>
      `;
      textAlignGroup.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          textAlignGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          el.style.textAlign = btn.dataset.align;
        });
      });
      fontContent.appendChild(textAlignGroup);

      // Размер шрифта Slider
      const curFontSize = el.style.fontSize || computedStyle.fontSize;
      const parsedFontSize = parseStyleValue(curFontSize, 16, 'px');
      const fontSlider = createSliderControl('Размер шрифта', 8, 120, 1, parsedFontSize.num, parsedFontSize.unit, (val) => {
        el.style.fontSize = val + parsedFontSize.unit;
      });
      fontContent.appendChild(fontSlider);

      // Высота строки (Line Height)
      const curLineHeight = el.style.lineHeight || computedStyle.lineHeight;
      const parsedLH = parseStyleValue(curLineHeight, 1.2, '');
      const lhSlider = createSliderControl('Высота строки (Line Height)', 0.8, 3, 0.1, parsedLH.num, parsedLH.unit, (val) => {
        el.style.lineHeight = val + parsedLH.unit;
      });
      fontContent.appendChild(lhSlider);

      // Межбуквенный интервал (Letter Spacing)
      const curLetterSpacing = el.style.letterSpacing || computedStyle.letterSpacing;
      const parsedLS = parseStyleValue(curLetterSpacing, 0, 'em');
      const lsSlider = createSliderControl('Межбуквенный интервал', -0.1, 1, 0.01, parsedLS.num, parsedLS.unit, (val) => {
        el.style.letterSpacing = val + parsedLS.unit;
      });
      fontContent.appendChild(lsSlider);

      // Толщина шрифта (Font Weight)
      const weightGroup = document.createElement('div');
      weightGroup.className = 'editor-field-group';
      const curWeight = computedStyle.fontWeight;
      weightGroup.innerHTML = `
        <label>Толщина шрифта</label>
        <select class="editor-select">
          <option value="100" ${curWeight === '100' ? 'selected' : ''}>100 Thin</option>
          <option value="300" ${curWeight === '300' ? 'selected' : ''}>300 Light</option>
          <option value="400" ${curWeight === '400' ? 'selected' : ''}>400 Regular</option>
          <option value="500" ${curWeight === '500' ? 'selected' : ''}>500 Medium</option>
          <option value="600" ${curWeight === '600' ? 'selected' : ''}>600 Semi-Bold</option>
          <option value="700" ${curWeight === '700' ? 'selected' : ''}>700 Bold</option>
          <option value="900" ${curWeight === '900' ? 'selected' : ''}>900 Black</option>
        </select>
      `;
      weightGroup.querySelector('select').addEventListener('change', (e) => {
        el.style.fontWeight = e.target.value;
      });
      fontContent.appendChild(weightGroup);

      // Семейство шрифтов (Font Family)
      const familyGroup = document.createElement('div');
      familyGroup.className = 'editor-field-group';
      const curFamily = computedStyle.fontFamily;
      familyGroup.innerHTML = `
        <label>Семейство шрифтов</label>
        <select class="editor-select">
          <option value="var(--sans)" ${curFamily.includes('Inter') ? 'selected' : ''}>Inter (Sans-Serif)</option>
          <option value="var(--serif)" ${curFamily.includes('Iowan') || curFamily.includes('Cormorant') ? 'selected' : ''}>Iowan Old Style (Serif)</option>
          <option value="monospace" ${curFamily.includes('monospace') ? 'selected' : ''}>Monospace</option>
        </select>
      `;
      familyGroup.querySelector('select').addEventListener('change', (e) => {
        el.style.fontFamily = e.target.value;
      });
      fontContent.appendChild(familyGroup);

      container.appendChild(fontAcc);
    }

    // Вкладка 3: Стили и Цвет (Colors & Borders)
    const { element: styleAcc, contentContainer: styleContent } = createAccordionSection('Цвета и Стили');
    
    // Цвет текста
    const colorGroup = document.createElement('div');
    colorGroup.className = 'editor-field-group';
    const currentColor = rgb2hex(computedStyle.color);
    colorGroup.innerHTML = `
      <label>Цвет текста</label>
      <div class="editor-color-picker-container">
        <input type="color" class="editor-color-picker-input" value="${currentColor}">
        <input type="text" class="editor-input" value="${currentColor}" style="flex-grow: 1;">
      </div>
    `;
    const cpText = colorGroup.querySelector('input[type="color"]');
    const ctText = colorGroup.querySelector('input[type="text"]');
    cpText.addEventListener('input', (e) => {
      el.style.color = e.target.value;
      ctText.value = e.target.value;
    });
    ctText.addEventListener('input', (e) => {
      el.style.color = e.target.value;
      cpText.value = e.target.value;
    });
    styleContent.appendChild(colorGroup);

    // Цвет фона
    const bgGroup = document.createElement('div');
    bgGroup.className = 'editor-field-group';
    const currentBg = rgb2hex(computedStyle.backgroundColor);
    bgGroup.innerHTML = `
      <label>Цвет фона</label>
      <div class="editor-color-picker-container">
        <input type="color" class="editor-color-picker-input" value="${currentBg}">
        <input type="text" class="editor-input" value="${currentBg}" style="flex-grow: 1;">
      </div>
    `;
    const cpBg = bgGroup.querySelector('input[type="color"]');
    const ctBg = bgGroup.querySelector('input[type="text"]');
    cpBg.addEventListener('input', (e) => {
      el.style.backgroundColor = e.target.value;
      ctBg.value = e.target.value;
    });
    ctBg.addEventListener('input', (e) => {
      el.style.backgroundColor = e.target.value;
      cpBg.value = e.target.value;
    });
    styleContent.appendChild(bgGroup);

    // Бордюр (Граница)
    const borderGroup = document.createElement('div');
    borderGroup.className = 'editor-field-group';
    borderGroup.innerHTML = `
      <label>Стиль границы</label>
      <select class="editor-select">
        <option value="none" ${computedStyle.borderStyle === 'none' ? 'selected' : ''}>Без границы</option>
        <option value="solid" ${computedStyle.borderStyle === 'solid' ? 'selected' : ''}>Сплошная</option>
        <option value="dashed" ${computedStyle.borderStyle === 'dashed' ? 'selected' : ''}>Пунктир</option>
        <option value="dotted" ${computedStyle.borderStyle === 'dotted' ? 'selected' : ''}>Точки</option>
      </select>
    `;
    borderGroup.querySelector('select').addEventListener('change', (e) => {
      el.style.borderStyle = e.target.value;
    });
    styleContent.appendChild(borderGroup);

    // Толщина бордюра
    const borderWidthVal = el.style.borderWidth || computedStyle.borderWidth;
    const parsedBorderWidth = parseStyleValue(borderWidthVal, 0, 'px');
    const borderWidthSlider = createSliderControl('Толщина границы', 0, 10, 1, parsedBorderWidth.num, parsedBorderWidth.unit, (val) => {
      el.style.borderWidth = val + parsedBorderWidth.unit;
    });
    styleContent.appendChild(borderWidthSlider);

    // Скругление углов (Border Radius)
    const borderRadiusVal = el.style.borderRadius || computedStyle.borderRadius;
    const parsedBR = parseStyleValue(borderRadiusVal, 0, 'px');
    const brSlider = createSliderControl('Скругление углов', 0, 100, 1, parsedBR.num, parsedBR.unit, (val) => {
      el.style.borderRadius = val + parsedBR.unit;
    });
    styleContent.appendChild(brSlider);

    // Прозрачность (Opacity)
    const curOpacity = computedStyle.opacity ? parseFloat(computedStyle.opacity) : 1;
    const opacitySlider = createSliderControl('Непрозрачность', 0, 1, 0.05, curOpacity, '', (val) => {
      el.style.opacity = val;
    });
    styleContent.appendChild(opacitySlider);

    container.appendChild(styleAcc);

    // Вкладка 4: Ссылки (для кнопок и ссылок)
    if (tagName === 'a' || tagName === 'button') {
      const { element: linkAcc, contentContainer: linkContent } = createAccordionSection('Настройки Ссылки', true);
      const linkGroup = document.createElement('div');
      linkGroup.className = 'editor-field-group';
      
      const currentHref = el.getAttribute('href') || '';
      
      linkGroup.innerHTML = `
        <label>Куда ведет ссылка (URL)</label>
        <input type="text" class="editor-input" value="${currentHref}" placeholder="Например: https://t.me/blackcarp_bot">
      `;
      
      linkGroup.querySelector('input').addEventListener('input', (e) => {
        el.setAttribute('href', e.target.value);
      });
      linkContent.appendChild(linkGroup);
      container.appendChild(linkAcc);
    }

    // Вкладка 5: Изображение и Видео (для img и video)
    if (tagName === 'img' || tagName === 'video') {
      const { element: mediaAcc, contentContainer: mediaContent } = createAccordionSection('Медиа и Фильтры', true);
      
      // Кнопка выбора файла
      const mediaGroup = document.createElement('div');
      mediaGroup.className = 'editor-field-group';
      mediaGroup.innerHTML = `
        <button class="editor-btn editor-btn-primary" style="justify-content: center; width: 100%;">📷 Выбрать новый файл</button>
      `;
      mediaGroup.querySelector('button').addEventListener('click', () => {
        mediaFileInput.click();
      });
      mediaContent.appendChild(mediaGroup);

      // Alt текст (для img)
      if (tagName === 'img') {
        const altGroup = document.createElement('div');
        altGroup.className = 'editor-field-group';
        altGroup.innerHTML = `
          <label>Альтернативный текст (alt)</label>
          <input type="text" class="editor-input" value="${el.getAttribute('alt') || ''}" placeholder="Описание изображения для SEO">
        `;
        altGroup.querySelector('input').addEventListener('input', (e) => {
          el.setAttribute('alt', e.target.value);
        });
        mediaContent.appendChild(altGroup);
      }

      // Настройки заполнения (Object Fit)
      const fitGroup = document.createElement('div');
      fitGroup.className = 'editor-field-group';
      fitGroup.innerHTML = `
        <label>Масштабирование (Object Fit)</label>
        <select class="editor-select">
          <option value="cover" ${computedStyle.objectFit === 'cover' ? 'selected' : ''}>Заполнение (Cover)</option>
          <option value="contain" ${computedStyle.objectFit === 'contain' ? 'selected' : ''}>Вписать (Contain)</option>
          <option value="fill" ${computedStyle.objectFit === 'fill' ? 'selected' : ''}>Растянуть (Fill)</option>
          <option value="none" ${computedStyle.objectFit === 'none' ? 'selected' : ''}>Оригинал</option>
        </select>
      `;
      fitGroup.querySelector('select').addEventListener('change', (e) => {
        el.style.objectFit = e.target.value;
      });
      mediaContent.appendChild(fitGroup);

      // Фильтры (Яркость, Контрастность, Насыщенность)
      const filterLabel = document.createElement('label');
      filterLabel.style.fontSize = '11px';
      filterLabel.style.fontWeight = '600';
      filterLabel.style.color = 'var(--editor-text-muted)';
      filterLabel.style.marginTop = '10px';
      filterLabel.textContent = 'ЦВЕТОВЫЕ ФИЛЬТРЫ';
      mediaContent.appendChild(filterLabel);

      const filters = parseFilters(el.style.filter || computedStyle.filter);

      const applyImgFilters = () => {
        el.style.filter = `brightness(${filters.brightness}) contrast(${filters.contrast}) saturate(${filters.saturate})`;
      };

      // Brightness Slider
      const bSlider = createSliderControl('Яркость', 0.2, 2, 0.05, filters.brightness, '', (val) => {
        filters.brightness = val;
        applyImgFilters();
      });
      mediaContent.appendChild(bSlider);

      // Contrast Slider
      const cSlider = createSliderControl('Контрастность', 0.2, 2, 0.05, filters.contrast, '', (val) => {
        filters.contrast = val;
        applyImgFilters();
      });
      mediaContent.appendChild(cSlider);

      // Saturation Slider
      const sSlider = createSliderControl('Насыщенность', 0, 2, 0.05, filters.saturate, '', (val) => {
        filters.saturate = val;
        applyImgFilters();
      });
      mediaContent.appendChild(sSlider);

      container.appendChild(mediaAcc);
    }

    // Вкладка 6: Управление контентом внутри блока (Actions)
    const { element: actionAcc, contentContainer: actionContent } = createAccordionSection('Действия');
    
    // Кнопка дублирования элемента
    if (!el.classList.contains('editor-block')) {
      const duplicateElementGroup = document.createElement('div');
      duplicateElementGroup.innerHTML = `
        <button class="editor-btn" style="width: 100%; justify-content: center; margin-bottom: 10px;">📋 Дублировать элемент</button>
      `;
      duplicateElementGroup.querySelector('button').addEventListener('click', () => {
        const clone = el.cloneNode(true);
        clone.classList.remove('editor-selected-element');
        el.parentNode.insertBefore(clone, el.nextSibling);
        initEditableStructure();
        selectElement(clone);
        showToast('Элемент продублирован');
      });
      actionContent.appendChild(duplicateElementGroup);

      // Удаление элемента
      const deleteElementGroup = document.createElement('div');
      deleteElementGroup.innerHTML = `
        <button class="editor-btn editor-btn-danger" style="width: 100%; justify-content: center;">🗑️ Удалить элемент</button>
      `;
      deleteElementGroup.querySelector('button').addEventListener('click', () => {
        if (confirm('Вы уверены, что хотите удалить этот элемент?')) {
          el.remove();
          clearSelection();
          showToast('Элемент удален');
        }
      });
      actionContent.appendChild(deleteElementGroup);
    } else {
      // Для блока - кнопка добавления элемента внутрь
      const addContentGroup = document.createElement('div');
      addContentGroup.className = 'editor-field-group';
      addContentGroup.innerHTML = `
        <label>Добавить элемент внутрь блока</label>
        <select class="editor-select">
          <option value="" disabled selected>Выберите элемент...</option>
          <option value="h3">Заголовок H3</option>
          <option value="p">Абзац текста</option>
          <option value="button">Кнопка-ссылка</option>
        </select>
      `;
      addContentGroup.querySelector('select').addEventListener('change', (e) => {
        const type = e.target.value;
        let newEl;
        
        if (type === 'h3') {
          newEl = document.createElement('h3');
          newEl.textContent = 'Новый заголовок';
        } else if (type === 'p') {
          newEl = document.createElement('p');
          newEl.textContent = 'Новый абзац текста для подробного описания.';
        } else if (type === 'button') {
          newEl = document.createElement('button');
          newEl.className = 'line-cta';
          newEl.innerHTML = '<span>Кнопка</span><svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
        }

        if (newEl) {
          const caption = el.querySelector('.work-caption') || el;
          caption.appendChild(newEl);
          initEditableStructure();
          selectElement(newEl);
          showToast('Элемент добавлен');
        }
        e.target.value = ''; 
      });
      actionContent.appendChild(addContentGroup);
    }
    container.appendChild(actionAcc);
  }

  // 5. ОБРАБОТКА ЗАГРУЗКИ ФАЙЛОВ ДЛЯ МЕДИА
  
  mediaFileInput.addEventListener('change', async (e) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedElement) return;

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('media', file);

    const prevSrc = selectedElement.src;
    
    try {
      selectedElement.style.opacity = '0.5';
      showToast('Загрузка медиафайла...');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        if (selectedElement.tagName.toLowerCase() === 'video') {
          const source = selectedElement.querySelector('source');
          if (source) source.src = data.url;
          else selectedElement.src = data.url;
          selectedElement.load();
        } else {
          selectedElement.src = data.url;
        }
        showToast('Файл успешно загружен и заменен!');
        renderInspectorForm(selectedElement);
      } else {
        throw new Error(data.error || 'Ошибка при загрузке');
      }
    } catch (error) {
      console.error(error);
      selectedElement.src = prevSrc;
      showToast(error.message, true);
    } finally {
      selectedElement.style.opacity = '1';
      mediaFileInput.value = '';
    }
  });

  // 6. МЕНЮ БИБЛИОТЕКИ БЛОКОВ
  
  function openBlockModal() {
    const container = document.getElementById('presets-container');
    container.innerHTML = '';

    blockPresets.forEach(preset => {
      const card = document.createElement('button');
      card.className = 'editor-preset-card';
      card.innerHTML = `
        <span class="editor-preset-card-title">${preset.title}</span>
        <span class="editor-preset-card-desc">${preset.desc}</span>
      `;
      card.addEventListener('click', () => {
        insertNewBlock(preset.html);
        closeBlockModal();
      });
      container.appendChild(card);
    });

    modalOverlay.style.display = 'flex';
  }

  function closeBlockModal() {
    modalOverlay.style.display = 'none';
  }

  modalOverlay.querySelector('.editor-modal-close').addEventListener('click', closeBlockModal);

  function insertNewBlock(htmlString) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString.trim();
    const newBlock = tempDiv.firstChild;

    const homeView = document.querySelector('.view-home');
    if (!homeView || !activeBlock) return;

    if (blockInsertIndex === 'before') {
      homeView.insertBefore(newBlock, activeBlock);
    } else {
      homeView.insertBefore(newBlock, activeBlock.nextSibling);
    }

    initEditableStructure();
    selectElement(newBlock);
    showToast('Блок успешно добавлен');
  }

  // 7. СОХРАНЕНИЕ ИЗМЕНЕНИЙ НА СЕРВЕР
  
  document.getElementById('editor-save-btn').addEventListener('click', async () => {
    const btn = document.getElementById('editor-save-btn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Сохранение...';
    btn.disabled = true;

    try {
      // Клонируем документ для очистки от мусора редактора
      const docClone = document.documentElement.cloneNode(true);

      // Удаляем инжектированные скрипты и стили редактора
      const removeSelectors = [
        '.editor-toolbar', 
        '.editor-inspector',
        '.editor-toast',
        '.editor-modal-overlay',
        'script[src="/editor/editor.js"]',
        'link[href="/editor/editor.css"]',
        'input[type="file"]'
      ];
      removeSelectors.forEach(selector => {
        docClone.querySelectorAll(selector).forEach(el => el.remove());
      });

      // Очищаем оверлеи блоков и разделители
      docClone.querySelectorAll('.editor-block-controls').forEach(el => el.remove());
      docClone.querySelectorAll('.editor-add-block-separator').forEach(el => el.remove());

      // Убираем классы и атрибуты редактирования
      docClone.querySelectorAll('[contenteditable="true"]').forEach(el => {
        el.removeAttribute('contenteditable');
        el.classList.remove('editor-editable-text');
        if (el.classList.length === 0) el.removeAttribute('class');
      });

      docClone.querySelectorAll('.editor-block').forEach(el => {
        el.classList.remove('editor-block');
        if (el.classList.length === 0) el.removeAttribute('class');
      });

      docClone.querySelectorAll('.editor-selected-element').forEach(el => {
        el.classList.remove('editor-selected-element');
        if (el.classList.length === 0) el.removeAttribute('class');
      });

      const body = docClone.querySelector('body');
      if (body) {
        body.classList.remove('editor-active');
        if (body.classList.length === 0) body.removeAttribute('class');
      }

      const finalHtml = '<!doctype html>\n' + docClone.outerHTML;

      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: finalHtml })
      });

      const data = await response.json();
      
      if (data.success) {
        showToast('Все изменения успешно сохранены!');
      } else {
        throw new Error(data.error || 'Ошибка при сохранении на сервере');
      }

    } catch (error) {
      console.error(error);
      showToast('Ошибка сохранения: ' + error.message, true);
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });

  // Выход из редактора
  document.getElementById('editor-exit-btn').addEventListener('click', () => {
    window.location.href = '/';
  });

  initEditableStructure();
});
