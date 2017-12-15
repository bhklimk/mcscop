#!/bin/sh
if [ $EUID -ne 0 ] || [ "$USER" == "root" ]; then
   echo "[!] This script must be run with sudo from the user that will run the cop."
   exit 1
fi
echo "[*] This script installs the required packages to run MCSCOP"
echo "    The following packages will be installed: curl, mysql-server,"
echo "    mysql-client, mongodb, nodejs, and npm."
echo "    You may be prompted to provide your sudo or root password."
echo ""
while true; do
    read -p "[!] Do you need to install or update packages and dependicies? " yn
    case $yn in
        [Yy]* ) ans=1; break;;
        [Nn]* ) ans=0; break;;
        * ) echo "Please select yes or no.";;
    esac
done
if [ $ans -eq 1 ]; then
    cp mongodb-org-3.6.repo /etc/yum.repos.d
    yum -y install curl mariadb-server mariadb
    curl -sL https://rpm.nodesource.com/setup_8.x | bash -
    yum -y install nodejs
    systemctl enable mariadb.service
    systemctl start mariadb.service
    systemctl enable mongod.service
    systemctl start mongod.service
    npm install
fi
mysql -u root -e 'EXIT'
if [ $? -eq 0 ]; then
    echo "[*] create the MCSCOP database."
    mysql -u root -e "CREATE DATABASE mcscop;"
    echo "[*] import the MCSCOP database schema."
    cat mysql/mcscop-schema.sql mysql/user.sql | mysql -u root mcscop
else
    echo "[!] Please provide your mysql root password.  This is used to"
    echo "[*] create the MCSCOP database."
    mysql -u root -p -e "CREATE DATABASE mcscop;"
    echo "[!] Please provide your mysql root password.  This is used to"
    echo "[*] import the MCSCOP database schema."
    cat mysql/mcscop-schema.sql mysql/user.sql | mysql -u root -p mcscop
fi
echo ""
while true; do
    read -p "[!] Do you want to enable pm2 persistence for the cop? " yn
    case $yn in
        [Yy]* ) ans=1; break;;
        [Nn]* ) ans=0; break;;
        * ) echo "Please select yes or no.";;
    esac
done
if [ $ans -eq 1 ]; then
    npm install -g pm2
    env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp /home/$USER
    su $USER -c "pm2 start app.js --name=MCSCOP; pm2 save"
else
    echo "[!] To run MCSCOP use: node app.js from the mcscop directory."
fi
echo ""
echo "[!] The initial username and password for MCSCOP are:"
echo "    admin / password"
echo "    Make sure to change passwords upon login!"

