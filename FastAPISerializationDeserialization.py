from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

app = FastAPI()

class Data(BaseModel):
    value: str

@app.post("/data")
async def handle_data(data: Data): # Deserialization: JSON -> Data object
    processed_data = {"message": f"Received: {data.value}"}
    return processed_data # Serialization: Data object -> JSON

if __name__ == '__main__':
    uvicorn.run(app)