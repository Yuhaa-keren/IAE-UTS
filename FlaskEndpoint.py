from flask import Flask, jsonify, request

app = Flask(__name__)

# Example: GET request to retrieve data
@app.route('/items', methods=['GET'])
def get_items():
    items = [{'id': 1, 'name': 'Item 1'}, {'id': 2, 'name': 'Item 2'}]
    return jsonify(items)

# Example: POST request to create a new item
@app.route('/items', methods=['POST'])
def create_item():
    data = request.get_json()
    new_item = {'id': 3, 'name': data['name']}  # Simplified; in reality you'd validate and assign IDs properly
    return jsonify(new_item), 201 # Return the created item with a 201 status code

if __name__ == '__main__':
    app.run(debug=True)