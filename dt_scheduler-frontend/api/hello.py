from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/api/hello', methods=['GET'])
def hello_world():
    return jsonify({
        "status": "success",
        "message": "Flask is running securely on its own local server!"
    })

if __name__ == '__main__':
    app.run(port=5328)