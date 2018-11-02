from flask import Flask, render_template

app = Flask(__name__, static_url_path='/static')


@app.route('/')
def hello_world():
    return 'Hello World!'


@app.route('/generator')
def generator():
    return render_template('index.html')


if __name__ == '__main__':
    app.run()
