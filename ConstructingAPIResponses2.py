from fastapi import FastAPI, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

app = FastAPI()

class Message(BaseModel):
    message: str

@app.get("/items/{item_id}")
async def read_item(item_id: int, response: Response):
    items = {
        1: {"id": 1, "name": "Item 1"},
        2: {"id": 2, "name": "Item 2"},
    }
    item = items.get(item_id)
    if item:
        return item
    else:
        response.status_code = status.HTTP_404_NOT_FOUND  # Use status codes from starlette.status
        return {"message": "Item not found"}

@app.get("/custom_response", response_model=Message) # Specifying response model for documentation and validation
async def custom_response():
    content = {"message": "This is a custom response"}
    headers = {"X-Custom-Header": "Custom Value"}
    return JSONResponse(content=content, headers=headers, status_code=status.HTTP_200_OK)

if __name__ == '_main__':
    uvicorn.run(app)