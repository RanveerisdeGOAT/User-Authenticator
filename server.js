const http = require('http');
const fs = require('fs');
const path = require('path');

const hostname = '192.168.68.72';
const port = 3000;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function logRequest(req, statusCode) {
    console.log(`${req.method} ${req.url} -> ${statusCode}`);
}

const server = http.createServer((req, res) => {
    let requestedPath = req.url === '/' ? '/index' : req.url;
    let filePath = path.join(__dirname, 'web', requestedPath);

    // If no extension, assume .html
    if (!path.extname(filePath)) {
        filePath += '.html';
    }

    // Prevent directory traversal
    if (!filePath.startsWith(path.join(__dirname, 'web'))) {
        res.statusCode = 403;
        res.end('403: Forbidden');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/plain');
                res.end('404: File Not Found');
                logRequest(req, 404);
            } else {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain');
                res.end('500: Internal Server Error');
                logRequest(req, 500);
            }
        } else {
            res.statusCode = 200;
            res.setHeader('Content-Type', contentType);
            res.end(data);
            logRequest(req, 200);
        }
    });
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
