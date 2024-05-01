DIR=$(cd $(dirname $1); pwd)
(cd $DIR && zip -0r - *) > $1.pvf