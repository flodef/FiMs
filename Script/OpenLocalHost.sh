#!/bin/bash

sleep 5
if [ ! "$1" = "" ];then
  arg="?app=$1"
  if [ ! "$2" = "" ];then
    arg="?app=$1&id=$2"
  fi
elif [ ! "$2" = "" ];then
  arg="?id=$2"
else
  arg=""
fi
xdg-open "http://127.0.0.1:8080/$arg"
