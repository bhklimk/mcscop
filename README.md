# mcscop

## About MCSCOP

## Getting Started with Ubuntu / Debian
```bash
git clone https://github.com/psmitty7373/mcscop.git
cd mcscop/
./install-cop.sh
node app.js
```

Open up your browser to http://mcscop-ip:3000
The default MCSCOP credentials are admin / password.

## Getting Started with Docker

```bash
git clone https://github.com/psmitty7373/mcscop.git
cd mcscop/
docker build -t mcscop .
docker run --name mcscop --rm -p 3000:3000 mcscop
```

This maps the container's 3000/tcp with your 0.0.0.0:3000/tcp. Open up your browser to http://localhost:3000.
The default MCSCOP credentials are admin / password.
