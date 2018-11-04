from flask import Flask, render_template, request, redirect
from flask_cors import CORS
import json

app = Flask(__name__, static_url_path='/static')
CORS(app)

@app.route('/')
def hello_world():
    return 'Hello World!'


@app.route('/generator')
def generator():
    return render_template('index.html')

@app.route('/apiGiven', methods=['POST'])
def apiGiven():
        data = request.json
        return json.dumps(data)


if __name__ == '__main__':
    app.run()
