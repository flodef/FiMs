# FiMS

[![Maintainability](https://api.codeclimate.com/v1/badges/c91149f9871e06746ae1/maintainability)](https://codeclimate.com/github/flodef/FiMS/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/c91149f9871e06746ae1/test_coverage)](https://codeclimate.com/github/flodef/FiMS/test_coverage)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/flodef/FiMS.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/flodef/FiMS/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/flodef/FiMS.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/flodef/FiMS/context:javascript)



Requirements
- Node.js is a cross-platform JavaScript run-time environment built on Chrome’s JavaScript designed to execute JavaScript code on the server-side. With Node.js, you can build scalable network applications.
npm is the default package manager for Node.js that helps developers to share and reuse their code.
- clasp is written in Node.js and distributed via the npm tool. Prior to using clasp, you must have Node.js version 4.7.4 or later installed. Installing Node.js requires administrative privileges.

Installation on Debian / Ubuntu
1.a Installing Node.js and npm from the Debian / Ubuntu repositories:
$ sudo apt update
$ sudo apt install nodejs npm

1.b Installing Node.js and npm from the NodeSource repository:
NodeSource is a company focused on providing enterprise-grade Node support. It maintains an APT repository containing multiple Node.js versions. Use this repository if you need to install a specific version of Node.js.

For example, we’ll install Node.js version 18.x.
Start by adding add the NodeSource repository to your system by running the following curl command:
$ curl -sL https://deb.nodesource.com/setup_12.x | sudo bash -

Once the repository is added to install Node.js and npm type:
$ sudo apt install nodejs

2. Installing clasp from npm
Once you've installed Node.js, you can use the following npm command to install clasp:
$ sudo npm install @google/clasp -g

Installation on Windows
1. Download the lastest version of Node.js and install it via the msi installer at https://nodejs.org/
2. Start a command line by running "cmd" in the search / run bar, then use : npm install @google/clasp -g

How to Use
1. Local data & server
If you want to execute the app in local, execute the http server by using the RunHTTPServer script in the FiMs folder :
- On Debian / Ubuntu command line:
$ ./RunHTTPServer.sh
- On Debian / Ubuntu explorer : right click on the shell script (.sh), then "execute as a program"
- On Windows : Double click on the batch script (.bat)

When asked to downlad spreadsheet, type "N" for No.
When the http server is running, run a web browser and go to http://127.0.0.1:8080/
You should get the Associate page.
If you want to access a specific Associate page, add an associate in the spreadsheet in Data/FiMs Associate.xlsx.
Alternatively, you can access it by using the connexion button, in the upper right corner.
A test associate is already in the spreadsheet file. Its ID is "Tester".
To access it, go to http://127.0.0.1:8080/?id=Tester or type "Tester" after clicking the connexion button.

If you want to access the Main page, you can go to http://127.0.0.1:8080/?id=Flodef
The id to access the Main page is "Flodef", but you can change it in the Google.js file, class Run, function doGet(e)

2. Online data & local server
Upload the Data files from the Data folder, in Google drive.
In the RunHTTPServer script, change the sid of the data spreadsheet.
The sid can be found in the url of the file on Google drive:
https://docs.google.com/spreadsheets/d/SID
Once it's done, you can now download the data files, then run the local http server by using the RunHTTPServer script.

3. Online data & server
Upload the Data files from the Data folder, in Google drive.
In the folder GoogleAppsScript - WebApp, change the sid of the data spreadsheet in the Code.js file.
The sid can be found in the url of the file on Google drive:
https://docs.google.com/spreadsheets/d/SID
Instead of using a local server, create a copy of the project in Github.
