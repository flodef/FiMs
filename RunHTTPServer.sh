#!/bin/bash

ext=".xlsx"
dir="$HOME/Téléchargements/"
gs="https://docs.google.com/spreadsheets/d/"
ge="/export?format=xlsx&id="

file="FiMs Main"
sid="1JJ7zW4GD7MzMBTatntdnojX5bZYcqI1kxMWIvc0_LTw"

url="$dir$file$ext"
goo="$gs$sid$ge$sid"

clear
echo "Download spreadsheet" $file "(Y/N) ?"
read retry
until [ $retry = "N" ]; do
  rm $url
  echo $url

  xdg-open $goo
  clear

  for n in {55..0}; do
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

retry="Y"
mv -f "$url" "./Data/"



file="FiMs Associate"
sid="1pMnJel8OYtwk1Zu4YgTG3JwmTA-WLIMf6OnCQlSgprU"

url="$dir$file$ext"
goo="$gs$sid$ge$sid"

clear
echo "Download spreadsheet" $file "(Y/N) ?"
read retry
until [ $retry = "N" ]; do
  rm $url
  echo $url

  xdg-open $goo
  clear

  for n in {55..0}; do
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

retry="Y"
mv -f "$url" "./Data/"



file="FiMs Crypto"
sid="1enXnuwZExO92B5FxPB8s2Rhqlxl1p9nUY9tRaHtV1kI"

url="$dir$file$ext"
goo="$gs$sid$ge$sid"

clear
echo "Download spreadsheet" $file "(Y/N) ?"
read retry
until [ $retry = "N" ]; do
  rm $url
  echo $url

  xdg-open $goo
  clear

  for n in {55..0}; do
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

retry="Y"
mv -f "$url" "./Data/"

clear
http-server
