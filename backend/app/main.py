import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .rate_limit import limiter
from .routes import admin, auth, categories, stats, transactions
from .seed import seed_initial_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is managed by Alembic migrations (see backend/alembic/) — run
    # `alembic upgrade head` before starting the app instead of relying on
    # create_all().
    seed_initial_data()
    yield


app = FastAPI(title="Group Ledger API", version="1.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(categories.router)
app.include_router(stats.router)
app.include_router(admin.router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
