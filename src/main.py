from pathlib import Path
from typing import Union

from fastapi import FastAPI

app = FastAPI()
INCOMING = Path(__file__).parent.parent / "data" / "incoming"
OUTGOING = Path(__file__).parent.parent / "data" / "outgoing"


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}


@app.get("/incoming")
def incoming():
    return {"files": [str(f) for f in INCOMING.iterdir()]}


@app.get("/outgoing")
def outgoing():
    return {"files": [str(f) for f in OUTGOING.iterdir()]}
