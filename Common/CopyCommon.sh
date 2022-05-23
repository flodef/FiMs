#!/bin/bash

cd ..
for dir in *GoogleAppsScript*/; do
  cd "$dir"
  cp -fr ../Common/Common.js ./
  cd ..
done