from flask import Flask, jsonify, make_response

app = Flask(__name__)

@app.route('/items/<int:item_id>', methods=['GET'])
def get_item(item_id):
    items = {
        1: {'id': 1, 'name': 'Item 1'},
        2: {'id': 2, 'name': 'Item 2'}
    }
    item = items.get(item_id)
    if item:
        return jsonify(item)
    else:
        return jsonify({'message': 'Item not found'}), 404

@app.route('/custom_response', methods=['GET'])
def custom_response():
    response_data = {'message': 'This is a custom response'}
    response = make_response(jsonify(response_data), 200)
    response.headers['Content-Type'] = 'application/json'  # Redundant, but shows how to set headers
    response.headers['X-Custom-Header'] = 'Custom Value' #Adding custom header
    return response

if __name__ == '__main__':
    app.run(debug=True)