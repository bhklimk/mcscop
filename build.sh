browserify main.js --standalone main | uglify > main-bundle.js
browserify config.js --standalone config | uglify > config-bundle.js
browserify cop.js -i jsdom -i canvas -i xmldom --standalone cop | uglify > cop-bundle.js
