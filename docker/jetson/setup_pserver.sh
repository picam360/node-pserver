#!/bin/bash

PSERVER_VERSION=$1

# Check if PSERVER_VERSION is set
if [ -z "$PSERVER_VERSION" ]; then
  echo "PSERVER_VERSION is not set"
  exit 1
fi

# If PSERVER starts with http
if [[ "$PSERVER_VERSION" == http* ]]; then
  echo "PSERVER_VERSION starts with http. Cloning the Git repository."
  git clone --depth=1 "$PSERVER_VERSION" pserver
  if [ $? -eq 0 ]; then
    cd pserver
    npm install --loglevel=verbose
    npm install -g . --unsafe-perm --loglevel=verbose
    cd ..
    rm -rf pserver  # Delete the working directory
  else
    echo "Failed to clone the Git repository."
    exit 1
  fi
else
  echo "PSERVER does not start with http. Installing directly with npm."
  npm install -g "$PSERVER_VERSION" --unsafe-perm
fi