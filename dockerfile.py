from python:3.8-slim
RUN pip install flask
WORKDIR /app
COPY python/app.py /app/
COPY . .
CMD ["python", "app.py"]

# Build
# docker build -t prof_gui:python -f dockerfile.py .

# Dev
# docker run --rm -it -p 5000:8080 prof_gui:python

# Deploy
# docker run --rm -d --name prof_gui -v ./profile.json:/profile.json -p 5000:8080 prof_gui:python
# docker run --rm -d --name prof_gui -v ./profile.json:/profile.json -p 5000:8080 ruprof/prof_gui:python
