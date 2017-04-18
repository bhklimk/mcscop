#!/bin/sh
sudo apt-get update
sudo apt-get upgrade
sudo apt-get install curl mysql-server mysql-client mongodb
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install nodejs
npm install
mysql -u root -p -e "CREATE DATABASE mcscop;"
mysql -u root -p mcscop < mysql/mcscop-schema.sql
