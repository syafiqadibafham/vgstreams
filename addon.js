import fs from 'fs';
import express from 'express';
import path from 'path';
import cors from 'cors';
import fetch from 'node-fetch'; // Ensure node-fetch is installed.
import { fileURLToPath } from 'url';
import { SPORT_IDS } from './config.js';

const PORT = process.env.PORT || 3000;
const API_BASE_URL = 'https://ppv.land/api';

const app = express();
app.use(cors());

// Get the current directory using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure directories exist before writing files
const ensureDirExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// Delete all files in a directory
const deleteDirectoryContents = (dirPath) => {
    if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
            const filePath = path.join(dirPath, file);
            fs.rmSync(filePath, { recursive: true, force: true });
        });
    }
};

// Fetch data from a given URL
const fetchData = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching data from ${url}:`, error);
        throw error;
    }
};

// Get streams for a given sport ID
const fetchStreams = async (sportId) => {
    try {
        const url = `${API_BASE_URL}/streams`;
        const streamData = await fetchData(url);

        if (!streamData || !Array.isArray(streamData.streams)) {
            console.error(`Invalid stream data for sport ID ${sportId}:`, streamData);
            return { streams: [] }; // Return an empty object with streams array to avoid errors.
        }

        return streamData.streams.find((stream) => stream.id === sportId) || { streams: [] };
    } catch (error) {
        console.error(`Error fetching streams for sport ID ${sportId}:`, error);
        return { streams: [] }; // Return empty streams in case of error.
    }
};

// Process streams and generate catalog, metas, and streams
const processStreams = async (sportName, sportId) => {
    const { streams } = await fetchStreams(sportId);

    if (!streams || !Array.isArray(streams)) {
        console.error(`Streams data for ${sportName} (${sportId}) is invalid:`, streams);
        return { sportStreamsJSON: { metas: [] }, metas: [], streamFiles: [] };
    }

    const sportStreamsJSON = { metas: [] };
    const metas = [];
    let streamFiles = [];

    await Promise.all(
        streams.map(async (stream) => {
            const streamDetails = await fetchData(`${API_BASE_URL}/streams/${stream.id}`);
            const elementData = streamDetails.data;

            const metaId = `vgstream_${elementData.id}`;
            const baseData = {
                id: metaId,
                type: sportName,
                name: elementData.name,
                poster: elementData.poster,
                genres: ['Sports'],
            };

            sportStreamsJSON.metas.push(baseData);

            metas.push({
                meta: {
                    ...baseData,
                    description: `${sportName} Game: ${elementData.name}`,
                    logo: elementData.poster,
                    background: elementData.poster,
                    runtime: '',
                },
            });

            streamFiles.push({
                streams: [
                    {
                        title: elementData.tag,
                        url: elementData.m3u8,
                        type: 'tv',
                        behaviorHints: { notWebReady: false },
                        id: stream.id,
                    },
                ],
            });
        })
    );

    return { sportStreamsJSON, metas, streamFiles };
};

// Write JSON data to a file
const writeToFile = (filePath, data) => {
    ensureDirExists(path.dirname(filePath));
    return fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
};

// Save catalogs, metas, and streams to files
const saveDataToFiles = async (sportName, catalog, metas, streamFiles) => {
    const baseDir = (type) => path.join(__dirname, type, sportName);

    // Clear old data
    deleteDirectoryContents(baseDir('catalog'));
    deleteDirectoryContents(baseDir('meta'));
    deleteDirectoryContents(baseDir('stream'));

    // Save new data
    await writeToFile(path.join(baseDir('catalog'), `${sportName.toLowerCase()}Streams.json`), catalog);
    await Promise.all(
        metas.map((meta) =>
            writeToFile(path.join(baseDir('meta'), `${meta.meta.id}.json`), meta)
        )
    );
    //pushStreams(streams);
    await Promise.all(
        streamFiles.map((stream, index) =>
            writeToFile(path.join(baseDir('stream'), `vgstream_${stream.streams[0].id}.json`), stream)
        )
    );
};

// Serve static files
const serveStaticFiles = () => {
    app.use('/catalog', express.static(path.join(__dirname, 'catalog')));
    app.use('/meta', express.static(path.join(__dirname, 'meta')));
    app.use('/stream', express.static(path.join(__dirname, 'stream')));
};

// Main processing function
const performTasks = async () => {
    for (const [sportName, sportId] of Object.entries(SPORT_IDS)) {
        try {
            console.log(`Processing ${sportName}...`);
            const { sportStreamsJSON, metas, streamFiles } = await processStreams(sportName, sportId);
            
            await saveDataToFiles(sportName, sportStreamsJSON, metas, streamFiles);
        } catch (error) {
            console.error(`Error processing ${sportName}:`, error);
        }
    }
    serveStaticFiles();
};

// Main entry point
const main = async () => {
    try {
        // Initial processing
        await performTasks();

        // Periodic task every 6 minutes
        setInterval(async () => {
            console.log("Running periodic task...");
            await performTasks();
        }, 360000); // 360,000 ms = 6 minutes

        // Serve static files and manifest
        const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf-8'));
        app.get('/manifest.json', (req, res) => res.json(manifest));

        // Start the server
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Critical error:', error);
    }
};

main();
