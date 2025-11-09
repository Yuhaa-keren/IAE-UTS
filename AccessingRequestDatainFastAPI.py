from fastapi import FastAPI, Query, UploadFile, File
import uvicorn

app = FastAPI()

@app.get("/search/")
async def search(q: str = Query(None, title="Search Query", description="The query string to search for"),
                 page: int = Query(1, title="Page Number", description="Page number to return")):
    results = [f"Result for '{q}' on page {page}"]
    return results

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):  # The '...' means it's a required field
    # Save the file (example)
    contents = await file.read() # Use await as file operations are asynchronous
    with open(f"uploads/{file.filename}", "wb") as f: # In a real app, you'd use secure filenames and storage
        f.write(contents)
    return {"filename": file.filename}

if __name__ == '__main__':
    uvicorn.run(app)