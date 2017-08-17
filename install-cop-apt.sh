#!/bin/sh
echo "This script installs the required packages to run MCSCOP"
echo "The following packages will be installed: curl, mysql-server,"
echo "mysql-client, mongodb, nodejs, and npm."
echo "You may be prompted to provide your sudo password."
sudo apt-get update
sudo apt-get upgrade
sudo apt-get install curl mysql-server mysql-client mongodb
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install nodejs
npm install
echo "Please provide your mysql root password.  This is used to"
echo "create the MCSCOP database."
mysql -u root -p -e "CREATE DATABASE mcscop;"
echo "Please provide your mysql root password.  This is used to"
echo "import the MCSCOP database schema."
cat mysql/mcscop-schema.sql mysql/user.sql | mysql -u root -p mcscop
echo "The initial username and password for MCSCOP are:"
echo "admin / password"
