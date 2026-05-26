"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

import backend.deps as deps
from backend.config import SQLITE_DB_PATH
from backend.graph.builder import build_graph
from backend.routers import session, graph, media


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSqliteSaver.from_conn_string(SQLITE_DB_PATH) as saver:
        deps.checkpointer = saver
        await deps.checkpointer.setup()
        builder = build_graph()
        deps.compiled_graph = builder.compile(checkpointer=deps.checkpointer)
        yield


app = FastAPI(title="智能口播稿生成器", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(session.router)
app.include_router(graph.router)
app.include_router(media.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
