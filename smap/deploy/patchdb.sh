#!/bin/sh

version=1
if [ -e ~/smap_version ]
then
	version=`cat ~/smap_version`
fi

echo "Current Smap Version is $version"

# Apply database patches
echo "applying patches to survey_definitions"
sudo -u postgres psql -f ./sd.sql -q -d survey_definitions 2>&1 | grep -v "already exists" | grep -v "duplicate key"
echo "applying patches to results"
sudo -u postgres psql -f ./results.sql -q -d results 2>&1 | grep -v "already exists"

# Version 14.02
if [ $version -lt "1402" ]
then
	echo "Applying patches for version 14.02"
	sudo apt-get install gdal-bin
fi

# version 14.03
if [ $version -lt "1403" ]
then
	echo "Applying patches for version 14.03"
	echo "set up forwarding - assumes uploaded files are under /smap"
        sudo cp -v  ../install/config_files/subscribers_fwd.conf /etc/init
        sudo cp -v  ../install/subscribers.sh /usr/bin/smap
	sudo sed -i "s#{your_files}#/smap#g" /etc/init/subscribers_fwd.conf
	echo "Modifying URLs of attachments to remove hostname, also moving uploaded files to facilitate forwarding of old surveys"
	java -jar version1/patch.jar apply survey_definitions results
	sudo chown -R tomcat7 /smap/uploadedSurveys
fi

# version 14.05
if [ $version -lt "1405" ]
then
	echo "Applying patches for version 14.05"
	echo "Upgrade pyxform to support geoshape and geotrace types"
	sudo apt-get install python-dev -y
	sudo apt-get install libxml2-dev -y
	sudo apt-get install libxslt-dev
	sudo apt-get install libxslt1-dev -y
	sudo apt-get install git -y
	sudo apt-get install python-setuptools -y
	sudo easy_install pip
	sudo pip install setuptools --no-use-wheel --upgrade
	sudo pip install xlrd
	sudo rm -rf src/pyxform
	sudo pip install -e git+https://github.com/UW-ICTD/pyxform.git@master#egg=pyxform
	sudo rm -rf /usr/bin/smap/pyxform
	sudo cp -r src/pyxform/pyxform/ /usr/bin/smap/
	sudo a2enmod headers
fi

# version 14.08
if [ $version -lt "1408" ]
then
echo "Applying patches for version 14.06"
echo "installing ffmpeg"
if [ $(cat /etc/*-release | grep "DISTRIB_CODENAME=" | cut -d "=" -f2) == 'trusty' ];
then  
sudo add-apt-repository 'deb  http://ppa.launchpad.net/jon-severinsson/ffmpeg/ubuntu trusty main'  && sudo add-apt-repository 'deb  http://ppa.launchpad.net/jon-severinsson/ffmpeg/ubuntu saucy main'  && sudo apt-get update
fi
sudo apt-get update -y
sudo apt-get install ffmpeg -y
fi

echo "1408" > ~/smap_version
