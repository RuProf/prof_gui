#!/bin/bash
# export PROF_GUI_VERSION=$(grep '^version =' pyproject.toml | awk -F'"' '{print $2}')
export PROF_GUI_VERSION="0.1.0"
export PROF_GUI_BACKEND="python"  # Can be set to "rust" or "python"
export PROF_GUI_TAG="${PROF_GUI_BACKEND}-v${PROF_GUI_VERSION}"

# Check backend and build accordingly
if [ "$PROF_GUI_BACKEND" = "python" ]; then
    echo "Building Python backend..."
    docker build -t ruprof/prof_gui:$PROF_GUI_TAG -f docker/dockerfile.py .
elif [ "$PROF_GUI_BACKEND" = "rust" ]; then
    echo "Building Rust backend..."
    docker build -t ruprof/prof_gui:$PROF_GUI_TAG -f docker/dockerfile.rs .
else
    echo "Error: Invalid PROF_GUI_BACKEND value. Must be 'python' or 'rust'."
    exit 1
fi
# test
docker run --rm -d --name prof_gui \
           -p 5000:8080 \
           prof_gui:$PROF_GUI_TAG

docker push ruprof/prof_gui:${PROF_GUI_TAG}
docker push ruprof/prof_gui:${PROF_GUI_BACKEND}


#  docker login
#  bash deploy.sh