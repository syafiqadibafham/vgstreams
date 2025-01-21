import fs from 'fs'
import express from 'express'
const app = express();
import path from 'path'
import manifest from './manifest.json' assert {type: 'json'}
async function fetchStreams () {
    const response = await fetch('https://ppv.land/api/streams')
    const streamData = await response.json()
    const nbaStreams= streamData.streams.find(element => element.id === 37);
    return nbaStreams;
}

async function getNameAndLink (nbaStreams) {
    let nbaStreamsJSON = {
        "metas": []
    };
    let metas = []
    let streams = []
    for (const element of nbaStreams) {
        const response = await fetch("https://ppv.land/api/streams/" + element.id)
        const jsonData = await response.json()
        const elementData = jsonData["data"]
        
        let addElement = {
            "type": "NBA",
            "id": null,
            "name": null,
            "poster": null,
            "genres": ["Sports"]
        }
        addElement["id"] = ("vgstream_" + elementData.id)
        // addElement["link"] = (elementData["m3u8"])
        addElement["name"] = (elementData.name)
        addElement["poster"] = (elementData.poster)

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
        }

        let stream = {
            "streams": [
                {
                    "title": "Source 1 (PPV)", 
                    "url": elementData["m3u8"],
                    "type": "tv",
                    "behaviorHints": {
                        "notWebReady": false
                    },
                    "id": element.id
                }
            ]
        }
        nbaStreamsJSON.metas.push(addElement)
        metas.push(meta);
        streams.push(stream);
    };

    return { nbaStreamsJSON, metas, streams };
}

async function getNBACatalog () {
    const streamData = await fetchStreams()
    const { nbaStreamsJSON, metas, streams } = await getNameAndLink(streamData.streams)
    return { nbaStreamsJSON, metas, streams };
}

async function pushCatalog (nbaCatalog) {
    const jsonString = JSON.stringify(nbaCatalog, null, 2);
    const fp = "./catalog/NBA/nbaStreams.json"
    fs.writeFile(fp, jsonString, (err) => {
        if (err) {
          console.log('Error writing file:', err);
        } else {
          console.log('File has been saved!');
        }
    })
}

async function pushMetas (metas) {
    metas.forEach(element => {
        const jsonString = JSON.stringify(element, null, 2);
        const fp = "./meta/NBA/" + element.meta.id +".json"
        fs.writeFile(fp, jsonString, (err) => {
            if (err) {
            console.log('Error writing file:', err);
            } else {
            console.log('File has been saved!');
            }
    })   
    });
}

async function pushStreams (streams) {
    streams.forEach(element => {
        const jsonString = JSON.stringify(element, null, 2);
        const fp = "./stream/NBA/" + "vgstream_" + element.streams[0].id +".json"
        fs.writeFile(fp, jsonString, (err) => {
            if (err) {
            console.log('Error writing file:', err);
            } else {
            console.log('File has been saved!');
            }
    })   
    }); 
}

async function deleteFiles () {

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

    // Usage
    const catalogPath = path.resolve('./catalog/NBA');
    const metaPath = path.resolve('./meta/NBA');
    const streamPath = path.resolve('./stream/NBA');

    deleteFiles(catalogPath);
    deleteFiles(metaPath);
    deleteFiles(streamPath);
}

function serveFiles() {
    // List of directories to serve
    console.log("Serve files is being run.")
    const directories = ['./catalog/NBA', './meta/NBA', './stream/NBA'];

    directories.forEach((dirPath) => {
        // Ensure the directory exists
        console.log("Directory " + dirPath)
        if (!fs.existsSync(dirPath)) {
            console.log(`Directory does not exist: ${dirPath}`);
            return;
        }

        // Loop through files in the directory
        fs.readdirSync(dirPath).forEach((file) => {
            const filePath = path.join(dirPath, file);
            console.log("File " + filePath)
            // If it's a JSON file, serve it
            if (fs.statSync(filePath).isFile() && file.endsWith('.json')) {
                console.log("JSON confirmed")
                const relativePath = path.join(dirPath, file);
                console.log(relativePath)
                app.get(`/${relativePath}`, (req, res) => {
                    console.log(`Serving file: ${filePath}`);
                    res.sendFile(path.resolve(filePath)); // Serve the file at its relative path
                });
            }
        });
    });
}


async function main() {
    try {
        // Delete existing files in the directories
        await deleteFiles();

        // Fetch the NBA catalog data
        const { nbaStreamsJSON, metas, streams } = await getNBACatalog();

        // Push the data to respective files
        await pushCatalog(nbaStreamsJSON);
        await pushMetas(metas);
        await pushStreams(streams);

        // Serve the JSON files
        await serveFiles();

        // Start the server
        app.get('/manifest.json', (req, res) => {
            res.send(manifest)
        })
        app.listen(3000, () => {
            console.log("Listening on port 3000");
        });

    } catch (error) {
        console.error("Error occurred:", error);
    }
}

// Call the main function to execute
main();



