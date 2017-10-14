#!/bin/sh

echo "Restore which backup? YYYYMMDD:"
read DATE

MYSQLFILE=mcscop.sql.${DATE}
MONGOFILE=mcscop.mongo.${DATE}

echo "Please provide your root mysl password:"
sudo mysql -u root mcscop < backups/${MYSQLFILE}.sql
tar zxvf backups/${MONGOFILE}.tar.gz
mongorestore dump
rm -rf dump
