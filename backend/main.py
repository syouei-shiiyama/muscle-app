from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from presets import PRESET_TARGETS

app = FastAPI()

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# フロントのパス
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# /static で frontend/ を配信
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

# "/" にアクセスで index.html を返す
@app.get("/")
def read_root():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

# プリセット一覧を返すAPI
@app.get("/presets")
def get_presets():
    return PRESET_TARGETS
