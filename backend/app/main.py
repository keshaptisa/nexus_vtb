import threading

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from app.api import assistant, channels, demo, learning, metrics, payments, shield, sos
from app.services import store
from app.services.bank import bank

app = FastAPI(title="nexus · Старт", version="0.1.0", description="Контракты: docs/api.md")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (demo, payments, sos, shield, learning, assistant, channels, metrics):
    app.include_router(module.router)


@app.middleware("http")
async def persist_bank(request: Request, call_next):
    """После изменяющего запроса сохраняем затронутые аккаунты в PostgreSQL."""
    response = await call_next(request)
    if request.method != "GET":
        await run_in_threadpool(store.save, bank.take_touched())
    return response


@app.on_event("startup")
def warm_up_ocr():
    """Модель распознавания скриншотов грузится ~20 с — делаем это в фоне при старте, а не на первом запросе."""
    from app.services import shield

    def load():
        try:
            shield._ocr_reader()
        except shield.OcrUnavailable:
            pass

    threading.Thread(target=load, daemon=True).start()


@app.get("/api/health")
def health():
    return {"status": "ok"}
