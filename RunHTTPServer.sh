#!/bin/bash

# SET HERE the list of the spreadsheet SID according to their file Name /!\just update the SID/!\ 
declare -A fileArray
fileArray[1JJ7zW4GD7MzMBTatntdnojX5bZYcqI1kxMWIvc0_LTw]="FiMs TradFi"
fileArray[1pMnJel8OYtwk1Zu4YgTG3JwmTA-WLIMf6OnCQlSgprU]="FiMs Associate"
fileArray[1enXnuwZExO92B5FxPB8s2Rhqlxl1p9nUY9tRaHtV1kI]="FiMs DeFi"
fileArray[1lH6uLLPKZyltpxP83qUMr6veIyIQjzGm-qxaIh2ihIU]="FiMs Pay"
filevar="fileArray"
declare -a 'sidKey=("${!'"$filevar"'[@]}")'

# Set the main variables
ext=".xlsx"
#dir="$HOME/Downloads/"   # Ubuntu
dir="/mnt/chromeos/MyFiles/Downloads/"   #Chrome OS
gs="https://docs.google.com/spreadsheets/d/"
ge="/export?format=xlsx&id="


# Use this trick to avoid blank state at start (chrome OS hack)
clear
echo "Lauching script ..."
sleep 1
clear

# Download all spreasheets (Yes will download all, No will download none, Maybe will ask for every spreadsheet)
echo "Download all spreadsheets" $file "(Y/N/M) ?"
read downall
clear

for sid in ${sidKey[@]}; do
  f="${filevar}[$sid]"
  file=${!f}

  retry="Y"
  url="$dir$file$ext"
  goo="$gs$sid$ge$sid"

  if [ $downall = "M" ];then
    echo "Download spreadsheet" $file "(Y/N) ?"
    read retry
  elif [ $downall = "Y" ];then
    retry="Y"
  else
    retry="N"
  fi

  clear
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

    clear
  done
done

# Asks for the User Id, then open the browser in parallel, while the http server is starting
echo "User ID ('TradFi' for FiMs TradFi, can also be void) :"
read user
sh RunLocalHost.sh $user &

# Start the http server
clear
http-server     # Install NPM first, then http-server
