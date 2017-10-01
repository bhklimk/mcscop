#!/bin/sh

echo "Restore which backup? YYYYMMDD:"
read DATE

MYSQLFILE=mcscop.sql.${DATE}
MONGOFILE=mcscop.mongo.${DATE}

echo "Please provide your root mysl password:"
mysql -u root -p mcscop < backups/${MYSQLFILE}.sql
tar zxvf backups/${MONGOFILE}.tar.gz
mongorestore dump
rm -rf dump
