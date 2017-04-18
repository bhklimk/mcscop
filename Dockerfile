FROM debian:latest
MAINTAINER Nathan Hicks <nathan.m.hicks@gmail.com>

ENV DEBIAN_FRONTEND noninteractive
ENV LANG C.UTF-8

# Add app user
RUN useradd -ms /bin/bash mcscop
WORKDIR /home/mcscop/

RUN apt-get update -y \
   && apt-get upgrade -y \
   && apt-get install -y \
   apt-utils \
   curl \
   mongodb \
   mysql-server \
   mysql-client \
   sudo \
   && rm -rf /var/lib/apt/lists/*

RUN curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
RUN apt-get install nodejs
COPY . /home/mcscop/
RUN npm install -d
RUN chmod +x /home/mcscop/entrypoint.sh

EXPOSE 3000/tcp

ENTRYPOINT ["/home/mcscop/entrypoint.sh"]
