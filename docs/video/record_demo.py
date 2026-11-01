"""Черновое видео демо (до 3 минут): главная с комиксом → Артём → Соня → Лев → «Что видит банк». Подписи — оверлеем поверх страницы.

    pip install playwright && playwright install chromium ffmpeg
    docker compose up                       # сайт на http://localhost:5173
    python docs/video/record_demo.py docs/video/raw
    ffmpeg -i docs/video/raw/*.webm -c:v libx264 -crf 26 -pix_fmt yuv420p -movflags +faststart docs/video/demo.mp4

Сценарии проигрываются сами: в окнах жмётся главная кнопка, на экране перехвата — пауза, к «Безопасному выходу»
прикрепляется chat_evidence.png. Тексты подписей — в вызовах play() ниже.
"""
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
OUT = Path(sys.argv[1])
OUT.mkdir(exist_ok=True)
W, H = 1440, 900
EVIDENCE = str(Path(__file__).with_name("chat_evidence.png"))  # «скриншот переписки» для доказательств

CAPTION_JS = """
(text) => {
  let el = document.getElementById('__cap');
  if (!el) {
    el = document.createElement('div');
    el.id = '__cap';
    el.style.cssText = 'position:fixed;left:24px;bottom:96px;z-index:99999;max-width:560px;padding:14px 18px;border-radius:18px;' +
      'background:rgba(22,23,29,.88);color:#fff;font:600 17px/1.4 Manrope,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);transition:opacity .3s';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = text ? '1' : '0';
}
"""

t0 = time.time()


def cap(page, text):
    page.evaluate(CAPTION_JS, text)


def play(page, pid, captions, max_s, skip_quest=True):
    """Проигрываем сценарий: в окнах жмём главную кнопку с паузой, сторис листаем, квест закрываем."""
    page.request.post(f"{BASE}/api/personas/{pid}/reset")
    page.goto(f"{BASE}/u/{pid}")
    page.wait_for_timeout(600)
    cap(page, captions.get("start", ""))
    page.wait_for_timeout(2500)
    page.get_by_text("Проиграть сценарий").click()
    start = time.time()
    shown = set()
    n = 0
    idle = 0
    while time.time() - start < max_s:
        page.wait_for_timeout(1200)
        dlg = page.locator("[role=dialog]")
        if dlg.count():
            idle = 0
            viewer = dlg.last.get_attribute("data-viewer")
            if viewer == "story":
                page.wait_for_timeout(2500)
                page.keyboard.press("Escape")
                continue
            if viewer == "quest":
                page.keyboard.press("Escape")
                continue
            n += 1
            text = dlg.last.inner_text()
            hold = 2600
            for key, c in captions.items():
                if isinstance(key, str) and key != "start" and key in text and key not in shown:
                    cap(page, c)
                    shown.add(key)
                    hold = 4200
                    break
            if "Перевод остановлен" in text:
                hold = 7500  # главный экран — даём прочитать причины
            page.wait_for_timeout(hold)
            upload = dlg.last.locator("input[type=file][multiple]")
            if upload.count():
                upload.first.set_input_files(EVIDENCE)
                page.wait_for_timeout(2500)
                continue
            btn = dlg.last.locator("button.btn-primary")
            if btn.count():
                label = btn.first.inner_text()
                if skip_quest and "Квест" in label:
                    break
                btn.first.click()
            else:
                page.keyboard.press("Escape")
            continue
        if page.get_by_text("Сценарий пройден").count():
            break
        idle += 1
        if idle >= 3 and page.get_by_text("Пропустить шаг").count():
            try:  # кнопку может перекрыть появившееся окно — тогда просто ждём дальше
                page.get_by_text("Пропустить шаг").click(timeout=2000)
            except Exception:
                pass
            idle = 0
    page.wait_for_timeout(1500)
    page.keyboard.press("Escape")


with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width": W, "height": H}, record_video_dir=str(OUT), record_video_size={"width": W, "height": H})
    page = ctx.new_page()

    # Главная: первый экран, затем прокрутка — развороты комикса перелистываются справа налево
    page.goto(f"{BASE}/")
    page.wait_for_timeout(800)
    cap(page, "«Старт» — раздел ВТБ Онлайн для 14–22 лет: буфер между детским и взрослым банком.")
    page.wait_for_timeout(4000)
    cap(page, "Прокручиваем вниз — история разворачивается комиксом.")
    # плавно прокручиваем до конца комикса (экраны «comic-*»), примерно по 4 секунды на разворот
    page.evaluate(
        """async () => {
          const deck = document.getElementById('deck')
          const ids = deck.dataset.slides.split(',')
          const last = ids.filter((x) => x.startsWith('comic-')).length
          const total = deck.offsetHeight - innerHeight
          const end = deck.offsetTop + (total * last) / (ids.length - 1)
          const start = scrollY, ms = last * 4200, t0 = performance.now()
          await new Promise((done) => {
            const step = (t) => {
              const k = Math.min(1, (t - t0) / ms)
              scrollTo(0, start + (end - start) * k)
              k < 1 ? requestAnimationFrame(step) : done()
            }
            requestAnimationFrame(step)
          })
        }"""
    )
    cap(page, "")
    page.wait_for_timeout(1200)

    play(page, "artem", {
        "start": "Артём, 16 лет. В мессенджере ему предлагают «подработку без опыта».",
        "Необычное зачисление": "От незнакомца пришло 30 000 ₽ — в разы больше обычного. Банк помечает зачисление и предупреждает, но не блокирует.",
        "Вас просят перевести": "Вербовщик просит переслать 27 000 ₽ на номер из чата.",
        "Перевод остановлен": "Перехват: CatBoost видит транзит — деньги незнакомца уходят дальше через минуту. Причины — человеческим языком.",
        "Вас торопят": "Вербовщик давит. Банк объясняет приём и ведёт к «Безопасному выходу».",
        "ничего не делал": "«Безопасный выход»: план по шагам, большинство — одной кнопкой. Под шагами — основание со ссылками на закон.",
        "Сценарий пройден": "Итог без осуждения: деньги заморожены, обращение со скриншотами ушло в банк.",
    }, max_s=80)

    play(page, "sonya", {
        "start": "Соня, 13 лет, «Детский банк». В 14 лет детский продукт обычно просто заканчивается.",
        "Через неделю": "За неделю до дня рождения банк объясняет, что изменится.",
        "С днём рождения": "Переход в одно касание: мама подтверждает в своём приложении, копилка и опыт переносятся.",
        "важное про вашу карту": "Первая история в «Старте» — почему нельзя отдавать свою карту.",
    }, max_s=30)

    play(page, "lev", {
        "start": "Лев, 15 лет. В банке у него только «Пушкинская карта».",
        "Пушкинской карте": "Витрина «Старта»: своя карта за минуту.",
        "выкуп": "Пишут: «куплю баланс Пушкинской». Банк предупреждает: законно её не обналичить, за этим кража или фиктивные концерты.",
        "первую цель": "Первое пополнение — и сразу первая цель в копилке.",
        "Сценарий пройден": "Держатель «Пушкинской карты» стал клиентом банка через «Старт».",
    }, max_s=45)

    # Что видит банк: полные метрики профиля после перехвата
    page.request.post(f"{BASE}/api/personas/artem/reset")
    page.request.post(f"{BASE}/api/payments/topup", data={"persona_id": "artem", "sender": "Неизвестный", "amount": 30000})
    page.goto(f"{BASE}/u/artem")
    page.wait_for_timeout(800)
    cap(page, "«Что видит банк»: профиль клиента — обычные суммы, свои отправители, скорость транзита — и сигналы риска.")
    page.get_by_text("Подробнее").first.click()
    page.wait_for_timeout(6000)
    cap(page, "Решения принимают модели, LLM только объясняет. Данные синтетические, модели переобучаются на данных банка.")
    page.wait_for_timeout(4500)

    ctx.close()
    b.close()
print(f"recorded {time.time() - t0:.0f}s")
