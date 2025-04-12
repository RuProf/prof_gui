import os
from flask import Flask, render_template, jsonify
import json


app = Flask(__name__)

profile_data_cache = None
last_mtime = 0

def load_profile_data():
    global profile_data_cache, last_mtime
    try:
        current_mtime = os.path.getmtime("/profile.json")
        if current_mtime > last_mtime:
            with open("/profile.json", "r") as f:
                profile_data_cache = json.load(f)
            last_mtime = current_mtime
    except (FileNotFoundError, json.JSONDecodeError):
        profile_data_cache = {}
    return profile_data_cache

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/data")
def get_data():
    return jsonify(load_profile_data())

@app.route("/data_timestamp")
def get_data_timestamp():
    return jsonify({"mtime": load_profile_data() and last_mtime})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8080)


# docker run --rm -it -v $PWD:/w -w /w -p 10203:5000 python:3.8-slim bash
# pip3 install flask
# python3 app.py