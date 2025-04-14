from python:3.8-slim
RUN pip install flask
WORKDIR /app
COPY backend/python/app.py .
COPY ui/ .
CMD ["python", "app.py"]

# Build
# docker build -t prof_gui:python -f docker/dockerfile.py .

# Dev
# docker run --rm -it -p 5000:8080 prof_gui:python
# docker run --rm -it -v $PWD:/app -w /app -p 5000:8080 prof_gui:python bash

# Deploy
# docker run --rm -d --name prof_gui -v ./lprof_ext.json:/lprof_ext.json -p 5000:8080 prof_gui:python
# docker run --rm -d --name prof_gui -v ./lprof_ext.json:/lprof_ext.json -p 5000:8080 ruprof/prof_gui:python
