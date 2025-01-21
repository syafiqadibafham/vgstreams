import fs from 'fs'
import express from 'express'
import path from 'path'
import cors from 'cors'
import { fileURLToPath } from 'url';

const app = express();
app.use(cors())

// Get the current directory using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure directories exist before writing files
const ensureDirExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// Path to the manifest file
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf-8'));

// Delete files in the given directory
const deleteFiles = (dirPath) => {
    if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
            const filePath = path.join(dirPath, file);
            if (fs.statSync(filePath).isDirectory()) {
                deleteFiles(filePath); // Recursively delete files in subdirectories
            } else {
                fs.unlinkSync(filePath); // Delete file
            }
        });
    } else {
        console.log(`Directory not found: ${dirPath}`);
    }
};

// Function to serve static files
function serveFiles() {
    // Serve static files from these directories
    app.use('/catalog', express.static(path.join(__dirname, 'catalog')));
    app.use('/meta', express.static(path.join(__dirname, 'meta')));
    app.use('/stream', express.static(path.join(__dirname, 'stream')));
}

async function fetchStreams() {
    const response = await fetch('https://ppv.land/api/streams');
    const streamData = await response.json();
    const nbaStreams = streamData.streams.find(element => element.id === 37);
    return nbaStreams;
}

async function getNameAndLink(nbaStreams) {
    let nbaStreamsJSON = { "metas": [] };
    let metas = [];
    let streams = [];

    for (const element of nbaStreams) {
        const response = await fetch("https://ppv.land/api/streams/" + element.id);
        const jsonData = await response.json();
        const elementData = jsonData["data"];

        let addElement = {
            "type": "NBA",
            "id": "vgstream_" + elementData.id,
            "name": elementData.name,
            "poster": elementData.poster,
            "genres": ["Sports"]
        };

        let meta = {
            "meta": {
                "id": "vgstream_" + elementData.id,
                "type": "NBA",
                "name": elementData.name,
                "poster": elementData.poster,
                "genres": ["Sports"],
                "description": "NBA Game: " + elementData.name,
                "logo": elementData.poster,
                "background": elementData.poster,
                "runtime": ""
            }
        };

        let stream = {
            "streams": [
                {
                    "title": "Source 1 (PPV)",
                    "url": elementData["m3u8"],
                    "type": "tv",
                    "behaviorHints": { "notWebReady": false },
                    "id": element.id
                }
            ]
        };

        nbaStreamsJSON.metas.push(addElement);
        metas.push(meta);
        streams.push(stream);
    }

    return { nbaStreamsJSON, metas, streams };
}

async function getNBACatalog() {
    const streamData = await fetchStreams();
    const { nbaStreamsJSON, metas, streams } = await getNameAndLink(streamData.streams);
    return { nbaStreamsJSON, metas, streams };
}

async function pushCatalog(nbaCatalog) {
    const jsonString = JSON.stringify(nbaCatalog, null, 2);
    const catalogPath = path.join(__dirname, 'catalog', 'NBA');
    ensureDirExists(catalogPath);
    const fp = path.join(catalogPath, 'nbaStreams.json');
    fs.writeFile(fp, jsonString, (err) => {
        if (err) {
            console.log('Error writing file:', err);
        } else {
            console.log('File has been saved!');
        }
    });
}

async function pushMetas(metas) {
    metas.forEach(element => {
        const jsonString = JSON.stringify(element, null, 2);
        const metaPath = path.join(__dirname, 'meta', 'NBA');
        ensureDirExists(metaPath);
        const fp = path.join(metaPath, element.meta.id + ".json");
        fs.writeFile(fp, jsonString, (err) => {
            if (err) {
                console.log('Error writing file:', err);
            } else {
                console.log('File has been saved!');
            }
        });
    });
}

async function pushStreams(streams) {
    streams.forEach(element => {
        const jsonString = JSON.stringify(element, null, 2);
        const streamPath = path.join(__dirname, 'stream', 'NBA');
        ensureDirExists(streamPath);
        const fp = path.join(streamPath, "vgstream_" + element.streams[0].id + ".json");
        fs.writeFile(fp, jsonString, (err) => {
            if (err) {
                console.log('Error writing file:', err);
            } else {
                console.log('File has been saved!');
            }
        });
    });
}

async function main() {
    try {
        // Delete existing files in the directories
        const catalogPath = path.join(__dirname, 'catalog', 'NBA');
        const metaPath = path.join(__dirname, 'meta', 'NBA');
        const streamPath = path.join(__dirname, 'stream', 'NBA');

        deleteFiles(catalogPath);
        deleteFiles(metaPath);
        deleteFiles(streamPath);

        // Fetch the NBA catalog data
        const { nbaStreamsJSON, metas, streams } = await getNBACatalog();

        // Push the data to respective files
        await pushCatalog(nbaStreamsJSON);
        await pushMetas(metas);
        await pushStreams(streams);

        // Serve the JSON files
        serveFiles();

        // Serve the manifest file
        app.get('/manifest.json', (req, res) => {
            res.json(manifest);
        });

        // Start the server
        app.listen(3000, () => {
            console.log("Listening on port 3000");
        });
    } catch (error) {
        console.error("Error occurred:", error);
    }
}

// Call the main function to execute
main();
