#!/bin/bash

echo $HOME
echo $PWD

ext=".xlsx"
dir="$HOME/Téléchargements/"

file="FiMs Main"
url="$dir$file$ext"
goo="https://docs.google.com/spreadsheets/d/e/2PACX-1vQOD1ZjNIwHLYr7Qft0UzPCAvYLlVW8kmDu8cvG6RPqtrBw5sIYkigiKDBONUfcVcL6g4Xb_j0oeZla/pub?output=xlsx"

until [ $retry = "N" ]; do
  rm $url
  echo $url

  xdg-open $goo
  clear

  for n in {15..0}; do
    echo "Waiting for file to be downloaded ..."
    echo $n secondes restantes
    sleep 1
    clear
    if [ -f "$url" ]; then
      retry="N"
      break
    fi
  done

  if [ $retry != "N" ]; then
    echo "File not found. Check your Internet connexion. Retry (Y/N) ?"
    read retry
  fi
done

retry=
mv -f "$url" "./Data/"
clear

file="FiMs Associate"
url="$dir$file$ext"
goo="https://docs.google.com/spreadsheets/d/1pMnJel8OYtwk1Zu4YgTG3JwmTA-WLIMf6OnCQlSgprU/export?format=xlsx&id=1pMnJel8OYtwk1Zu4YgTG3JwmTA-WLIMf6OnCQlSgprU"

until [ $retry = "N" ]; do
  rm $url
  echo $url

  xdg-open $goo
  clear

  for n in {15..0}; do
    echo "Waiting for file to be downloaded ..."
    echo $n secondes restantes
    sleep 1
    clear
    if [ -f "$url" ]; then
      retry="N"
      break
    fi
  done

  if [ $retry != "N" ]; then
    echo "File not found. Check your Internet connexion. Retry (Y/N) ?"
    read retry
  fi
done

retry=
mv -f "$url" "./Data/"
clear

http-server
