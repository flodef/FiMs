#!/bin/bash

for dir in ../*GoogleAppsScript*/; do
  cd "$dir"
  sh Push.sh
  cd ..
done