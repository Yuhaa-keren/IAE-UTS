from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

app = FastAPI()

# Define a data model using Pydantic
class Item(BaseModel):
    id: int
    name: str

items = {
    1: Item(id=1, name="Item 1"),
    2: Item(id=2, name="Item 2")
}

# Example: GET request to retrieve all items
@app.get("/items")
async def get_items():
    return list(items.values())

# Example: GET request to retrieve a specific item by ID
@app.get("/items/{item_id}")
async def get_item(item_id: int):
    if item_id not in items:
        raise HTTPException(status_code=404, detail="Item not found")
    return items[item_id]

# Example: POST request to create a new item
@app.post("/items")
async def create_item(item: Item):
    if item.id in items:
         raise HTTPException(status_code=400, detail="Item with this ID already exists")
    items[item.id] = item
    return item, 201

if __name__ == '__main__':
    uvicorn.run(app)