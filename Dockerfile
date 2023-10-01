# Use an official Python runtime as a parent image
FROM python:3.11

# Set the working directory in the container to /app
WORKDIR /app

# Add the requirements.txt to the container
COPY requirements.txt requirements.txt

# Install any needed packages specified in requirements.txt
RUN pip install -r requirements.txt

# Ignore unnecessary files and directories by using a .dockerignore file

# Bundle the app source inside the Docker image
COPY . .

# Set default environment variables for Docker container
ENV DOCKER_CONTAINER=true
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=5555

# Make port 5555 available to the world outside this container
EXPOSE 5555

# Run the command to start the server
CMD ["python", "runserver.py"]