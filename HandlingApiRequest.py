from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('q')
    page = request.args.get('page', default=1, type=int) # type converts the input to the specified type (int), while default provides a default value if parameter is missing
    # Simulate a database search
    results = [f"Result for '{query}' on page {page}"]
    return jsonify(results)

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return "No file part", 400
    file = request.files['file']
    if file.filename == '':
        return "No selected file", 400

    # Save the file (example)
    file.save(f"uploads/{file.filename}") # In a real app, you'd use secure filenames and storage

    return "File uploaded successfully", 201

if __name__ == '__main__':
    app.run(debug=True)