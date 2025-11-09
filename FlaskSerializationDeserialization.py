from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/data', methods=['POST'])
def handle_data():
    data = request.get_json() # Deserialization: JSON -> Python dict
    processed_data = {'message': f'Received: {data}'}
    return jsonify(processed_data) # Serialization: Python dict -> JSON

if __name__ == '__main__':
    app.run(debug=True)