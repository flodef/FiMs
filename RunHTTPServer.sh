#!/bin/bash

ext=".xlsx"
#dir="$HOME/Downloads/"   # Ubuntu
dir="/mnt/chromeos/MyFiles/Downloads/"   #Chrome OS
gs="https://docs.google.com/spreadsheets/d/"
ge="/export?format=xlsx&id="

file="FiMs TradFi"
sid="1JJ7zW4GD7MzMBTatntdnojX5bZYcqI1kxMWIvc0_LTw"

retry="Y"
url="$dir$file$ext"
goo="$gs$sid$ge$sid"

clear
echo "Lauching script ..."
sleep 1
clear
echo "Download spreadsheet" $file "(Y/N) ?"
read retry
until [ $retry = "N" ]; do
  rm -f "$url"

  xdg-open $goo
  clear

  #for i in {55..0}; do
  i=55;
  until [ $i = 0 ]; do
    echo "Waiting for file to be downloaded ..."
    echo $i secondes restantes
    sleep 1
    i=$((i-1))
    clear
    if [ -f "$url" ]; then
      retry="N"
      mv -f "$url" "./Data/"
      break
    fi
  done

  if [ $retry != "N" ]; then
    echo "File not found. Check your Internet connexion. Retry (Y/N) ?"
    read retry
  fi
done



file="FiMs Associate"
sid="1pMnJel8OYtwk1Zu4YgTG3JwmTA-WLIMf6OnCQlSgprU"

retry="Y"
url="$dir$file$ext"
goo="$gs$sid$ge$sid"

clear
echo "Download spreadsheet" $file "(Y/N) ?"
read retry
until [ $retry = "N" ]; do
  rm -f "$url"

  xdg-open $goo
  clear

  #for i in {55..0}; do
  i=55;
  until [ $i = 0 ]; do
    echo "Waiting for file to be downloaded ..."
    echo $i secondes restantes
    sleep 1
    i=$((i-1))
    clear
    if [ -f "$url" ]; then
      retry="N"
      mv -f "$url" "./Data/"
      break
    fi
  done

  if [ $retry != "N" ]; then
    echo "File not found. Check your Internet connexion. Retry (Y/N) ?"
    read retry
  fi
done



file="FiMs DeFi"
sid="1enXnuwZExO92B5FxPB8s2Rhqlxl1p9nUY9tRaHtV1kI"

retry="Y"
url="$dir$file$ext"
goo="$gs$sid$ge$sid"

clear
echo "Download spreadsheet" $file "(Y/N) ?"
read retry
until [ $retry = "N" ]; do
  rm -f "$url"

  xdg-open $goo
  clear

  #for i in {55..0}; do
  i=55;
  until [ $i = 0 ]; do
    echo "Waiting for file to be downloaded ..."
    echo $i secondes restantes
    sleep 1
    i=$((i-1))
    clear
    if [ -f "$url" ]; then
      retry="N"
      mv -f "$url" "./Data/"
      break
    fi
  done

  if [ $retry != "N" ]; then
    echo "File not found. Check your Internet connexion. Retry (Y/N) ?"
    read retry
  fi
done



file="FiMs Pay"
sid="1lH6uLLPKZyltpxP83qUMr6veIyIQjzGm-qxaIh2ihIU"

retry="Y"
url="$dir$file$ext"
goo="$gs$sid$ge$sid"

clear
echo "Download spreadsheet" $file "(Y/N) ?"
read retry
until [ $retry = "N" ]; do
  rm -f "$url"

  xdg-open $goo
  clear

  #for i in {55..0}; do
  i=55;
  until [ $i = 0 ]; do
    echo "Waiting for file to be downloaded ..."
    echo $i secondes restantes
    sleep 1
    i=$((i-1))
    clear
    if [ -f "$url" ]; then
      retry="N"
      mv -f "$url" "./Data/"
      break
    fi
  done

  if [ $retry != "N" ]; then
    echo "File not found. Check your Internet connexion. Retry (Y/N) ?"
    read retry
  fi
done


clear
http-server     # Install NPM first, then http-server
