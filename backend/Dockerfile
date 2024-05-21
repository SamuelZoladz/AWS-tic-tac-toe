FROM python:3.11-slim
ARG BACKEND_PORT
WORKDIR /usr/src/app
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY app.py ./
EXPOSE ${BACKEND_PORT}
CMD ["python", "app.py"]
