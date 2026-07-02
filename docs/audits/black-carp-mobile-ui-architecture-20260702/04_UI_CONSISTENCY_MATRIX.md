# UI Consistency Matrix

| Area | Current Behavior | Problem |
|---|---|---|
| Page model | Sections are toggled with classes | Looks like app prototype, not real site pages |
| URL/state | URL stays `/` for every section | No deep links, no browser history |
| Navigation state | Active state is CSS class only | No semantic `aria-current` |
| Typography | Fonts are declared but not loaded | Android/browser fallback can change the whole look |
| Heading hierarchy | Home has `h1`, other screens use `h2` | Screens are not treated as independent pages |
| Icons | Calendar icon for "Запись", grid icon for fullscreen works | Icons describe the wrong mental model |
| Scroll | Home uses page scroll, works uses internal scroll | Inconsistent gesture model |
| Scrollbars | Hidden globally | User loses scroll affordance |
| Grain | Global overlay above UI | Text/nav get dirty, not premium |
| Focus | Nav outline removed | Keyboard/focus state is weak |

