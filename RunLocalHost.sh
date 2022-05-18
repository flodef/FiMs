#!/bin/bash

sleep 5
if [ ! "$1" = "" ];then
  id="?id=$1"
else
  id=""
fi
xdg-open "http://127.0.0.1:8080/$id"