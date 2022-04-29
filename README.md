# FiMS

[![Maintainability](https://api.codeclimate.com/v1/badges/c91149f9871e06746ae1/maintainability)](https://codeclimate.com/github/flodef/FiMS/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/c91149f9871e06746ae1/test_coverage)](https://codeclimate.com/github/flodef/FiMS/test_coverage)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/flodef/FiMS.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/flodef/FiMS/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/flodef/FiMS.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/flodef/FiMS/context:javascript)



## Requirements
Node.js is a cross-platform JavaScript run-time environment built on Chrome’s JavaScript designed to execute JavaScript code on the server-side. With Node.js, you can build scalable network applications.
npm is the default package manager for Node.js that helps developers to share and reuse their code.
Installing Node.js requires administrative privileges.

## Installation on Debian / Ubuntu
### 1. Installing Node.js and npm from the Debian / Ubuntu repositories:
Start a shell and use the following commands:
```
$ sudo apt update
$ sudo apt install nodejs npm
```

### 2. Installing Node.js and npm from the NodeSource repository:
NodeSource is a company focused on providing enterprise-grade Node support. It maintains an APT repository containing multiple Node.js versions. Use this repository if you need to install a specific version of Node.js.

For example, we’ll install Node.js version 18.x.
Start by adding add the NodeSource repository to your system by running the following curl command:
`$ curl -sL https://deb.nodesource.com/setup_18.x | sudo bash -`

Once the repository is added to install Node.js and npm type:
`$ sudo apt install nodejs`

## Installation on Windows
Download the lastest version of Node.js and install it via the msi installer at https://nodejs.org/

## How to Use
The app needs some command line instructions / file download / file copy to be used.
To simplify the use, many scripts that automate the process are already there.
To use those scripts, you can open a command line window and type your command (RunHTTPServer, Push, Deploy, ...).
To execute the script, go first to the containing folder :
- On Debian / Ubuntu command line: open a command line and type `$ sh _script_.sh`
- On Debian / Ubuntu explorer : right click on the shell script (.sh), then "execute as a program"
- On Windows : Double click on the batch script (.bat)

### 1. Local data & server
If you want to execute the app in local, execute the http server by using the `RunHTTPServer` script in the FiMs folder (see chapter _How to Use_).
When asked to downlad spreadsheet, type "N" for No.
When the http server is running, run a web browser and go to http://127.0.0.1:8080/
You should get the Associate page.
If you want to access a specific Associate page, add an associate in the spreadsheet in Data/FiMs Associate.xlsx.
Alternatively, you can access it by using the connexion button, in the upper right corner.
A test associate is already in the spreadsheet file. Its ID is "Tester".
To access it, go to http://127.0.0.1:8080/?id=Tester or type "Tester" after clicking the connexion button.

If you want to access the TradFi page, you can go to http://127.0.0.1:8080/?id=TradFi
The id to access the TradFi page is "TradFi", but you can change it in the Google.js file, class Run, function doGet(e)

### 2. Online data & local server
Upload the Data files from the Data folder, in Google drive.
In the RunHTTPServer script, change the sid of the data spreadsheet.
The sid can be found in the url of the file on Google drive:
https://docs.google.com/spreadsheets/d/SID
Once it's done, you can now download the data files, then run the local http server by using the `RunHTTPServer` script
(see chapter _How to Use_).

### 3. Online data & server
Upload the Data files from the Data folder, in Google drive.
In the folder "GoogleAppsScript - WebApp", change the sid of the data spreadsheet in the Code.js file.
The sid can be found in the url of the file on Google drive:
https://docs.google.com/spreadsheets/d/SID
Instead of using a local server, create a copy of the project in Github.

## How to Edit
### Requirements
Clasp lets you to develop your Apps Script projects locally. You can write code on your own computer and upload it to Apps Script when you're done. You can also download existing Apps Script projects so that you can edit them when you're offline. Since the code is local, you can use your favorite development tools like git when building Apps Script projects.
Clasp is written in Node.js and distributed via the npm tool.
Prior to using clasp, you must have Node.js version 4.7.4 or later installed.

### Installing clasp from npm
Once you've installed Node.js, you can use the following npm command to install clasp:
- On Linux: in a shell, use `$ sudo npm install @google/clasp -g`
- On Windows: start a command line by running "cmd" in the search / run bar, then use : `$ npm install @google/clasp -g`

### Google Apps Script
#### 1. Clasp Login
Log into clasp by using the command: `$ clasp login` in the command line.
After authorizing clasp to access your Google Drive account, you should get a `.clasprc.json` file.

#### 2. Script ID
Upload the Data files from the Data folder, in Google drive.
Open the spreadsheet file in Google sheet. Then open the menu "Extensions > Apps Script".
In the code editor, you should see a "Project Settings" menu, in the toolbar on the left.
In the Project Settings, you should find the Script ID and make a copy of it.

#### 3. Push edited files
Each file has a corresponding folder: for example, Associate --> "GoogleAppsScript - Associate", and so on...
In each folder, you have 2 push command: `Push.bat` for Windows, `Push.sh` for Linux.
Open them and paste the Script ID instead of the one already there: clasp push YourScriptID
You also have to change the Script ID in the file `.clasp.json`.
After editing a file in one of the GoogleAppsScript folder, use one of the `Push` script
(see chapter _How to Use_). Alternatively, it is possible to update all the script at once,
using `PushAll` script in the root folder.

#### 4. WebApp Deployment
The web app is a bit different as it necessits a Deployment script to be in prod.
After pushing the file and properly testing it (/dev), use the `Deploy` script to deploy it in production (/exec)
(see chapter _How to Use_).
During maintenance, i.e. while updating prod and testing, use the `WorkInProgress` page by setting the workInProgress flag to `true` in GoogleAppsScript - WebApp > Code.js
