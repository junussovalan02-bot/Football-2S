# Azzurri Arcade

Ретро-аркадный футбол в духе Goal 3 (Dendy): «Наполи» против «Ромы», вид сбоку, чиби-игроки,
подкаты без правил, погода с лужами и молниями, шкала FURIA и супер-удары FUOCO, VESUVIO и GOLFO.

## Запуск
```
npx --yes serve -l 8080 .
```
Открыть http://localhost:8080 (на телефоне — по адресу компьютера в той же Wi-Fi сети).

Проверить онлайн без сервера: открыть `http://localhost:8080/?net=local` в двух вкладках.

Собрать один HTML-файл: `python3 tools/build-single.py` → `dist/azzurri-arcade.html`.

Автотест на размерах телефона: `python3 tools/playtest.py` → скриншоты в `playtest/`
(один раз нужно: `pip install playwright && python3 -m playwright install chromium`).

## Документация
- `docs/GDD.md` — геймдизайн-документ с референсами и картинками
- `docs/research/` — разбор Goal 3, Nintendo World Cup, Goal! Two, конкурентов и аудит нашей игры
- `docs/DESIGN.md` — правила, управление, супер-удары, ИИ
- `docs/ONLINE.md` — как устроен онлайн и план входа по коду
- `CLAUDE.md` — устройство проекта, агенты и задачи (для Claude Code)

## Агенты Claude Code (`.claude/agents/`)
- **game-designer** — придумывает и описывает механики, следит за документами
- **pixel-art-director** — спрайты, анимации, интерфейс, проверка стиля по скриншотам
- **playtester** — гоняет автотест, проверяет онлайн в двух вкладках, пишет баг-репорты
