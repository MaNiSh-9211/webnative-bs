const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const mime = require('mime-types');
const { exec } = require('child_process');

const PORT = 35555;

// function sendJSON(res, data) {
//   res.writeHead(200, {
//     'Content-Type': 'application/json',
//     'Access-Control-Allow-Origin': '*'
//   });
//   res.end(JSON.stringify(data, null, 2));
// }

function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data, null, 2));
}

function sendError(res, code, message) {
  res.writeHead(code || 500, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(message);
}

function getAvailableDrives(callback) {
  exec('wmic logicaldisk get name', (err, stdout) => {
    if (err) return callback(err, []);
    const drives = stdout
      .split('\n')
      .slice(1)
      .map(line => line.trim())
      .filter(Boolean)
      .map(d => d + '/');
    callback(null, drives);
  });
}

function exploreDirectory(dir, fileList = []) {
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      fileList.push({ path: fullPath, isDirectory: item.isDirectory() });
      if (item.isDirectory()) {
        exploreDirectory(fullPath, fileList);
      }
    }
  } catch (e) {
    // skip inaccessible dirs
  }
  return fileList;
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const queryPath = decodeURIComponent(parsed.query.path || '');
  const fileName = decodeURIComponent(parsed.query.name || '');

  // ✅ Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // else if (req.method === 'GET' && pathname === '/fs/list') {
  //   if (!queryPath) return sendError(res, 400, 'Missing ?path');

  //   fs.readdir(queryPath, { withFileTypes: true }, (err, entries) => {
  //     if (err) return sendError(res, 500, err.message);
  //     sendJSON(res, entries.map(e => ({
  //       name: e.name,
  //       isDirectory: e.isDirectory(),
  //       fullPath: path.join(queryPath, e.name)
  //     })));
  //   });
  // }


  else if (req.method === 'GET' && pathname === '/fs/list') {
    if (!queryPath) return sendError(res, 400, 'Missing ?path');
  
    fs.readdir(queryPath, { withFileTypes: true }, (err, entries) => {
      if (err) return sendError(res, 500, err.message);
  
      sendJSON(res, {
        success: true,
        entries: entries.map(e => ({
          name: e.name,
          isDirectory: e.isDirectory(),
          fullPath: path.join(queryPath, e.name)
        }))
      });
    });
  }

  else if (req.method === 'GET' && pathname === '/fs/drives') {
    getAvailableDrives((err, drives) => {
      if (err) return sendError(res, 500, 'Drive fetch error');
      sendJSON(res, { success: true, drives });
    });
  }

  else if (req.method === 'GET' && pathname === '/fs/read') {
    if (!queryPath) return sendError(res, 400, 'Missing ?path');

    fs.readFile(queryPath, 'utf8', (err, data) => {
      if (err) return sendError(res, 500, err.message);
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    });
  }



  // else if (req.method === 'GET' && pathname === '/fs/meta') {
  //   if (!queryPath) return sendError(res, 400, 'Missing ?path');
  
  //   fs.stat(queryPath, (err, stats) => {
  //     if (err) return sendError(res, 500, err.message);
  
  //     const metadata = {
  //       path: queryPath,
  //       name: path.basename(queryPath),
  //       extension: path.extname(queryPath),
  //       directory: path.dirname(queryPath),
  //       absolutePath: path.resolve(queryPath),
  //       size: stats.size,
  //       isFile: stats.isFile(),
  //       isDirectory: stats.isDirectory(),
  //       isSymbolicLink: typeof stats.isSymbolicLink === 'function' ? stats.isSymbolicLink() : false,
  //       created: stats.birthtime,
  //       modified: stats.mtime,
  //       accessed: stats.atime,
  //       changed: stats.ctime,
  //       mimeType: mime.lookup(queryPath) || 'application/octet-stream',
  //       mode: stats.mode.toString(8), // Unix-style permission bits (octal)
  //       uid: stats.uid,
  //       gid: stats.gid,
  //       device: stats.dev,
  //       inode: stats.ino,
  //       hardLinks: stats.nlink,
  //       blocks: stats.blocks,
  //       blockSize: stats.blksize
  //     };
  
  //     sendJSON(res, metadata);
  //   });
  // }


  else if (req.method === 'GET' && pathname === '/fs/meta') {
  if (!queryPath) {
    return sendJSON(res, { success: false, error: 'Missing ?path' }, 400);
  }

  fs.stat(queryPath, (err, stats) => {
    if (err) {
      return sendJSON(res, { success: false, error: err.message }, 500);
    }

    const metadata = {
      path: queryPath,
      name: path.basename(queryPath),
      extension: path.extname(queryPath),
      directory: path.dirname(queryPath),
      absolutePath: path.resolve(queryPath),
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      isSymbolicLink: typeof stats.isSymbolicLink === 'function' ? stats.isSymbolicLink() : false,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      changed: stats.ctime,
      mimeType: mime.lookup(queryPath) || 'application/octet-stream',
      mode: stats.mode.toString(8),
      uid: stats.uid,
      gid: stats.gid,
      device: stats.dev,
      inode: stats.ino,
      hardLinks: stats.nlink,
      blocks: stats.blocks,
      blockSize: stats.blksize
    };

    sendJSON(res, { success: true, meta: metadata });
  });
}


  else if (req.method === 'GET' && pathname === '/fs/exists') {
    if (!queryPath) return sendError(res, 400, 'Missing ?path');

    fs.access(queryPath, fs.constants.F_OK, (err) => {
      sendJSON(res, { exists: !err, path: queryPath });
    });
  }

  else if (req.method === 'POST' && pathname === '/fs/write') {
    if (!queryPath) return sendError(res, 400, 'Missing ?path');

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      fs.writeFile(queryPath, body, (err) => {
        if (err) return sendError(res, 500, err.message);
        sendJSON(res, { success: true, path: queryPath });
      });
    });
  }


  else if (req.method === 'POST' && pathname === '/fs/append') {
    if (!queryPath) return sendError(res, 400, 'Missing ?path');

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      fs.appendFile(queryPath, body, (err) => {
        if (err) return sendError(res, 500, err.message);
        sendJSON(res, { success: true, path: queryPath });
      });
    });
  }

   // ✅ Command execution endpoint
else if (req.method === 'POST' && pathname === '/cmd/run') {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const { command } = JSON.parse(body);
      if (!command) return sendJSON(res, { success: false, error: 'Missing "command"' }, 400);

      exec(command, { windowsHide: true }, (error, stdout, stderr) => {
        sendJSON(res, {
          success: !error,
          command,
          stdout: stdout ? stdout.split(/\r?\n/) : [],   // returns an array of lines
          stderr: stderr ? stderr.split(/\r?\n/) : [],
          error: error?.message || null
        });
      });
    } catch (e) {
      sendJSON(res, { success: false, error: 'Invalid JSON' }, 400);
    }
  });
  return;
}

  // New: Explore entire file system recursively
  else if (req.method === 'GET' && pathname === '/fs/explore') {
    getAvailableDrives((err, drives) => {
      if (err) return sendError(res, 500, 'Drive detection failed');
      const allFiles = drives.flatMap(drive => exploreDirectory(drive));
      sendJSON(res, allFiles);
    });
  }

  else if (req.method === 'GET' && pathname === '/fs/resolve-file-path') {
    const name = parsed.query.name;
    if (!name) return sendError(res, 400, 'Missing ?name');

    getAvailableDrives((err, drives) => {
        if (err) return sendError(res, 500, 'Drive fetch error');

        let results = [];
        let pending = drives.length;
        if (pending === 0) return sendJSON(res, { success: true, paths: [] });

        drives.forEach(drive => {
            // Modified dir command: /b = bare format, /s = recursive search
            exec(`dir "${drive}\\${name}" /b /s`, { windowsHide: true }, (error, stdout) => {
                if (!error && stdout) {
                    const found = stdout.trim()
                        .split('\n')
                        .map(line => line.trim())
                        .filter(Boolean)
                        // Ensure results are files, not directories
                        .filter(path => fs.existsSync(path) && fs.lstatSync(path).isFile());
                    
                    results.push(...found);
                }
                if (--pending === 0) {
                    if (results.length === 0) {
                        return sendJSON(res, { 
                            success: true, 
                            paths: [], 
                            message: 'No matching files found' 
                        });
                    }
                    sendJSON(res, { success: true, paths: results });
                }
            });
        });
    });
}


  else if (req.method === 'GET' && pathname === '/fs/resolve-folder-path') {
    const name = parsed.query.name;
    if (!name) return sendError(res, 400, 'Missing ?name');

    getAvailableDrives((err, drives) => {
        if (err) return sendError(res, 500, 'Drive fetch error');

        let results = [];
        let pending = drives.length;
        if (pending === 0) return sendJSON(res, { success: true, paths: [] });

        drives.forEach(drive => {
            // Modified dir command: /ad = directories only, /s = recursive
            exec(`dir "${drive}\\${name}" /ad /s /b`, { windowsHide: true }, (error, stdout) => {
                if (!error && stdout) {
                    const found = stdout.trim()
                        .split('\n')
                        .map(line => line.trim())
                        .filter(Boolean)
                        // Ensure results are directories (optional safety check)
                        .filter(path => fs.existsSync(path) && fs.lstatSync(path).isDirectory());
                    
                    results.push(...found);
                }
                if (--pending === 0) {
                    if (results.length === 0) {
                        return sendJSON(res, { 
                            success: true, 
                            paths: [], 
                            message: 'No matching directories found' 
                        });
                    }
                    sendJSON(res, { success: true, paths: results });
                }
            });
        });
    });
}
  
    
  else {
    sendError(res, 404, 'Invalid endpoint');
  }
});

module.exports = {
  startDriveHttpServer: () => {
    server.listen(PORT, () => {
      console.log(`Drive HTTP server running at http://localhost:${PORT}`);
    });
  }
};
