# Use the official Python image.
FROM python:3.11-slim

# Set the working directory in the container.
WORKDIR /app

# Copy the dependency files to the working directory.
COPY pyproject.toml poetry.lock /app/

# Install system dependencies required for Poetry.
RUN pip install poetry

# Install project dependencies.
RUN poetry install --no-root

# Copy the rest of the application source code.
COPY . /app/

# Command to run the application.
CMD ["poetry", "run", "python", "ark_main.py"]
