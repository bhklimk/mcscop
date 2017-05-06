#!/bin/sh
MYSQLFILE=mcscop.sql.`date +"%Y%m%d"`
MONGOFILE=mcscop.mongo.`date +"%Y%m%d"`

mysqldump --opt --user=mcscop --password='MCScoppass123!@#' mcscop > backups/${MYSQLFILE}.sql
mongodump -d mcscop
tar zcvf backups/${MONGOFILE}.tar.gz dump
rm -rf dump
